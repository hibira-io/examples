// The invite queue's rules, with no network and no storage of its own: the
// same file runs in this app's API routes (lib/server.ts, memory storage)
// and in Hibira's hosted demo backend (a Cloudflare Durable Object, with
// Durable Object storage and email through Amazon SES).
//
// One queue. People who have a spare invite code for a product give it;
// people who want one sign in with an email code and line up for the
// products they want. Each code is offered to the first person in line who
// wants that product; they have HOLD_MS to take it, or it moves on to the
// next person. After taking a code they say whether it worked, and someone
// whose codes keep failing can no longer give codes.
//
// Everything that happens is announced over Hibira:
//   invite-queue                     (public) "state": counts; "chat"; "chat-removed"
//   private-invite-queue-<user id>   "me": something changed for this person, read /state again
// Codes never travel over a channel: only /state, called with the
// person's own session, answers the code they took.

export const HOLD_MS = 6 * 60 * 60 * 1000;
export const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_TRIES = 5;
const OTP_RESEND_MS = 60 * 1000;
const OTP_PER_EMAIL_HOUR = 5;
const OTP_PER_IP_HOUR = 10;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const CLAIM_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const REPORT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const CLAIM_KEEP_MS = 14 * 24 * 60 * 60 * 1000;
const USER_KEEP_MS = 90 * 24 * 60 * 60 * 1000;
const DONOR_MAX_OPEN = 10;
const GIVE_MAX = 5;
const CODE_MAX = 300;
export const STRIKES_BLOCK = 3;
const CHAT_KEEP = 100;
const CHAT_MAX = 300;
const CHAT_GAP_MS = 3000;
const CHAT_REPORTS_HIDE = 3;
const NAME_MAX = 24;
const CLEANUP_MS = 60 * 60 * 1000;

