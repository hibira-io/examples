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
//
// Vendors (the companies behind the products) can sign up themselves: a
// person signed in with a company email, or who adds a DNS TXT record, has
// verified that domain. With it they list their own product (or take over
// one that is already listed on their domain), put official codes in by the
// batch from the page or with an API key, and get webhooks when a code is
// taken or reported (see "Vendors" below).

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
// Until one of their codes is reported working, a giver has one code out at a time.
export const NEW_DONOR_MAX_OPEN = 1;
const GIVE_MAX = 5;
// One code can go to at most this many people (Product.uses).
const USES_MAX = 10;
const CODE_MAX = 300;
export const STRIKES_BLOCK = 3;
const CHAT_KEEP = 100;
const CHAT_MAX = 300;
const CHAT_GAP_MS = 3000;
const CHAT_REPORTS_HIDE = 3;
const NAME_MAX = 24;
const CLEANUP_MS = 60 * 60 * 1000;
export const VENDOR_PRODUCTS_MAX = 5;
export const VENDOR_BATCH_MAX = 1000;
export const VENDOR_OPEN_MAX = 5000;
const VENDOR_DNS_GAP_MS = 10_000;
const WEBHOOK_TIMEOUT_MS = 5000;
export const DNS_PREFIX = "_hibira-invite-queue.";
// Mail that anyone can sign up for proves nothing about a company.
const FREE_MAIL = new Set(
  "gmail.com googlemail.com outlook.com hotmail.com live.com msn.com yahoo.com yahoo.co.jp ymail.com icloud.com me.com mac.com aol.com gmx.com gmx.net mail.com proton.me protonmail.com pm.me tutanota.com zoho.com yandex.com yandex.ru hey.com fastmail.com qq.com foxmail.com 163.com 126.com yeah.net sina.com naver.com daum.net hanmail.net kakao.com outlook.jp hotmail.co.jp docomo.ne.jp ezweb.ne.jp gmail.co".split(" "),
);

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
 * @typedef {{ id: string, name: string, names?: Record<string, string>, icon?: string, hosts?: string[], kind?: "invite" | "referral", uses?: number, vendor?: string, hidden?: boolean, at?: number }} Product
 * @typedef {{ id: string, uid: string, at: number, dns: Record<string, { token: string, verified?: number }>, dnsChecked?: number, keyHash?: string, keyHint?: string, keyAt?: number, webhook?: { url: string, secret: string } | null, disabled?: boolean }} Vendor
 * @typedef {{ uid: string, email: string, name: string, lang: string, admin?: boolean, strikes: number, vouched?: number, blocked: boolean, banned: boolean, seen: number, cooldownUntil: number, reported: number }} User
 * @typedef {{ seq: number, uid: string, products: string[], at: number, state: "waiting" | "offered", codeId?: number, deadline?: number, requeued?: boolean, avoid?: string[] }} Entry
 * @typedef {{ id: number, product: string, value: string, donor: string, at: number, state: "open" | "offered" | "taken", seq?: number, taker?: string, takenAt?: number, report?: "ok" | "bad", vendor?: string, group?: number }} Code
 * @typedef {{ id: number, uid: string, name: string, text: string, at: number, reports: string[] }} ChatMessage
 */

