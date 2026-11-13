import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANNEL, CLAIM_COOLDOWN_MS, HOLD_MS, InviteQueue, MemoryStorage, STRIKES_BLOCK, USER_CHANNEL_PREFIX } from "../lib/invite-queue.js";

const PRODUCTS = [
  { id: "alpha", name: "Alpha beta" },
  { id: "game", name: "Game playtest" },
];

function setup({ storage = new MemoryStorage(), clock = { t: 1_800_000_000_000 } } = {}) {
  const mails = [];
  const events = [];
  const q = new InviteQueue({
    storage,
    products: PRODUCTS,
    admins: ["mod@example.com"],
    siteUrl: "https://demos.example/invite-queue/",
    now: () => clock.t,
    publish: async (channel, event, data) => events.push({ channel, event, data }),
    sendMail: async (m) => mails.push(m),
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
  return { q, call, signIn, mails, events, clock, storage };
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
  await call("POST", "/codes", { product: "game", codes: ["BAD-0001", "BAD-0002", "BAD-0003", "BAD-0004"] }, giver);
  for (const t of takers) {
    await call("POST", "/queue/join", { products: ["game"] }, t);
    const took = await call("POST", "/offer/take", {}, t);
    assert.equal(took.status, 200, JSON.stringify(took.body));
    const rep = await call("POST", "/taken/report", { id: took.body.code.id, works: false }, t);
    assert.equal(rep.status, 200);
    clock.t += 1000;
  }
  const me = (await call("GET", "/state", undefined, giver)).body.me;
  assert.equal(me.blocked, true);
  assert.equal(me.given.filter((c) => c.state === "open").length, 0, "the rest are withdrawn");
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