export const CHANNEL = "invite-queue";
export const USER_CHANNEL_PREFIX = "private-invite-queue-";
const LANGS = ["en", "zh-TW", "zh-CN", "ja", "ko", "th", "vi"];
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export class QueueError extends Error {
  /** @param {number} status @param {string} code */
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

/**
 * @typedef {{ get(key: string): Promise<any>, put(key: string, value: any): Promise<void>, delete(keys: string | string[]): Promise<unknown>, list(o: { prefix: string }): Promise<Map<string, any>> }} Storage
 * @typedef {{ to: string, kind: "code" | "turn", lang: string, code?: string, product?: string, deadline?: number, link?: string }} Mail
 * @typedef {{ id: string, name: string, names?: Record<string, string> }} Product
 * @typedef {{ uid: string, email: string, name: string, lang: string, admin?: boolean, strikes: number, blocked: boolean, banned: boolean, seen: number, cooldownUntil: number, reported: number }} User
 * @typedef {{ seq: number, uid: string, products: string[], at: number, state: "waiting" | "offered", codeId?: number, deadline?: number, requeued?: boolean, avoid?: string[] }} Entry
 * @typedef {{ id: number, product: string, value: string, donor: string, at: number, state: "open" | "offered" | "taken", seq?: number, taker?: string, takenAt?: number, report?: "ok" | "bad" }} Code
 * @typedef {{ id: number, uid: string, name: string, text: string, at: number, reports: string[] }} ChatMessage
 */

export class InviteQueue {
  /**
   * @param {{ storage: Storage, products: Product[], publish?: (channel: string, event: string, data: unknown) => Promise<unknown>,
   *   sendMail?: (m: Mail) => Promise<unknown>, admins?: string[], siteUrl?: string, now?: () => number, random?: (n: number) => string }} o
   */
  constructor(o) {
    this.storage = o.storage;
    this.products = o.products.filter((p) => p && /^[a-z0-9-]{1,40}$/.test(p.id) && p.name);
    this.publish = o.publish ?? (async () => {});
    this.sendMail = o.sendMail ?? (async () => {});
    this.admins = new Set((o.admins ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean));
    this.siteUrl = o.siteUrl ?? "";
    this.now = o.now ?? Date.now;
    this.random = o.random ?? randomId;
    this.loaded = false;
    /** @type {Map<string, User>} */ this.users = new Map();
    /** @type {Map<string, string>} */ this.byEmail = new Map();
    /** @type {Map<string, { uid: string, exp: number }>} */ this.sessions = new Map();
    /** @type {Map<string, { hash: string, exp: number, tries: number, sent: number[] }>} */ this.otps = new Map();
    /** @type {Map<number, Entry>} */ this.entries = new Map();
    /** @type {Map<number, Code>} */ this.codes = new Map();
    /** @type {ChatMessage[]} */ this.chat = [];
    this.meta = { seq: 0, code: 0, msg: 0, served: 0, cleaned: 0 };
    /** @type {Map<string, number[]>} */ this.ipOtps = new Map();
    /** @type {Map<string, number>} */ this.lastChat = new Map();
  }

  async load() {
    if (this.loaded) return;
    const get = async (/** @type {string} */ prefix) => [...(await this.storage.list({ prefix })).entries()];
    this.meta = { ...this.meta, ...((await this.storage.get("meta")) ?? {}) };
    for (const [, u] of await get("u:")) {
      this.users.set(u.uid, u);
      this.byEmail.set(u.email, u.uid);
    }
    for (const [k, s] of await get("s:")) this.sessions.set(k.slice(2), s);
    for (const [k, o] of await get("o:")) this.otps.set(k.slice(2), o);
    for (const [, e] of await get("e:")) this.entries.set(e.seq, e);
    for (const [, c] of await get("c:")) this.codes.set(c.id, c);
    this.chat = (await this.storage.get("chat")) ?? [];
    this.loaded = true;
  }

  /**
   * One API call. token is the session from /auth/verify (or ""), ip the
   * caller's address for the email code limits.
   * @param {{ method: string, path: string, body?: any, token?: string, ip?: string }} r
   * @returns {Promise<{ status: number, body: any }>}
   */
  async handle(r) {
    await this.load();
    const route = ROUTES[`${r.method} ${r.path}`];
    if (!route) return { status: 404, body: { error: "not_found" } };
    try {
      const user = await this.session(r.token ?? "");
      if (user) this.touch(user);
      const body = r.body && typeof r.body === "object" ? r.body : {};
      return { status: 200, body: (await route.call(this, { body, user, ip: r.ip ?? "", token: r.token ?? "" })) ?? { ok: true } };
    } catch (err) {
      if (err instanceof QueueError) return { status: err.status, body: { error: err.code } };
      throw err;
    }
  }

  /** The person a session token belongs to, or null. @param {string} token */
  async session(token) {
    await this.load();
    if (!token) return null;
    const s = this.sessions.get(await sha256(token));
    if (!s || s.exp < this.now()) return null;
    return this.users.get(s.uid) ?? null;
  }

  /** May this session subscribe to this channel? @param {string} token @param {string} channel */
  async mayJoin(token, channel) {
    const user = await this.session(token);
    return Boolean(user && channel === USER_CHANNEL_PREFIX + user.uid);
  }

  /** When the next deadline or clean-up is due. */
  nextAlarm() {
    let at = this.meta.cleaned + CLEANUP_MS;
    for (const e of this.entries.values()) if (e.state === "offered" && e.deadline && e.deadline < at) at = e.deadline;
    return Math.max(at, this.now() + 1000);
  }

  /** Expired offers move on; old records go. Called by the alarm (and before each read). */
  async tick() {
    await this.load();
    const now = this.now();
    for (const e of [...this.entries.values()]) {
      if (e.state !== "offered" || !e.deadline || e.deadline > now) continue;
      const code = e.codeId !== undefined ? this.codes.get(e.codeId) : undefined;
      await this.dropEntry(e);
      if (code) await this.reopen(code);
      await this.notify(e.uid);
    }
    if (now - this.meta.cleaned >= CLEANUP_MS) await this.cleanup(now);
    await this.match();
  }

  // ——— Internals ———

  /** @param {User} user */
  touch(user) {
    const now = this.now();
    if (now - user.seen > 60_000) {
      user.seen = now;
      this.storage.put(`u:${user.uid}`, user).catch(() => {});
    }
  }

  /** @param {number} now */
  async cleanup(now) {
    for (const [k, s] of this.sessions) if (s.exp < now) await this.del(this.sessions, k, `s:${k}`);
    for (const [k, o] of this.otps) if (o.exp < now && o.sent.every((t) => now - t > 3_600_000)) await this.del(this.otps, k, `o:${k}`);
    for (const c of [...this.codes.values()]) {
      if (c.state === "taken" && c.takenAt && now - c.takenAt > CLAIM_KEEP_MS) await this.del(this.codes, c.id, `c:${c.id}`);
    }
    for (const u of [...this.users.values()]) {
      if (now - u.seen < USER_KEEP_MS || u.banned) continue;
      if ([...this.entries.values()].some((e) => e.uid === u.uid) || [...this.codes.values()].some((c) => c.donor === u.uid && c.state !== "taken")) continue;
      this.byEmail.delete(u.email);
      await this.del(this.users, u.uid, `u:${u.uid}`);
    }
    for (const [ip, times] of this.ipOtps) if (times.every((t) => now - t > 3_600_000)) this.ipOtps.delete(ip);
    this.meta.cleaned = now;
    await this.saveMeta();
  }

  /**
   * @template K, V
   * @param {Map<K, V>} map @param {K} key @param {string} storageKey
   */
  async del(map, key, storageKey) {
    map.delete(key);
    await this.storage.delete(storageKey);
  }

  async saveMeta() {
    await this.storage.put("meta", this.meta);
  }

  /** @param {Entry} e */
  async saveEntry(e) {
    this.entries.set(e.seq, e);
    await this.storage.put(`e:${e.seq}`, e);
  }

  /** @param {Entry} e */
  async dropEntry(e) {
    await this.del(this.entries, e.seq, `e:${e.seq}`);
  }

  /** @param {Code} c */
  async saveCode(c) {
    this.codes.set(c.id, c);
    await this.storage.put(`c:${c.id}`, c);
  }

  /** @param {User} u */
  async saveUser(u) {
    this.users.set(u.uid, u);
    this.byEmail.set(u.email, u.uid);
    await this.storage.put(`u:${u.uid}`, u);
  }

  /** @param {Code} c */
  async reopen(c) {
    c.state = "open";
    delete c.seq;
    await this.saveCode(c);
  }

  /** @param {string} uid */
  entryOf(uid) {
    for (const e of this.entries.values()) if (e.uid === uid) return e;
    return undefined;
  }

  /** Offers each open code to the first person in line who wants it. */
  async match() {
    const open = [...this.codes.values()].filter((c) => c.state === "open").sort((a, b) => a.at - b.at || a.id - b.id);
    if (!open.length) return;
    const line = [...this.entries.values()].filter((e) => e.state === "waiting").sort((a, b) => a.seq - b.seq);
    let changed = false;
    for (const code of open) {
      const e = line.find((x) => x.state === "waiting" && x.products.includes(code.product) && x.uid !== code.donor && !x.avoid?.includes(code.donor) && !this.users.get(x.uid)?.banned);
      if (!e) continue;
      e.state = "offered";
      e.codeId = code.id;
      e.deadline = this.now() + HOLD_MS;
      code.state = "offered";
      code.seq = e.seq;
      await this.saveEntry(e);
      await this.saveCode(code);
      changed = true;
      const u = this.users.get(e.uid);
      if (u) {
        await this.notify(u.uid);
        await this.sendMail({ to: u.email, kind: "turn", lang: u.lang, product: this.productName(code.product, u.lang), deadline: e.deadline, link: this.siteUrl }).catch(() => {});
      }
    }
    if (changed) await this.announce();
  }

  /** The product's name in a language, if it has one. @param {string} id @param {string} [lang] */
  productName(id, lang) {
    const p = this.products.find((x) => x.id === id);
    return (lang && p?.names?.[lang]) || p?.name || id;
  }

  /** @param {string} uid */
  async notify(uid) {
    await this.publish(USER_CHANNEL_PREFIX + uid, "me", { at: this.now() }).catch(() => {});
  }

  async announce() {
    await this.publish(CHANNEL, "state", this.counts()).catch(() => {});
  }

  counts() {
    const waiting = [...this.entries.values()];
    return {
      products: this.products.map((p) => ({
        id: p.id,
        name: p.name,
        names: p.names ?? {},
        open: [...this.codes.values()].filter((c) => c.product === p.id && c.state === "open").length,
        waiting: waiting.filter((e) => e.state === "waiting" && e.products.includes(p.id)).length,
      })),
      waiting: waiting.filter((e) => e.state === "waiting").length,
      served: this.meta.served,
      holdHours: HOLD_MS / 3_600_000,
    };
  }

  /** @param {User} u */
  me(u) {
    const now = this.now();
    const e = this.entryOf(u.uid);
    let entry = null;
    if (e) {
      const ahead = [...this.entries.values()].filter((x) => x.state === "waiting" && x.seq < e.seq && x.products.some((p) => e.products.includes(p))).length;
      const code = e.codeId !== undefined ? this.codes.get(e.codeId) : undefined;
      entry = {
        state: e.state,
        products: e.products,
        joinedAt: e.at,
        ahead: e.state === "waiting" ? ahead : 0,
        offer: e.state === "offered" && code ? { product: code.product, deadline: e.deadline } : null,
      };
    }
    const taken = [...this.codes.values()].filter((c) => c.taker === u.uid).sort((a, b) => (b.takenAt ?? 0) - (a.takenAt ?? 0));
    const given = [...this.codes.values()].filter((c) => c.donor === u.uid).sort((a, b) => b.at - a.at);
    return {
      uid: u.uid,
      email: u.email,
      name: u.name,
      admin: Boolean(u.admin || this.admins.has(u.email)),
      banned: u.banned,
      blocked: u.blocked || u.banned,
      strikes: u.strikes,
      cooldownUntil: u.cooldownUntil > now ? u.cooldownUntil : 0,
      entry,
      taken: taken.map((c) => ({ id: c.id, product: c.product, value: c.value, takenAt: c.takenAt, report: c.report ?? null, canReport: !c.report && now - (c.takenAt ?? 0) < REPORT_WINDOW_MS })),
      given: given.map((c) => ({ id: c.id, product: c.product, state: c.state, at: c.at, report: c.report ?? null })),
    };
  }

  /** @param {string} uid */
  async withdrawAll(uid) {
    for (const c of [...this.codes.values()]) {
      if (c.donor !== uid || c.state === "taken") continue;
      if (c.state === "offered" && c.seq !== undefined) {
        const e = this.entries.get(c.seq);
        if (e) {
          e.state = "waiting";
          delete e.codeId;
          delete e.deadline;
          await this.saveEntry(e);
          await this.notify(e.uid);
        }
      }
      await this.del(this.codes, c.id, `c:${c.id}`);
    }
  }

  /** @param {number} id */
  async removeMessage(id) {
    const before = this.chat.length;
    this.chat = this.chat.filter((m) => m.id !== id);
    if (this.chat.length === before) return;
    await this.storage.put("chat", this.chat);
    await this.publish(CHANNEL, "chat-removed", { id }).catch(() => {});
  }

  /** @param {User | null} user @returns {asserts user is User} */
  must(user) {
    if (!user) throw new QueueError(401, "sign_in");
    if (user.banned) throw new QueueError(403, "banned");
  }

  /** @param {User} u */
  isAdmin(u) {
    return Boolean(u.admin || this.admins.has(u.email));
  }
}

/** @type {Record<string, (this: InviteQueue, a: { body: any, user: User | null, ip: string, token: string }) => Promise<any>>} */
const ROUTES = {
  async "GET /state"({ user }) {
    await this.tick();
    return { ...this.counts(), chat: this.chat.map(publicMessage), me: user ? this.me(user) : null };
  },

  // ——— Email sign-in ———

  async "POST /auth/start"({ body, ip }) {
    const email = cleanEmail(body.email);
    const banned = this.byEmail.get(email);
    if (banned && this.users.get(banned)?.banned) throw new QueueError(403, "banned");
    const now = this.now();
    const byIp = (this.ipOtps.get(ip) ?? []).filter((t) => now - t < 3_600_000);
    const prev = this.otps.get(email);
    const sent = (prev?.sent ?? []).filter((t) => now - t < 3_600_000);
    if (sent.length && now - sent[sent.length - 1] < OTP_RESEND_MS) throw new QueueError(429, "wait");
    if (sent.length >= OTP_PER_EMAIL_HOUR || byIp.length >= OTP_PER_IP_HOUR) throw new QueueError(429, "too_many");
    const code = String(randomInt(1_000_000)).padStart(6, "0");
    const otp = { hash: await sha256(`${email}:${code}`), exp: now + OTP_TTL_MS, tries: 0, sent: [...sent, now] };
    this.otps.set(email, otp);
    await this.storage.put(`o:${email}`, otp);
    this.ipOtps.set(ip, [...byIp, now]);
    await this.sendMail({ to: email, kind: "code", code, lang: cleanLang(body.lang) });
    return { ok: true, expiresIn: OTP_TTL_MS / 1000 };
  },

  async "POST /auth/verify"({ body }) {
    const email = cleanEmail(body.email);
    const code = String(body.code ?? "").replace(/\D/g, "");
    const otp = this.otps.get(email);
    const now = this.now();
    if (!otp || otp.exp < now || otp.tries >= OTP_TRIES) throw new QueueError(400, "code_expired");
    if ((await sha256(`${email}:${code}`)) !== otp.hash) {
      otp.tries += 1;
      await this.storage.put(`o:${email}`, otp);
      throw new QueueError(400, otp.tries >= OTP_TRIES ? "code_expired" : "code_wrong");
    }
    otp.exp = 0;
    await this.storage.put(`o:${email}`, otp);
    let user = this.users.get(this.byEmail.get(email) ?? "");
    if (user?.banned) throw new QueueError(403, "banned");
    if (!user) {
      let uid = this.random(10);
      while (this.users.has(uid)) uid = this.random(10);
      user = { uid, email, name: defaultName(uid), lang: cleanLang(body.lang), strikes: 0, blocked: false, banned: false, seen: now, cooldownUntil: 0, reported: 0 };
    }
    user.lang = cleanLang(body.lang ?? user.lang);
    user.seen = now;
    await this.saveUser(user);
    const token = this.random(32);
    const session = { uid: user.uid, exp: now + SESSION_MS };
    const key = await sha256(token);
    this.sessions.set(key, session);
    await this.storage.put(`s:${key}`, session);
    return { token, me: this.me(user) };
  },

  async "POST /auth/logout"({ token }) {
    if (!token) return { ok: true };
    const key = await sha256(token);
    if (this.sessions.has(key)) await this.del(this.sessions, key, `s:${key}`);
    return { ok: true };
  },

  async "POST /me"({ body, user }) {
    this.must(user);
    if (body.name !== undefined) {
      const name = cleanText(body.name, NAME_MAX);
      if (!name) throw new QueueError(400, "name");
      user.name = name;
    }
    if (body.lang !== undefined) user.lang = cleanLang(body.lang);
    await this.saveUser(user);
    return { me: this.me(user) };
  },

  // ——— The line ———

  async "POST /queue/join"({ body, user }) {
    this.must(user);
    const ids = new Set(this.products.map((p) => p.id));
    const products = [...new Set(Array.isArray(body.products) ? body.products.map(String) : [])].filter((p) => ids.has(p));
    if (!products.length) throw new QueueError(400, "products");
    if (user.cooldownUntil > this.now()) throw new QueueError(409, "cooldown");
    const current = this.entryOf(user.uid);
    if (current) {
      if (current.state === "offered") throw new QueueError(409, "offered");
      current.products = products;
      await this.saveEntry(current);
    } else {
      this.meta.seq += 1;
      await this.saveMeta();
      await this.saveEntry({ seq: this.meta.seq, uid: user.uid, products, at: this.now(), state: "waiting" });
    }
    await this.match();
    await this.announce();
    return { me: this.me(user) };
  },

  async "POST /queue/leave"({ user }) {
    this.must(user);
    const e = this.entryOf(user.uid);
    if (e) {
      const code = e.codeId !== undefined ? this.codes.get(e.codeId) : undefined;
      await this.dropEntry(e);
      if (code && code.state === "offered") await this.reopen(code);
      await this.match();
      await this.announce();
    }
    return { me: this.me(user) };
  },

  async "POST /offer/take"({ user }) {
    this.must(user);
    const e = this.entryOf(user.uid);
    const code = e?.codeId !== undefined ? this.codes.get(e.codeId) : undefined;
    if (!e || e.state !== "offered" || !code) throw new QueueError(409, "no_offer");
    const now = this.now();
    code.state = "taken";
    code.taker = user.uid;
    code.takenAt = now;
    delete code.seq;
    await this.saveCode(code);
    await this.dropEntry(e);
    user.cooldownUntil = now + CLAIM_COOLDOWN_MS;
    await this.saveUser(user);
    this.meta.served += 1;
    await this.saveMeta();
    await this.announce();
    return { me: this.me(user), code: { id: code.id, product: code.product, value: code.value } };
  },

  async "POST /offer/pass"({ user }) {
    this.must(user);
    const e = this.entryOf(user.uid);
    const code = e?.codeId !== undefined ? this.codes.get(e.codeId) : undefined;
    if (!e || e.state !== "offered" || !code) throw new QueueError(409, "no_offer");
    await this.dropEntry(e);
    await this.reopen(code);
    await this.match();
    await this.announce();
    return { me: this.me(user) };
  },

  // A code that did not work counts against its giver; the person who took
  // it gets their place back once a week (so a false report gains little).
  async "POST /taken/report"({ body, user }) {
    this.must(user);
    const code = this.codes.get(Number(body.id));
    if (!code || code.taker !== user.uid) throw new QueueError(404, "not_found");
    if (code.report || this.now() - (code.takenAt ?? 0) > REPORT_WINDOW_MS) throw new QueueError(409, "reported");
    code.report = body.works ? "ok" : "bad";
    await this.saveCode(code);
    if (code.report === "bad") {
      const donor = this.users.get(code.donor);
      if (donor) {
        donor.strikes += 1;
        if (donor.strikes >= STRIKES_BLOCK && !donor.blocked) {
          donor.blocked = true;
          await this.withdrawAll(donor.uid);
        }
        await this.saveUser(donor);
      }
      const now = this.now();
      if (now - user.reported > 7 * 24 * 3_600_000 && !this.entryOf(user.uid)) {
        user.reported = now;
        user.cooldownUntil = 0;
        await this.saveUser(user);
        // Back in line, ahead of everyone still waiting.
        await this.saveEntry({ seq: lowestFreeSeq(this), uid: user.uid, products: [code.product], at: now, state: "waiting", requeued: true, avoid: [code.donor] });
        await this.match();
        await this.announce();
      } else {
        user.cooldownUntil = 0;
        await this.saveUser(user);
      }
    }
    return { me: this.me(user) };
  },

  // ——— Giving codes ———

  async "POST /codes"({ body, user }) {
    this.must(user);
    if (user.blocked) throw new QueueError(403, "blocked");
    if (!this.products.some((p) => p.id === body.product)) throw new QueueError(400, "products");
    const values = [...new Set((Array.isArray(body.codes) ? body.codes : [body.codes]).map((v) => cleanCode(v)).filter(Boolean))];
    if (!values.length) throw new QueueError(400, "code");
    if (values.length > GIVE_MAX) throw new QueueError(400, "too_many_codes");
    const mine = [...this.codes.values()].filter((c) => c.donor === user.uid && c.state !== "taken");
    if (mine.length + values.length > DONOR_MAX_OPEN) throw new QueueError(409, "too_many_codes");
    const known = new Set([...this.codes.values()].map((c) => `${c.product}\u0000${c.value}`));
    let added = 0;
    for (const value of values) {
      if (known.has(`${body.product}\u0000${value}`)) continue;
      this.meta.code += 1;
      await this.saveCode({ id: this.meta.code, product: body.product, value, donor: user.uid, at: this.now(), state: "open" });
      added += 1;
    }
    await this.saveMeta();
    if (!added) throw new QueueError(409, "duplicate");
    await this.match();
    await this.announce();
    return { added, me: this.me(user) };
  },

  async "POST /codes/withdraw"({ body, user }) {
    this.must(user);
    const code = this.codes.get(Number(body.id));
    if (!code || code.donor !== user.uid) throw new QueueError(404, "not_found");
    if (code.state !== "open") throw new QueueError(409, "in_use");
    await this.del(this.codes, code.id, `c:${code.id}`);
    await this.announce();
    return { me: this.me(user) };
  },

  // ——— Chat ———

  async "POST /chat"({ body, user }) {
    this.must(user);
    const text = cleanText(body.text, CHAT_MAX, true);
    if (!text) throw new QueueError(400, "text");
    const now = this.now();
    if (now - (this.lastChat.get(user.uid) ?? 0) < CHAT_GAP_MS) throw new QueueError(429, "slow_down");
    this.lastChat.set(user.uid, now);
    this.meta.msg += 1;
    const msg = { id: this.meta.msg, uid: user.uid, name: user.name, text, at: now, reports: [] };
    this.chat = [...this.chat, msg].slice(-CHAT_KEEP);
    await this.storage.put("chat", this.chat);
    await this.saveMeta();
    await this.publish(CHANNEL, "chat", publicMessage(msg)).catch(() => {});
    return { message: publicMessage(msg) };
  },

  async "POST /chat/report"({ body, user }) {
    this.must(user);
    const msg = this.chat.find((m) => m.id === Number(body.id));
    if (!msg) throw new QueueError(404, "not_found");
    if (msg.uid !== user.uid && !msg.reports.includes(user.uid)) msg.reports.push(user.uid);
    if (msg.reports.length >= CHAT_REPORTS_HIDE || this.isAdmin(user)) await this.removeMessage(msg.id);
    else await this.storage.put("chat", this.chat);
    return { ok: true };
  },

  // ——— Moderation (emails in the admins list) ———

  async "POST /admin/chat/delete"({ body, user }) {
    this.must(user);
    if (!this.isAdmin(user)) throw new QueueError(403, "forbidden");
    await this.removeMessage(Number(body.id));
    return { ok: true };
  },

  async "POST /admin/ban"({ body, user }) {
    this.must(user);
    if (!this.isAdmin(user)) throw new QueueError(403, "forbidden");
    const target = this.users.get(String(body.uid));
    if (!target || this.isAdmin(target)) throw new QueueError(404, "not_found");
    target.banned = true;
    target.blocked = true;
    await this.saveUser(target);
    const e = this.entryOf(target.uid);
    if (e) {
      const code = e.codeId !== undefined ? this.codes.get(e.codeId) : undefined;
      await this.dropEntry(e);
      if (code) await this.reopen(code);
    }
    await this.withdrawAll(target.uid);
    for (const [k, s] of [...this.sessions]) if (s.uid === target.uid) await this.del(this.sessions, k, `s:${k}`);
    for (const m of this.chat.filter((m) => m.uid === target.uid)) await this.removeMessage(m.id);
    await this.match();
    await this.announce();
    return { ok: true };
  },
};

/** @param {InviteQueue} q */
function lowestFreeSeq(q) {
  // A requeued person goes before everyone still waiting.
  const waiting = [...q.entries.values()].map((e) => e.seq);
  let seq = waiting.length ? Math.min(...waiting) - 1 : q.meta.seq;
  while (q.entries.has(seq)) seq -= 1;
  return seq;
}

/** @param {ChatMessage} m */
const publicMessage = (m) => ({ id: m.id, uid: m.uid, name: m.name, text: m.text, at: m.at });

/** @param {unknown} v */
function cleanEmail(v) {
  const email = String(v ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) throw new QueueError(400, "email");
  return email;
}

/** @param {unknown} v */
const cleanLang = (v) => (LANGS.includes(String(v)) ? String(v) : "en");

/** @param {unknown} v @param {number} max @param {boolean} [lines] */
function cleanText(v, max, lines = false) {
  let s = String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "");
  s = lines ? s.replace(/\n{3,}/g, "\n\n") : s.replace(/\s+/g, " ");
  s = s.trim();
  return [...s].slice(0, max).join("");
}

