import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { CHANNEL, CLAIM_COOLDOWN_MS, DNS_PREFIX, HOLD_MS, InviteQueue, MemoryStorage, NEW_DONOR_MAX_OPEN, STRIKES_BLOCK, USER_CHANNEL_PREFIX, VENDOR_PRODUCTS_MAX } from "../lib/invite-queue.js";

const PRODUCTS = [
  { id: "alpha", name: "Alpha beta" },
  { id: "game", name: "Game playtest" },
  { id: "cursor", name: "Cursor", hosts: ["cursor.com"] },
  { id: "pass", name: "Guest passes", uses: 3 },
];

function setup({ storage = new MemoryStorage(), clock = { t: 1_800_000_000_000 }, txt = {} } = {}) {
  const mails = [];
  const events = [];
  const hooks = [];
  const q = new InviteQueue({
    storage,
    products: PRODUCTS,
    admins: ["mod@example.com"],
    siteUrl: "https://demos.example/invite-queue/",
    now: () => clock.t,
    publish: async (channel, event, data) => events.push({ channel, event, data }),
    sendMail: async (m) => mails.push(m),
    fetch: async (url, init) => {
      hooks.push({ url, headers: init.headers, body: init.body });
      return { status: 204 };
    },
    resolveTxt: async (name) => txt[name] ?? [],
  });
  const call = (method, path, body, token, ip = "1.1.1.1") => q.handle({ method, path, body, token, ip });
  async function signIn(email, ip) {
    const start = await call("POST", "/auth/start", { email, lang: "zh-TW" }, "", ip);
    assert.equal(start.status, 200, JSON.stringify(start.body));
    const code = mails.findLast((m) => m.to === email && m.kind === "code").code;
    const res = await call("POST", "/auth/verify", { email, code, lang: "zh-TW" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.token;
  }
  return { q, call, signIn, mails, events, hooks, clock, storage, txt };
}

test("joining needs an email code", async () => {
  const { call, mails } = setup();
  assert.equal((await call("POST", "/queue/join", { products: ["alpha"] })).status, 401);
  assert.equal((await call("POST", "/auth/start", { email: "not an email" })).body.error, "email");
  await call("POST", "/auth/start", { email: "A@Example.com" });
  assert.equal(mails[0].to, "a@example.com");
  assert.match(mails[0].code, /^\d{6}$/);
  assert.equal((await call("POST", "/auth/verify", { email: "a@example.com", code: "000000" === mails[0].code ? "111111" : "000000" })).body.error, "code_wrong");
  const ok = await call("POST", "/auth/verify", { email: "a@example.com", code: mails[0].code });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token.length >= 32);
  // The same code works once.
  assert.equal((await call("POST", "/auth/verify", { email: "a@example.com", code: mails[0].code })).body.error, "code_expired");
  const joined = await call("POST", "/queue/join", { products: ["alpha"] }, ok.body.token);
  assert.equal(joined.status, 200);
  assert.equal(joined.body.me.entry.state, "waiting");
});

test("email codes are limited: one a minute, five tries", async () => {
  const { call, clock, mails } = setup();
  await call("POST", "/auth/start", { email: "b@example.com" });
  assert.equal((await call("POST", "/auth/start", { email: "b@example.com" })).body.error, "wait");
  clock.t += 61_000;
  await call("POST", "/auth/start", { email: "b@example.com" });
  const wrong = mails.at(-1).code === "123456" ? "654321" : "123456";
  for (let i = 0; i < 4; i++) assert.equal((await call("POST", "/auth/verify", { email: "b@example.com", code: wrong })).body.error, "code_wrong");
  assert.equal((await call("POST", "/auth/verify", { email: "b@example.com", code: wrong })).body.error, "code_expired");
  assert.equal((await call("POST", "/auth/verify", { email: "b@example.com", code: mails.at(-1).code })).body.error, "code_expired");
});

test("a given code goes to the first person in line who wants it, and only they see it", async () => {
  const { call, signIn, mails, events } = setup();
  const giver = await signIn("giver@example.com");
  const first = await signIn("first@example.com");
  const second = await signIn("second@example.com");
  const gamer = await signIn("gamer@example.com");
  await call("POST", "/queue/join", { products: ["game"] }, gamer);
  await call("POST", "/queue/join", { products: ["alpha"] }, first);
  await call("POST", "/queue/join", { products: ["alpha", "game"] }, second);
  assert.equal((await call("GET", "/state", undefined, second)).body.me.entry.ahead, 2);

  const gave = await call("POST", "/codes", { product: "alpha", codes: ["ALPHA-1234"] }, giver);
  assert.equal(gave.status, 200);
  const turn = mails.find((m) => m.kind === "turn");
  assert.equal(turn.to, "first@example.com");
  assert.equal(turn.product, "Alpha beta");
  assert.equal(turn.lang, "zh-TW");

  const state = await call("GET", "/state", undefined, first);
  assert.equal(state.body.me.entry.state, "offered");
  assert.equal(state.body.me.entry.offer.product, "alpha");
  assert.ok(!JSON.stringify(state.body).includes("ALPHA-1234"), "the code is not shown before it is taken");
  const uid = state.body.me.uid;
  assert.ok(events.some((e) => e.channel === USER_CHANNEL_PREFIX + uid && e.event === "me"));
  assert.ok(!JSON.stringify(events).includes("ALPHA-1234"), "codes never travel over channels");

  const took = await call("POST", "/offer/take", {}, first);
  assert.equal(took.body.code.value, "ALPHA-1234");
  assert.equal(took.body.me.taken[0].value, "ALPHA-1234");
  assert.equal(took.body.me.entry, null);
  assert.ok(events.some((e) => e.channel === CHANNEL && e.event === "state" && e.data.served === 1));
  // Other people still cannot see it.
  assert.ok(!JSON.stringify((await call("GET", "/state", undefined, second)).body).includes("ALPHA-1234"));
});

test("an offer not taken in time moves to the next person", async () => {
  const { call, signIn, clock } = setup();
  const giver = await signIn("giver@example.com");
  const late = await signIn("late@example.com");
  const next = await signIn("next@example.com");
  await call("POST", "/queue/join", { products: ["alpha"] }, late);
  await call("POST", "/queue/join", { products: ["alpha"] }, next);
  await call("POST", "/codes", { product: "alpha", codes: ["CODE-ONE"] }, giver);
  clock.t += HOLD_MS + 1;
  const s = await call("GET", "/state", undefined, next);
  assert.equal(s.body.me.entry.state, "offered");
  const gone = await call("GET", "/state", undefined, late);
  assert.equal(gone.body.me.entry, null);
  assert.equal((await call("POST", "/offer/take", {}, late)).body.error, "no_offer");
});

test("passing on an offer hands it on at once", async () => {
  const { call, signIn } = setup();
  const giver = await signIn("giver@example.com");
  const a = await signIn("a@example.com");
  const b = await signIn("b@example.com");
  await call("POST", "/queue/join", { products: ["alpha"] }, a);
  await call("POST", "/queue/join", { products: ["alpha"] }, b);
  await call("POST", "/codes", { product: "alpha", codes: ["CODE-PASS"] }, giver);
  await call("POST", "/offer/pass", {}, a);
  assert.equal((await call("GET", "/state", undefined, b)).body.me.entry.state, "offered");
});

test("givers never get their own code, and takers wait before joining again", async () => {
  const { call, signIn, clock } = setup();
  const a = await signIn("a@example.com");
  const b = await signIn("b@example.com");
  await call("POST", "/queue/join", { products: ["alpha"] }, a);
  await call("POST", "/codes", { product: "alpha", codes: ["MINE-1234"] }, a);
  assert.equal((await call("GET", "/state", undefined, a)).body.me.entry.state, "waiting");
  await call("POST", "/queue/join", { products: ["alpha"] }, b);
  await call("POST", "/offer/take", {}, b);
  assert.equal((await call("POST", "/queue/join", { products: ["alpha"] }, b)).body.error, "cooldown");
  clock.t += CLAIM_COOLDOWN_MS + 1;
  assert.equal((await call("POST", "/queue/join", { products: ["alpha"] }, b)).status, 200);
});

test("codes that do not work block their giver", async () => {
  const { call, signIn, clock } = setup();
  const giver = await signIn("giver@example.com");
  const takers = [];
  for (let i = 0; i < STRIKES_BLOCK; i++) takers.push(await signIn(`t${i}@example.com`));
  for (const [i, t] of takers.entries()) {
    // A new giver has one code out at a time.
    assert.equal((await call("POST", "/codes", { product: "game", codes: [`BAD-000${i}`] }, giver)).status, 200);
    await call("POST", "/queue/join", { products: ["game"] }, t);
    const took = await call("POST", "/offer/take", {}, t);
    assert.equal(took.status, 200, JSON.stringify(took.body));
    const rep = await call("POST", "/taken/report", { id: took.body.code.id, works: false }, t);
    assert.equal(rep.status, 200);
    clock.t += 1000;
  }
  const me = (await call("GET", "/state", undefined, giver)).body.me;
  assert.equal(me.blocked, true);
  assert.equal((await call("POST", "/codes", { product: "game", codes: ["MORE-0001"] }, giver)).body.error, "blocked");
  // The person who got a bad code is back in line, without the cooldown.
  const t0 = (await call("GET", "/state", undefined, takers[0])).body.me;
  assert.equal(t0.entry.state, "waiting");
  assert.equal(t0.cooldownUntil, 0);
});

test("codes must be text or https links", async () => {
  const { call, signIn } = setup();
  const g = await signIn("g@example.com");
  assert.equal((await call("POST", "/codes", { product: "alpha", codes: ["javascript:alert(1)"] }, g)).body.error, "code");
  assert.equal((await call("POST", "/codes", { product: "alpha", codes: ["abc"] }, g)).body.error, "code");
  assert.equal((await call("POST", "/codes", { product: "nope", codes: ["ABCD-1234"] }, g)).body.error, "products");
  assert.equal((await call("POST", "/codes", { product: "alpha", codes: ["https://example.com/invite/xyz"] }, g)).status, 200);
  assert.equal((await call("POST", "/codes", { product: "alpha", codes: ["https://example.com/invite/xyz"] }, g)).body.error, "duplicate");
});

test("a new giver has one code out until one is reported working", async () => {
  const { call, signIn } = setup();
  const giver = await signIn("new@example.com");
  const taker = await signIn("taker@example.com");
  assert.equal((await call("POST", "/codes", { product: "alpha", codes: ["ONE-0001", "TWO-0002"] }, giver)).body.error, "new_giver");
  assert.equal((await call("POST", "/codes", { product: "alpha", codes: ["ONE-0001"] }, giver)).status, 200);
  assert.equal((await call("POST", "/codes", { product: "alpha", codes: ["TWO-0002"] }, giver)).body.error, "new_giver");
  assert.equal((await call("GET", "/state", undefined, giver)).body.me.newGiver, true);
  await call("POST", "/queue/join", { products: ["alpha"] }, taker);
  const took = await call("POST", "/offer/take", {}, taker);
  await call("POST", "/taken/report", { id: took.body.code.id, works: true }, taker);
  const me = (await call("GET", "/state", undefined, giver)).body.me;
  assert.equal(me.newGiver, false);
  assert.equal((await call("POST", "/codes", { product: "alpha", codes: ["TWO-0002", "THREE-0003", "FOUR-0004"] }, giver)).status, 200);
  assert.ok(NEW_DONOR_MAX_OPEN < 3);
});

test("a code several people can use goes to each of them once", async () => {
  const { call, signIn } = setup();
  const giver = await signIn("giver@example.com");
  const people = [];
  for (let i = 0; i < 4; i++) people.push(await signIn(`p${i}@example.com`));
  // Counts as one code for a new giver, but fills three places.
  assert.equal((await call("POST", "/codes", { product: "pass", codes: ["https://example.com/pass/abc"] }, giver)).status, 200);
  assert.equal((await call("GET", "/state")).body.products.find((p) => p.id === "pass").uses, 3);
  assert.equal((await call("GET", "/state")).body.products.find((p) => p.id === "pass").open, 3);
  let me = (await call("GET", "/state", undefined, giver)).body.me;
  assert.equal(me.given.length, 1);
  assert.deepEqual([me.given[0].uses, me.given[0].taken, me.given[0].state], [3, 0, "open"]);
  // The first person takes one place and cannot be offered another.
  await call("POST", "/queue/join", { products: ["pass"] }, people[0]);
  const first = await call("POST", "/offer/take", {}, people[0]);
  assert.equal(first.body.code.value, "https://example.com/pass/abc");
  await call("POST", "/queue/join", { products: ["pass"] }, people[1]);
  await call("POST", "/queue/join", { products: ["pass"] }, people[2]);
  for (const p of [people[1], people[2]]) assert.equal((await call("GET", "/state", undefined, p)).body.me.entry.state, "offered");
  await call("POST", "/offer/take", {}, people[1]);
  me = (await call("GET", "/state", undefined, giver)).body.me;
  assert.deepEqual([me.given[0].taken, me.given[0].state], [2, "offered"]);
  // One "did not work" takes the rest off the queue and counts once.
  await call("POST", "/taken/report", { id: first.body.code.id, works: false }, people[0]);
  await call("POST", "/offer/take", {}, people[2]);
  const third = (await call("GET", "/state", undefined, people[2])).body.me.taken[0];
  await call("POST", "/taken/report", { id: third.id, works: false }, people[2]);
  me = (await call("GET", "/state", undefined, giver)).body.me;
  assert.equal(me.strikes, 1);
  assert.equal(me.given[0].report, "bad");
  await call("POST", "/queue/join", { products: ["pass"] }, people[3]);
  assert.equal((await call("GET", "/state", undefined, people[3])).body.me.entry.state, "waiting");
  // The person who got a bad place is back in line, but not for the same giver's code.
  assert.equal((await call("GET", "/state", undefined, people[0])).body.me.entry.state, "waiting");
});

test("a giver takes back the places nobody has yet", async () => {
  const { call, signIn } = setup();
  const giver = await signIn("giver@example.com");
  const taker = await signIn("taker@example.com");
  await call("POST", "/codes", { product: "pass", codes: ["PASS-0001"] }, giver);
  await call("POST", "/queue/join", { products: ["pass"] }, taker);
  await call("POST", "/offer/take", {}, taker);
  const id = (await call("GET", "/state", undefined, giver)).body.me.given[0].id;
  assert.equal((await call("POST", "/codes/withdraw", { id }, giver)).status, 200);
  const me = (await call("GET", "/state", undefined, giver)).body.me;
  assert.deepEqual([me.given[0].uses, me.given[0].taken, me.given[0].state], [1, 1, "taken"]);
  assert.equal((await call("GET", "/state")).body.products.find((p) => p.id === "pass").open, 0);
  assert.equal((await call("POST", "/codes/withdraw", { id }, giver)).body.error, "in_use");
});

test("a product's links must be on its own site", async () => {
  const { call, signIn } = setup();
  const g = await signIn("g@example.com");
  assert.equal((await call("POST", "/codes", { product: "cursor", codes: ["https://cursor.com.evil.example/r/x"] }, g)).body.error, "host");
  assert.equal((await call("POST", "/codes", { product: "cursor", codes: ["https://evil.example/cursor.com"] }, g)).body.error, "host");
  assert.equal((await call("POST", "/codes", { product: "cursor", codes: ["https://www.cursor.com/referral?code=ABCD1234"] }, g)).status, 200);
  const g2 = await signIn("g2@example.com");
  assert.equal((await call("POST", "/codes", { product: "cursor", codes: ["PLAIN-CODE-1"] }, g2)).status, 200);
  const products = (await call("GET", "/state")).body.products;
  assert.deepEqual(products.find((p) => p.id === "cursor").hosts, ["cursor.com"]);
});

test("chat: signed in, slowed down, hidden after reports, admins remove and ban", async () => {
  const { call, signIn, clock, events } = setup();
  const a = await signIn("a@example.com");
  const mod = await signIn("mod@example.com");
  assert.equal((await call("POST", "/chat", { text: "hi" })).status, 401);
  const sent = await call("POST", "/chat", { text: "  hello‮  " }, a);
  assert.equal(sent.body.message.text, "hello");
  assert.ok(events.some((e) => e.event === "chat" && e.data.text === "hello" && !("email" in e.data)));
  assert.equal((await call("POST", "/chat", { text: "again" }, a)).body.error, "slow_down");
  clock.t += 3001;
  await call("POST", "/me", { name: "Mei" }, a);
  const named = await call("POST", "/chat", { text: "second" }, a);
  assert.equal(named.body.message.name, "Mei");

  const reporters = [];
  for (let i = 0; i < 3; i++) reporters.push(await signIn(`r${i}@example.com`));
  for (const r of reporters) await call("POST", "/chat/report", { id: named.body.message.id }, r);
  assert.ok(!(await call("GET", "/state")).body.chat.some((m) => m.id === named.body.message.id));
  assert.ok(events.some((e) => e.event === "chat-removed" && e.data.id === named.body.message.id));

  assert.equal((await call("POST", "/admin/ban", { uid: "x" }, a)).body.error, "forbidden");
  const uid = sent.body.message.uid;
  assert.equal((await call("POST", "/admin/ban", { uid }, mod)).status, 200);
  assert.equal((await call("GET", "/state")).body.chat.length, 0);
  assert.equal((await call("POST", "/chat", { text: "back" }, a)).status, 401, "sessions end");
  assert.equal((await call("POST", "/auth/start", { email: "a@example.com" }, "", "9.9.9.9")).body.error, "banned");
});

test("state survives a restart from storage", async () => {
  const storage = new MemoryStorage();
  const clock = { t: 1_800_000_000_000 };
  const one = setup({ storage, clock });
  const giver = await one.signIn("giver@example.com");
  const a = await one.signIn("a@example.com");
  await one.call("POST", "/queue/join", { products: ["alpha"] }, a);
  await one.call("POST", "/codes", { product: "alpha", codes: ["KEEP-1234"] }, giver);
  const two = setup({ storage, clock });
  const s = await two.call("GET", "/state", undefined, a);
  assert.equal(s.body.me.entry.state, "offered");
  assert.equal((await two.call("POST", "/offer/take", {}, a)).body.code.value, "KEEP-1234");
  assert.ok(two.q.nextAlarm() > clock.t);
});

test("with a bot check, an email code needs a passed challenge", async () => {
  const mails = [];
  const seen = [];
  const q = new InviteQueue({
    storage: new MemoryStorage(),
    products: PRODUCTS,
    sendMail: async (m) => mails.push(m),
    verifyHuman: async (token, ip) => (seen.push([token, ip]), token === "pass"),
  });
  const start = (human) => q.handle({ method: "POST", path: "/auth/start", body: { email: "h@example.com", human }, token: "", ip: "2.2.2.2" });
  assert.equal((await start(undefined)).body.error, "human");
  assert.equal((await start("fail")).body.error, "human");
  assert.equal(mails.length, 0);
  assert.equal((await start("pass")).status, 200);
  assert.equal(mails.length, 1);
  assert.deepEqual(seen.at(-1), ["pass", "2.2.2.2"]);
});

test("product icons pass only as a shipped file name or an https URL", async () => {
  const q = new InviteQueue({
    storage: new MemoryStorage(),
    products: [
      { id: "a", name: "A", icon: "claude-code.png" },
      { id: "b", name: "B", icon: "https://cdn.example/b.svg" },
      { id: "c", name: "C", icon: "javascript:alert(1)" },
      { id: "d", name: "D", icon: "../secret.svg" },
    ],
  });
  await q.load();
  assert.deepEqual(q.counts().products.map((p) => p.icon), ["claude-code.png", "https://cdn.example/b.svg", "", ""]);
});

test("vendors: a company email verifies its domain; free mail needs DNS", async () => {
  const { call, signIn, txt, clock } = setup();
  const acme = await signIn("ops@acme.dev");
  assert.equal((await call("GET", "/vendor", undefined, acme)).body.vendor, null);
  const started = await call("POST", "/vendor/start", {}, acme);
  assert.deepEqual(started.body.vendor.verifiedDomains, ["acme.dev"]);
  // A product's sites must all be on verified domains.
  assert.equal((await call("POST", "/vendor/products", { name: "Acme", hosts: ["acme.dev", "evil.example"] }, acme)).body.error, "domain_unverified");
  const listed = await call("POST", "/vendor/products", { name: "Acme AI", hosts: ["https://app.acme.dev/join"], kind: "referral", names: { "zh-TW": "Acme 推薦碼" } }, acme);
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  assert.equal(listed.body.product, "acme-ai");
  const state = (await call("GET", "/state")).body;
  const p = state.products.find((x) => x.id === "acme-ai");
  assert.deepEqual([p.official, p.kind, p.hosts, p.names["zh-TW"]], [true, "referral", ["app.acme.dev"], "Acme 推薦碼"]);

  const solo = await signIn("founder@gmail.com");
  const v = (await call("POST", "/vendor/start", {}, solo)).body.vendor;
  assert.deepEqual(v.verifiedDomains, []);
  assert.equal((await call("POST", "/vendor/products", { name: "Solo", hosts: ["solo.app"] }, solo)).body.error, "domain_unverified");
  assert.equal((await call("POST", "/vendor/dns", { domain: "gmail.com" }, solo)).body.error, "domain");
  const asked = await call("POST", "/vendor/dns", { domain: "solo.app" }, solo);
  const record = asked.body.vendor.domains.find((d) => d.domain === "solo.app").record;
  assert.equal(record.name, DNS_PREFIX + "solo.app");
  assert.equal((await call("POST", "/vendor/dns", { domain: "solo.app" }, solo)).body.verified, false);
  txt[record.name] = ["v=other", record.value];
  assert.equal((await call("POST", "/vendor/dns", { domain: "solo.app" }, solo)).body.error, "wait");
  clock.t += 11_000;
  assert.equal((await call("POST", "/vendor/dns", { domain: "solo.app" }, solo)).body.verified, true);
  assert.equal((await call("POST", "/vendor/products", { name: "Solo", hosts: ["solo.app"] }, solo)).status, 200);
  // Someone else cannot take the name.
  assert.equal((await call("POST", "/vendor/products", { name: "Solo", hosts: ["acme.dev"] }, acme)).body.error, "taken_id");
});

test("vendors: take over a listed product on their domain, put codes in with an API key", async () => {
  const { call, signIn, hooks, q } = setup();
  const vendor = await signIn("team@cursor.com");
  await call("POST", "/vendor/start", {}, vendor);
  assert.equal((await call("POST", "/vendor/products", { id: "alpha" }, vendor)).body.error, "domain_unverified");
  const claimed = await call("POST", "/vendor/products", { id: "cursor" }, vendor);
  assert.equal(claimed.body.vendor.products[0].claimed, true);
  assert.equal((await call("GET", "/state")).body.products.find((p) => p.id === "cursor").official, true);
  // Another company cannot take it too.
  const other = await signIn("x@cursor.com");
  await call("POST", "/vendor/start", {}, other);
  assert.equal((await call("POST", "/vendor/products", { id: "cursor" }, other)).body.error, "claimed");

  const { key } = (await call("POST", "/vendor/key", {}, vendor)).body;
  assert.match(key, /^vk_/);
  assert.equal((await call("POST", "/vendor/key", {}, key)).status, 401);
  assert.equal((await call("POST", "/vendor/codes", { product: "cursor", codes: ["https://evil.example/x"] }, key)).body.error, "host");
  assert.equal((await call("POST", "/vendor/codes", { product: "alpha", codes: ["CODE-1234"] }, key)).body.error, "products");
  const codes = Array.from({ length: 20 }, (_, i) => `https://cursor.com/referral?code=${1000 + i}`);
  const added = await call("POST", "/vendor/codes", { product: "cursor", codes: codes.join("\n") }, key);
  assert.deepEqual([added.status, added.body.added], [200, 20]);
  assert.equal((await call("POST", "/vendor/codes", { product: "cursor", codes }, key)).body.duplicates, 20);
  assert.equal((await call("GET", "/vendor", undefined, key)).body.vendor.products[0].stats.open, 20);
  assert.equal((await call("GET", "/vendor", undefined, "vk_nope_" + "a".repeat(32))).status, 401);

  // Webhooks are https on a public name.
  for (const url of ["http://hooks.example.com/x", "https://localhost/x", "https://10.0.0.1/x", "https://user:pw@hooks.example.com/"]) {
    assert.equal((await call("POST", "/vendor/webhook", { url }, key)).body.error, "url", url);
  }
  const { secret } = (await call("POST", "/vendor/webhook", { url: "https://hooks.example.com/invites" }, key)).body;
  assert.match(secret, /^whsec_/);

  const taker = await signIn("t@example.com");
  await call("POST", "/queue/join", { products: ["cursor"] }, taker);
  const took = await call("POST", "/offer/take", {}, taker);
  assert.equal(took.status, 200);
  const hook = hooks.at(-1);
  assert.equal(hook.url, "https://hooks.example.com/invites");
  const event = JSON.parse(hook.body);
  assert.equal(event.type, "code.taken");
  assert.equal(event.data.value, took.body.code.value);
  const [, t, v1] = hook.headers["hibira-signature"].match(/^t=(\d+),v1=([0-9a-f]{64})$/);
  assert.equal(v1, createHmac("sha256", secret).update(`${t}.${hook.body}`).digest("hex"));

  // A bad report goes to the vendor, does not keep the taker away from the
  // vendor's other codes, and gives no strikes to anyone.
  await call("POST", "/taken/report", { id: took.body.code.id, works: false }, taker);
  assert.equal(JSON.parse(hooks.at(-1).body).type, "code.reported");
  assert.equal(JSON.parse(hooks.at(-1).body).data.works, false);
  const me = (await call("GET", "/state", undefined, taker)).body.me;
  assert.equal(me.entry.state, "offered");

  // Withdrawing and leaving: open codes go, the product goes back to the list.
  const back = await call("POST", "/vendor/codes/withdraw", { product: "cursor" }, key);
  assert.equal(back.body.removed, 18);
  await call("POST", "/vendor/products/remove", { id: "cursor" }, key);
  assert.equal((await call("GET", "/state")).body.products.find((p) => p.id === "cursor").official, false);
  assert.ok(q.products.some((p) => p.id === "cursor"));
});

test("vendors: codes running out, limits, and a moderator turning one off", async () => {
  const { call, signIn, hooks } = setup();
  const vendor = await signIn("a@acme.dev");
  await call("POST", "/vendor/start", {}, vendor);
  for (let i = 0; i < VENDOR_PRODUCTS_MAX; i++) assert.equal((await call("POST", "/vendor/products", { name: `Acme ${i}`, hosts: ["acme.dev"] }, vendor)).status, 200);
  assert.equal((await call("POST", "/vendor/products", { name: "One more", hosts: ["acme.dev"] }, vendor)).body.error, "too_many");
  await call("POST", "/vendor/webhook", { url: "https://hooks.acme.dev/x" }, vendor);
  await call("POST", "/vendor/codes", { product: "acme-0", codes: ["ACME-0001"] }, vendor);
  const a = await signIn("p1@example.com");
  const b = await signIn("p2@example.com");
  await call("POST", "/queue/join", { products: ["acme-0"] }, a);
  await call("POST", "/queue/join", { products: ["acme-0"] }, b);
  await call("POST", "/offer/take", {}, a);
  const types = hooks.map((h) => JSON.parse(h.body).type);
  assert.deepEqual(types.slice(-2), ["code.taken", "codes.empty"]);
  assert.equal(JSON.parse(hooks.at(-1).body).data.waiting, 1);

  const mod = await signIn("mod@example.com");
  const id = (await call("GET", "/vendor", undefined, vendor)).body.vendor.id;
  assert.equal((await call("POST", "/admin/vendor/disable", { id }, b)).body.error, "forbidden");
  assert.equal((await call("POST", "/admin/vendor/disable", { id }, mod)).status, 200);
  assert.equal((await call("GET", "/state")).body.products.some((p) => p.id.startsWith("acme-")), false);
  // b was waiting only for it, so b left the line.
  assert.equal((await call("GET", "/state", undefined, b)).body.me.entry, null);
  assert.equal((await call("GET", "/vendor", undefined, vendor)).body.vendor.disabled, true);
  assert.equal((await call("POST", "/vendor/codes", { product: "acme-1", codes: ["ACME-0002"] }, vendor)).body.error, "vendor_disabled");
});

test("vendors survive a restart", async () => {
  const storage = new MemoryStorage();
  const first = setup({ storage });
  const vendor = await first.signIn("a@acme.dev");
  await first.call("POST", "/vendor/start", {}, vendor);
  await first.call("POST", "/vendor/products", { name: "Acme", hosts: ["acme.dev"] }, vendor);
  await first.call("POST", "/vendor/products", { id: "cursor" }, vendor).catch(() => {});
  const second = setup({ storage });
  const state = (await second.call("GET", "/state")).body;
  assert.equal(state.products.find((p) => p.id === "acme").official, true);
});