export class InviteQueue {
  /**
   * @param {{ storage: Storage, products: Product[], publish?: (channel: string, event: string, data: unknown) => Promise<unknown>,
   *   sendMail?: (m: Mail) => Promise<unknown>, admins?: string[], siteUrl?: string, now?: () => number, random?: (n: number) => string,
   *   verifyHuman?: (token: string, ip: string) => Promise<boolean>, fetch?: typeof fetch,
   *   resolveTxt?: (name: string) => Promise<string[]> }} o
   *   verifyHuman, when given, checks the bot challenge (e.g. Cloudflare Turnstile) that the page
   *   sends as body.human before an email code goes out. fetch sends vendors' webhooks, and
   *   resolveTxt reads a domain's TXT records (by default both use the global fetch, the latter
   *   through Cloudflare's DNS over HTTPS).
   */
  constructor(o) {
    this.storage = o.storage;
    /** @type {Product[]} */ this.listed = o.products.filter((p) => p && /^[a-z0-9-]{1,40}$/.test(p.id) && p.name);
    /** @type {Product[]} */ this.products = this.listed;
    this.fetch = o.fetch ?? ((/** @type {any} */ url, /** @type {any} */ init) => fetch(url, init));
    this.resolveTxt = o.resolveTxt ?? ((/** @type {string} */ name) => dohTxt(this.fetch, name));
    /** @type {Map<string, Vendor>} */ this.vendors = new Map();
    /** @type {Map<string, Product>} */ this.vendorProducts = new Map();
    /** @type {Map<string, string>} */ this.claims = new Map();
    this.publish = o.publish ?? (async () => {});
    this.sendMail = o.sendMail ?? (async () => {});
    this.verifyHuman = o.verifyHuman ?? null;
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
    for (const [, v] of await get("v:")) this.vendors.set(v.id, v);
    for (const [, p] of await get("p:")) this.vendorProducts.set(p.id, p);
    for (const [k, c] of await get("pc:")) this.claims.set(k.slice(3), c.vendor);
    this.refreshProducts();
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
      const token = r.token ?? "";
      // An API key ("vk_…") stands for a vendor, not a person.
      const apiVendor = token.startsWith("vk_") ? await this.vendorByKey(token) : null;
      if (token.startsWith("vk_") && !apiVendor) throw new QueueError(401, "key");
      const user = apiVendor ? null : await this.session(token);
      if (user) this.touch(user);
      const body = r.body && typeof r.body === "object" ? r.body : {};
      return { status: 200, body: (await route.call(this, { body, user, ip: r.ip ?? "", token, apiVendor })) ?? { ok: true } };
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
      const e = line.find(
        (x) =>
          x.state === "waiting" &&
          x.products.includes(code.product) &&
          x.uid !== code.donor &&
          !x.avoid?.includes(code.donor) &&
          !this.users.get(x.uid)?.banned &&
          !this.hadGroup(x, code),
      );
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

  /**
   * Whether someone already took, or holds, another place of the same code
   * (a code that goes to several people goes to each person once).
   * @param {Entry} e @param {Code} code
   */
  hadGroup(e, code) {
    if (code.group === undefined) return false;
    for (const c of this.codes.values()) {
      if (c === code || groupOf(c) !== code.group) continue;
      if (c.taker === e.uid || (c.state === "offered" && c.seq === e.seq)) return true;
    }
    return false;
  }

  /** The open places of a code that goes to several people. @param {number} group */
  async dropOpenPlaces(group) {
    for (const c of [...this.codes.values()]) if (groupOf(c) === group && c.state === "open") await this.del(this.codes, c.id, `c:${c.id}`);
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
        icon: iconOf(p),
        hosts: hostsOf(p),
        kind: p.kind === "referral" ? "referral" : "invite",
        official: Boolean(p.vendor),
        uses: usesOf(p),
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
    /** @type {Map<number, Code[]>} */ const groups = new Map();
    for (const c of this.codes.values()) if (c.donor === u.uid) groups.set(groupOf(c), [...(groups.get(groupOf(c)) ?? []), c]);
    const given = [...groups].map(([id, cs]) => ({
      id,
      product: cs[0].product,
      state: cs.some((c) => c.state === "open") ? "open" : cs.some((c) => c.state === "offered") ? "offered" : "taken",
      at: cs[0].at,
      report: cs.some((c) => c.report === "bad") ? "bad" : cs.some((c) => c.report === "ok") ? "ok" : null,
      uses: cs.length,
      taken: cs.filter((c) => c.state === "taken").length,
    }));
    given.sort((a, b) => b.at - a.at || b.id - a.id);
    return {
      uid: u.uid,
      email: u.email,
      name: u.name,
      admin: Boolean(u.admin || this.admins.has(u.email)),
      banned: u.banned,
      blocked: u.blocked || u.banned,
      strikes: u.strikes,
      newGiver: !u.vouched && !this.isAdmin(u),
      cooldownUntil: u.cooldownUntil > now ? u.cooldownUntil : 0,
      entry,
      taken: taken.map((c) => ({ id: c.id, product: c.product, value: c.value, takenAt: c.takenAt, report: c.report ?? null, canReport: !c.report && now - (c.takenAt ?? 0) < REPORT_WINDOW_MS })),
      given,
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

  // ——— Vendors ———

  /** The listed products, then vendors' own; a vendor that took one over is noted on it. */
  refreshProducts() {
    const live = (/** @type {string | undefined} */ id) => {
      const v = id ? this.vendors.get(id) : undefined;
      return v && !v.disabled ? v.id : undefined;
    };
    const listed = this.listed.map((p) => ({ ...p, vendor: live(this.claims.get(p.id)) }));
    const ids = new Set(listed.map((p) => p.id));
    const own = [...this.vendorProducts.values()]
      .filter((p) => !p.hidden && !ids.has(p.id) && live(p.vendor))
      .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    this.products = [...listed, ...own];
  }

  /** @param {string} key */
  async vendorByKey(key) {
    if (!/^vk_[a-z0-9]{8,40}_[a-z0-9]{32}$/.test(key)) return null;
    const v = this.vendors.get(key.split("_")[1]);
    if (!v || v.disabled || !v.keyHash || v.keyHash !== (await sha256(key))) return null;
    return v;
  }

  /** The vendor a call acts for: its API key, or the signed-in person's vendor account. */
  vendorFor(/** @type {{ user: User | null, apiVendor: Vendor | null }} */ a) {
    if (a.apiVendor) return a.apiVendor;
    this.must(a.user);
    const v = [...this.vendors.values()].find((x) => x.uid === a.user?.uid);
    if (!v) throw new QueueError(404, "no_vendor");
    if (v.disabled) throw new QueueError(403, "vendor_disabled");
    return v;
  }

  /** Domains this vendor has shown are theirs: the owner's company email, and DNS records. @param {Vendor} v */
  domainsOf(v) {
    const out = Object.entries(v.dns)
      .filter(([, d]) => d.verified)
      .map(([domain]) => domain);
    const mail = mailDomain(this.users.get(v.uid)?.email ?? "");
    if (mail && !out.includes(mail)) out.unshift(mail);
    return out;
  }

  /** @param {Vendor} v */
  productsOf(v) {
    const own = [...this.vendorProducts.values()].filter((p) => p.vendor === v.id && !p.hidden);
    const claimed = this.listed.filter((p) => this.claims.get(p.id) === v.id);
    return [...claimed.map((p) => ({ ...p, claimed: true })), ...own.map((p) => ({ ...p, claimed: false }))];
  }

  /** @param {Vendor} v */
  vendorView(v) {
    const user = this.users.get(v.uid);
    const entries = [...this.entries.values()];
    const verified = new Set(this.domainsOf(v));
    const mail = mailDomain(user?.email ?? "");
    return {
      id: v.id,
      email: user?.email ?? "",
      disabled: Boolean(v.disabled),
      domains: [
        ...(mail ? [{ domain: mail, verified: true, via: "email" }] : []),
        ...Object.entries(v.dns)
          .filter(([domain]) => domain !== mail)
          .map(([domain, d]) => ({ domain, verified: Boolean(d.verified), via: "dns", record: { name: DNS_PREFIX + domain, value: `hibira-invite-queue=${d.token}` } })),
      ],
      products: this.productsOf(v).map((p) => {
        const codes = [...this.codes.values()].filter((c) => c.product === p.id && c.vendor === v.id);
        return {
          id: p.id,
          name: p.name,
          names: p.names ?? {},
          icon: iconOf(p),
          hosts: hostsOf(p),
          kind: p.kind === "referral" ? "referral" : "invite",
          claimed: p.claimed,
          editable: !p.claimed,
          stats: {
            open: codes.filter((c) => c.state === "open").length,
            offered: codes.filter((c) => c.state === "offered").length,
            taken: codes.filter((c) => c.state === "taken").length,
            ok: codes.filter((c) => c.report === "ok").length,
            bad: codes.filter((c) => c.report === "bad").length,
            waiting: entries.filter((e) => e.state === "waiting" && e.products.includes(p.id)).length,
          },
        };
      }),
      verifiedDomains: [...verified],
      key: v.keyHash ? { hint: v.keyHint ?? "", at: v.keyAt ?? 0 } : null,
      webhook: v.webhook ? { url: v.webhook.url } : null,
    };
  }

  /** @param {Vendor} v */
  async saveVendor(v) {
    this.vendors.set(v.id, v);
    await this.storage.put(`v:${v.id}`, v);
  }

  /**
   * Takes a product out of the line: its open and offered codes from this
   * vendor go, and people waiting only for it leave the line.
   * @param {string} productId @param {string} vendorId
   */
  async dropProduct(productId, vendorId) {
    for (const c of [...this.codes.values()]) {
      if (c.product !== productId || c.vendor !== vendorId || c.state === "taken") continue;
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
    if (this.listed.some((p) => p.id === productId)) return;
    for (const e of [...this.entries.values()]) {
      if (!e.products.includes(productId) || e.state !== "waiting") continue;
      e.products = e.products.filter((x) => x !== productId);
      if (e.products.length) await this.saveEntry(e);
      else await this.dropEntry(e);
      await this.notify(e.uid);
    }
  }

  /**
   * Posts one event to the vendor's webhook, signed like Hibira's other
   * webhooks: Hibira-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">.
   * Best effort: a failed delivery is not retried.
   * @param {string | undefined} vendorId @param {string} type @param {Record<string, unknown>} data
   * @returns {Promise<number>} the HTTP status, 0 when it did not answer
   */
  async deliver(vendorId, type, data) {
    const v = vendorId ? this.vendors.get(vendorId) : undefined;
    if (!v?.webhook || v.disabled) return 0;
    const now = this.now();
    const body = JSON.stringify({ id: `evt_${this.random(16)}`, type, created: Math.floor(now / 1000), data });
    const t = Math.floor(now / 1000);
    const sig = await hmacHex(v.webhook.secret, `${t}.${body}`);
    try {
      const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(WEBHOOK_TIMEOUT_MS) : undefined;
      const res = await this.fetch(v.webhook.url, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "Hibira-Invite-Queue/1", "hibira-signature": `t=${t},v1=${sig}` },
        body,
        redirect: "manual",
        signal,
      });
      return res.status;
    } catch {
      return 0;
    }
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
    if (this.verifyHuman) {
      const token = String(body.human ?? "").slice(0, 2048);
      if (!token || !(await this.verifyHuman(token, ip).catch(() => false))) throw new QueueError(403, "human");
    }
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
    if (code.vendor) {
      await this.deliver(code.vendor, "code.taken", { code_id: code.id, product: code.product, value: code.value, taken_at: now });
      const left = [...this.codes.values()].some((c) => c.product === code.product && c.vendor === code.vendor && c.state === "open");
      const waiting = [...this.entries.values()].filter((x) => x.state === "waiting" && x.products.includes(code.product)).length;
      if (!left && waiting) await this.deliver(code.vendor, "codes.empty", { product: code.product, waiting });
    }
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
    if (code.vendor) await this.deliver(code.vendor, "code.reported", { code_id: code.id, product: code.product, value: code.value, works: code.report === "ok" });
    if (code.report === "ok") {
      const donor = this.users.get(code.donor);
      if (donor) {
        donor.vouched = (donor.vouched ?? 0) + 1;
        await this.saveUser(donor);
      }
    }
    if (code.report === "bad") {
      // A code that went to several people counts once, and its places
      // that nobody has yet are taken off the queue.
      const again = code.group !== undefined && [...this.codes.values()].some((c) => c !== code && groupOf(c) === code.group && c.report === "bad");
      if (code.group !== undefined) await this.dropOpenPlaces(code.group);
      const donor = again ? undefined : this.users.get(code.donor);
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
        await this.saveEntry({ seq: lowestFreeSeq(this), uid: user.uid, products: [code.product], at: now, state: "waiting", requeued: true, ...(code.vendor ? {} : { avoid: [code.donor] }) });
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
    const product = this.products.find((p) => p.id === body.product);
    if (!product) throw new QueueError(400, "products");
    const cleaned = [...new Set((Array.isArray(body.codes) ? body.codes : [body.codes]).map((v) => cleanCode(v)).filter(Boolean))];
    if (!cleaned.length) throw new QueueError(400, "code");
    const known = new Set([...this.codes.values()].map((c) => `${c.product}\u0000${c.value}`));
    const values = cleaned.filter((v) => !known.has(`${product.id}\u0000${v}`));
    if (!values.length) throw new QueueError(409, "duplicate");
    // A link has to be on the product's own site, so a made-up or phishing
    // link never reaches anyone; a plain code passes.
    const hosts = hostsOf(product);
    if (hosts.length && values.some((v) => !linkOnHosts(v, hosts))) throw new QueueError(400, "host");
    if (values.length > GIVE_MAX) throw new QueueError(400, "too_many_codes");
    const mine = new Set([...this.codes.values()].filter((c) => c.donor === user.uid && c.state !== "taken").map((c) => groupOf(c))).size;
    if (!user.vouched && !this.isAdmin(user) && mine + values.length > NEW_DONOR_MAX_OPEN) throw new QueueError(409, "new_giver");
    if (mine + values.length > DONOR_MAX_OPEN) throw new QueueError(409, "too_many_codes");
    // A code that several people can use gets one place in the queue per person.
    const uses = usesOf(product);
    let added = 0;
    for (const value of values) {
      const at = this.now();
      const group = this.meta.code + 1;
      for (let i = 0; i < uses; i++) {
        this.meta.code += 1;
        await this.saveCode({ id: this.meta.code, product: body.product, value, donor: user.uid, at, state: "open", ...(uses > 1 ? { group } : {}) });
      }
      added += 1;
    }
    await this.saveMeta();
    await this.match();
    await this.announce();
    return { added, me: this.me(user) };
  },

  async "POST /codes/withdraw"({ body, user }) {
    this.must(user);
    const id = Number(body.id);
    const places = [...this.codes.values()].filter((c) => groupOf(c) === id && c.donor === user.uid);
    if (!places.length) throw new QueueError(404, "not_found");
    if (!places.some((c) => c.state === "open")) throw new QueueError(409, "in_use");
    await this.dropOpenPlaces(id);
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

  // ——— Vendors ———
  // A vendor account belongs to one signed-in person. Products, codes and
  // the stats are also open to the account's API key (Authorization:
  // Bearer vk_…), so a vendor's own systems can top codes up.

  async "GET /vendor"({ user, apiVendor }) {
    if (apiVendor) return { vendor: this.vendorView(apiVendor) };
    this.must(user);
    const v = [...this.vendors.values()].find((x) => x.uid === user.uid);
    const domain = mailDomain(user.email);
    return { vendor: v ? this.vendorView(v) : null, emailDomain: user.email.split("@")[1] ?? "", companyEmail: Boolean(domain) };
  },

  async "POST /vendor/start"({ user }) {
    this.must(user);
    if (user.blocked) throw new QueueError(403, "blocked");
    let v = [...this.vendors.values()].find((x) => x.uid === user.uid);
    if (!v) {
      v = { id: this.random(12), uid: user.uid, at: this.now(), dns: {}, webhook: null };
      await this.saveVendor(v);
    }
    return { vendor: this.vendorView(v) };
  },

  // A domain without a company email: add the TXT record this answers, then
  // call again to check it.
  async "POST /vendor/dns"({ body, user, apiVendor }) {
    const v = this.vendorFor({ user, apiVendor });
    const domain = cleanHost(body.domain);
    if (!domain || FREE_MAIL.has(domain)) throw new QueueError(400, "domain");
    if (!v.dns[domain]) {
      if (Object.keys(v.dns).length >= 10) throw new QueueError(409, "too_many");
      v.dns[domain] = { token: this.random(24) };
      await this.saveVendor(v);
      return { vendor: this.vendorView(v), verified: false };
    }
    if (v.dns[domain].verified) return { vendor: this.vendorView(v), verified: true };
    const now = this.now();
    if (now - (v.dnsChecked ?? 0) < VENDOR_DNS_GAP_MS) throw new QueueError(429, "wait");
    v.dnsChecked = now;
    const want = `hibira-invite-queue=${v.dns[domain].token}`;
    const records = await this.resolveTxt(DNS_PREFIX + domain).catch(() => []);
    if (records.some((r) => r.trim() === want)) v.dns[domain].verified = now;
    await this.saveVendor(v);
    return { vendor: this.vendorView(v), verified: Boolean(v.dns[domain].verified) };
  },

  // Lists a new product, edits one of the vendor's own, or takes over a
  // listed one whose site is on a domain the vendor has verified.
  async "POST /vendor/products"({ body, user, apiVendor }) {
    const v = this.vendorFor({ user, apiVendor });
    const domains = this.domainsOf(v);
    if (!domains.length) throw new QueueError(403, "domain_unverified");
    const id = String(body.id ?? "").trim().toLowerCase();
    const listed = this.listed.find((p) => p.id === id);
    if (listed) {
      const owner = this.claims.get(id);
      if (owner && owner !== v.id && this.vendors.get(owner) && !this.vendors.get(owner)?.disabled) throw new QueueError(409, "claimed");
      if (!hostsOf(listed).some((h) => covered(h, domains))) throw new QueueError(403, "domain_unverified");
      if (owner !== v.id) {
        if (this.productsOf(v).length >= VENDOR_PRODUCTS_MAX) throw new QueueError(409, "too_many");
        this.claims.set(id, v.id);
        await this.storage.put(`pc:${id}`, { vendor: v.id, at: this.now() });
        this.refreshProducts();
        await this.announce();
      }
      return { vendor: this.vendorView(v) };
    }
    const existing = id ? this.vendorProducts.get(id) : undefined;
    if (existing && (existing.vendor !== v.id || existing.hidden)) throw new QueueError(409, "taken_id");
    if (!existing && this.productsOf(v).length >= VENDOR_PRODUCTS_MAX) throw new QueueError(409, "too_many");
    const name = cleanText(body.name, 40);
    if (name.length < 2) throw new QueueError(400, "name");
    const hosts = [...new Set((Array.isArray(body.hosts) ? body.hosts : [body.hosts]).map(cleanHost).filter(Boolean))].slice(0, 5);
    if (!hosts.length) throw new QueueError(400, "host");
    if (!hosts.every((h) => covered(h, domains))) throw new QueueError(403, "domain_unverified");
    const icon = typeof body.icon === "string" && /^https:\/\/[^\s"'<>()\\]{1,300}$/.test(body.icon.trim()) ? body.icon.trim() : "";
    /** @type {Record<string, string>} */ const names = {};
    for (const lang of LANGS) {
      const n = cleanText(body.names?.[lang], 60);
      if (n.length >= 2) names[lang] = n;
    }
    const newId = existing?.id ?? slug(id || name);
    if (!existing && (!newId || this.products.some((p) => p.id === newId) || this.vendorProducts.has(newId))) throw new QueueError(409, "taken_id");
    /** @type {Product} */ const p = { id: newId, name, names, icon, hosts, kind: body.kind === "referral" ? "referral" : "invite", vendor: v.id, at: existing?.at ?? this.now() };
    this.vendorProducts.set(p.id, p);
    await this.storage.put(`p:${p.id}`, p);
    this.refreshProducts();
    await this.announce();
    return { vendor: this.vendorView(v), product: p.id };
  },

  async "POST /vendor/products/remove"({ body, user, apiVendor }) {
    const v = this.vendorFor({ user, apiVendor });
    const id = String(body.id ?? "");
    if (this.claims.get(id) === v.id) {
      this.claims.delete(id);
      await this.storage.delete(`pc:${id}`);
    } else {
      const p = this.vendorProducts.get(id);
      if (!p || p.vendor !== v.id || p.hidden) throw new QueueError(404, "not_found");
      p.hidden = true;
      await this.storage.put(`p:${p.id}`, p);
    }
    await this.dropProduct(id, v.id);
    this.refreshProducts();
    await this.match();
    await this.announce();
    return { vendor: this.vendorView(v) };
  },

  // A new API key; the old one stops working. The key is shown only here.
  async "POST /vendor/key"({ user }) {
    const v = this.vendorFor({ user, apiVendor: null });
    const key = `vk_${v.id}_${this.random(32)}`;
    v.keyHash = await sha256(key);
    v.keyHint = key.slice(-4);
    v.keyAt = this.now();
    await this.saveVendor(v);
    return { key, vendor: this.vendorView(v) };
  },

  // Where events go (https only; "" turns them off). A new signing secret
  // comes with each change and is shown only here.
  async "POST /vendor/webhook"({ body, user, apiVendor }) {
    const v = this.vendorFor({ user, apiVendor });
    const url = String(body.url ?? "").trim();
    if (!url) {
      v.webhook = null;
      await this.saveVendor(v);
      return { vendor: this.vendorView(v) };
    }
    if (!webhookUrl(url)) throw new QueueError(400, "url");
    v.webhook = { url, secret: `whsec_${this.random(32)}` };
    await this.saveVendor(v);
    return { secret: v.webhook.secret, vendor: this.vendorView(v) };
  },

  async "POST /vendor/webhook/test"({ user, apiVendor }) {
    const v = this.vendorFor({ user, apiVendor });
    if (!v.webhook) throw new QueueError(409, "no_webhook");
    return { status: await this.deliver(v.id, "webhook.test", { vendor: v.id }) };
  },

  // Official codes, by the batch. They go to the line like anyone's, without
  // the limits on new givers.
  async "POST /vendor/codes"({ body, user, apiVendor }) {
    const v = this.vendorFor({ user, apiVendor });
    const product = this.products.find((p) => p.id === body.product && p.vendor === v.id);
    if (!product) throw new QueueError(404, "products");
    const list = Array.isArray(body.codes) ? body.codes : String(body.codes ?? "").split(/\r?\n/);
    if (list.length > VENDOR_BATCH_MAX) throw new QueueError(400, "too_many_codes");
    const cleaned = [...new Set(list.map((x) => cleanCode(x)).filter(Boolean))];
    if (!cleaned.length) throw new QueueError(400, "code");
    const hosts = hostsOf(product);
    if (hosts.length && cleaned.some((x) => !linkOnHosts(x, hosts))) throw new QueueError(400, "host");
    const known = new Set([...this.codes.values()].filter((c) => c.product === product.id).map((c) => c.value));
    const values = cleaned.filter((x) => !known.has(x));
    const open = [...this.codes.values()].filter((c) => c.vendor === v.id && c.product === product.id && c.state !== "taken").length;
    if (open + values.length > VENDOR_OPEN_MAX) throw new QueueError(409, "too_many_codes");
    const now = this.now();
    for (const value of values) {
      this.meta.code += 1;
      await this.saveCode({ id: this.meta.code, product: product.id, value, donor: `vendor:${v.id}`, vendor: v.id, at: now, state: "open" });
    }
    await this.saveMeta();
    await this.match();
    await this.announce();
    return { added: values.length, duplicates: cleaned.length - values.length, vendor: this.vendorView(v) };
  },

  // Takes back the vendor's codes for a product that nobody holds yet.
  async "POST /vendor/codes/withdraw"({ body, user, apiVendor }) {
    const v = this.vendorFor({ user, apiVendor });
    let removed = 0;
    for (const c of [...this.codes.values()]) {
      if (c.vendor !== v.id || c.product !== body.product || c.state !== "open") continue;
      await this.del(this.codes, c.id, `c:${c.id}`);
      removed += 1;
    }
    await this.announce();
    return { removed, vendor: this.vendorView(v) };
  },

  async "POST /admin/vendor/disable"({ body, user }) {
    this.must(user);
    if (!this.isAdmin(user)) throw new QueueError(403, "forbidden");
    const v = this.vendors.get(String(body.id));
    if (!v) throw new QueueError(404, "not_found");
    v.disabled = true;
    await this.saveVendor(v);
    for (const p of this.productsOf(v)) await this.dropProduct(p.id, v.id);
    this.refreshProducts();
    await this.match();
    await this.announce();
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

/** A host name, from a domain or a link ("https://www.example.com/x" gives "www.example.com"). @param {unknown} v */
function cleanHost(v) {
  let s = String(v ?? "").trim().toLowerCase();
  if (/^https?:\/\//.test(s)) {
    try {
      s = new URL(s).hostname;
    } catch {
      return "";
    }
  }
  s = s.replace(/\.$/, "");
  return s.length <= 190 && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) && !/^[\d.]+$/.test(s) ? s : "";
}

/** The domain of a company email ("" for free mail). @param {string} email */
function mailDomain(email) {
  const d = email.split("@")[1] ?? "";
  return d && !FREE_MAIL.has(d) ? d : "";
}

/** Is host this domain or under it? @param {string} host @param {string[]} domains */
const covered = (host, domains) => domains.some((d) => host === d || host.endsWith("." + d));

/** @param {string} s */
function slug(s) {
  const out = s
    .slice(0, 200)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return out.length >= 2 ? out : "";
}

/** A webhook address: https on a public name, never this machine or a private address. @param {string} url */
function webhookUrl(url) {
  if (url.length > 500) return false;
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return false;
  return h.includes(".");
}

/** @param {string} secret @param {string} message */
async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** TXT records through Cloudflare's DNS over HTTPS. @param {typeof fetch} f @param {string} name */
async function dohTxt(f, name) {
  const res = await f(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, { headers: { accept: "application/dns-json" } });
  const data = /** @type {{ Answer?: { type: number, data: string }[] }} */ (await res.json());
  return (data.Answer ?? []).filter((a) => a.type === 16).map((a) => a.data.replace(/" "/g, "").replace(/^"|"$/g, ""));
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

/**
 * How many people one code of a product can go to.
 * @param {Product} p
 */
function usesOf(p) {
  const n = Math.floor(Number(p.uses));
  return n >= 1 ? Math.min(n, USES_MAX) : 1;
}

/**
 * The code a place in the queue belongs to: a code that goes to several
 * people has one place per person, all with the first place's id.
 * @param {Code} c
 */
function groupOf(c) {
  return c.group ?? c.id;
}

/**
 * The sites a product's invite links may point to ("cursor.com" also
 * allows www.cursor.com). Empty means any https link.
 * @param {Product} p
 */
function hostsOf(p) {
  return (Array.isArray(p.hosts) ? p.hosts : []).map((h) => String(h).toLowerCase()).filter((h) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h));
}

/**
 * Whether a given code is plain text, or a link on one of the hosts.
 * @param {string} v @param {string[]} hosts
 */
function linkOnHosts(v, hosts) {
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return true;
  let host = "";
  try {
    host = new URL(v).hostname.toLowerCase();
  } catch {
    return false;
  }
  return hosts.some((h) => host === h || host.endsWith("." + h));
}

/**
 * A product's icon as the page may show it: a file the page ships
 * (public/products/<name>.svg or .png) or an https URL. Anything else is
 * left out.
 * @param {Product} p
 */
function iconOf(p) {
  const icon = typeof p.icon === "string" ? p.icon : "";
  if (/^[a-z0-9-]{1,40}\.(svg|png)$/.test(icon)) return icon;
  if (/^https:\/\/[^\s"'<>()\\]{1,300}$/.test(icon)) return icon;
  return "";
}