/** @param {unknown} v */
function cleanCode(v) {
  const s = cleanText(v, CODE_MAX + 1);
  if (s.length < 4 || s.length > CODE_MAX) return "";
  // A link must be https; anything else is shown as text, never as a link.
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https:\/\/[^\s]+$/i.test(s)) return "";
  return s;
}

/** @param {string} uid */
const defaultName = (uid) => `Guest ${uid.slice(0, 4).toUpperCase()}`;

/** @param {number} n */
function randomInt(n) {
  const a = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  do crypto.getRandomValues(a);
  while (a[0] >= limit);
  return a[0] % n;
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** @param {number} n */
export function randomId(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** @param {string} s */
export async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** In-memory Storage, for this app's own server and tests. */
export class MemoryStorage {
  constructor() {
    /** @type {Map<string, any>} */
    this.data = new Map();
  }
  /** @param {string} key */
  async get(key) {
    return structuredClone(this.data.get(key));
  }
  /** @param {string} key @param {any} value */
  async put(key, value) {
    this.data.set(key, structuredClone(value));
  }
  /** @param {string | string[]} keys */
  async delete(keys) {
    for (const k of [keys].flat()) this.data.delete(k);
  }
  /** @param {{ prefix: string }} o */
  async list({ prefix }) {
    return new Map([...this.data].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)]));
  }
}
