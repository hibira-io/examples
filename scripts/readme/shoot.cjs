// Takes the README screenshots of the Next.js demos from the hosted copies
// on demos.hibira.io, with two browsers in one room where the demo needs
// another person, so every shot shows the live service at work.
//
//   node scripts/readme/shoot.cjs [demo ...]
//
// LOCAL=<example>=<dir> serves that example from a local static build
// (DEMO_BASE_PATH=/examples/<example>, NEXT_PUBLIC_DEMO_API set) instead of
// the deployed copy, for a change not live yet.
//
// Writes <example>/screenshot.png at 2x. Demos: dashboard, lobby, spaces,
// games, auction, handoff, sql, queue.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ORIGIN = 'https://demos.hibira.io/examples/';
const ROOT = path.join(__dirname, '..', '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const code = (n, abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ') => Array.from({ length: n }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
const uuid = () => require('crypto').randomUUID();
const player = (name) => JSON.stringify({ id: uuid(), name });

async function side(b, init, viewport = { width: 1280, height: 860 }, extra = {}) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 2, ...extra });
  const [app, dir] = (process.env.LOCAL || '').split('=');
  if (app && dir) {
    await ctx.route(`${ORIGIN}${app}/**`, (route) => {
      let p = new URL(route.request().url()).pathname.replace(`/examples/${app}/`, '');
      if (p === '' || p.endsWith('/')) p += 'index.html';
      const f = path.join(dir, p);
      if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
      route.fulfill({ path: f });
    });
  }
  await ctx.addInitScript((entries) => {
    localStorage.setItem('lang', 'en');
    for (const [k, v] of entries) localStorage.setItem(k, v);
  }, Object.entries(init));
  return { ctx, page: await ctx.newPage() };
}
const shot = (s, example, opts = {}) => s.page.screenshot({ path: path.join(ROOT, example, 'screenshot.png'), ...opts });

const SCENES = {
  async dashboard(b) {
    const L = await side(b, {}, { width: 1280, height: 1000 });
    const R = await side(b, {});
    const url = `${ORIGIN}nextjs-dashboard/?lang=en`;
    await Promise.all([L.page.goto(url), R.page.goto(url)]);
    await L.page.locator('.kpis').waitFor();
    await sleep(1500);
    await L.page.locator('.actions button').first().click();
    await sleep(14000);
    await shot(L, 'nextjs-dashboard');
  },
  async lobby(b) {
    const room = code(4);
    const url = `${ORIGIN}nextjs-lobby/?room=${room}&lang=en`;
    const L = await side(b, { player: player('Alice') }, { width: 1280, height: 640 });
    const R = await side(b, { player: player('Bob') });
    await L.page.goto(url);
    await L.page.locator('.players li').first().waitFor();
    await R.page.goto(url);
    await L.page.locator('.players li').nth(1).waitFor();
    await sleep(800);
    await R.page.locator('.players + .row button').first().click();
    await sleep(400);
    await R.page.locator('.chat input').fill('gl hf');
    await R.page.keyboard.press('Enter');
    await sleep(400);
    await L.page.locator('.players + .row button').first().click();
    await sleep(400);
    await L.page.locator('.players + .row button.primary').click();
    await L.page.locator('.pad.go').waitFor({ timeout: 10000 });
    await shot(L, 'nextjs-lobby');
  },
  async spaces(b) {
    const plan = code(5, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
    const url = `${ORIGIN}nextjs-spaces/?plan=${plan}&lang=en`;
    const user = (name, color) => ({ 'planner-user': JSON.stringify({ id: `shot-${name}-${plan}`, name, color }) });
    const A = await side(b, user('Ana', '#e5484d'), { width: 1000, height: 640 });
    const C = await side(b, user('Chen', '#3e63dd'));
    const D = await side(b, user('Dara', '#ffc53d'));
    for (const s of [A, C, D]) await s.page.goto(url);
    await A.page.locator('.avatars li').nth(2).waitFor({ timeout: 15000 });
    const fields = (s) => s.page.locator('.board input, .board textarea');
    await fields(A).nth(0).fill('Tokyo in spring');
    await fields(D).nth(1).click();
    await D.page.keyboard.insertText('Tokyo, Kyoto');
    await sleep(500);
    await A.page.mouse.click(5, 600);
    await fields(C).nth(2).click();
    await C.page.keyboard.insertText('Apr 3 – Apr 10');
    await D.page.mouse.move(420, 330);
    await C.page.mouse.move(380, 470);
    await sleep(2500);
    await shot(A, 'nextjs-spaces');
  },
  async games(b) {
    const room = code(4);
    const url = `${ORIGIN}nextjs-games/four/?room=${room}&lang=en`;
    const L = await side(b, { player: player('Emi') }, { width: 1280, height: 900 });
    const R = await side(b, { player: player('Bao') });
    await L.page.goto(url);
    await L.page.locator('.four').waitFor();
    await R.page.goto(url);
    await R.page.locator('.four').waitFor();
    await sleep(1500);
    for (const col of [3, 3, 4, 4, 2, 5]) {
      let mover = null;
      for (let i = 0; i < 80 && !mover; i++) {
        for (const s of [L, R]) if (await s.page.locator('.four.my-turn').count()) mover = s;
        if (!mover) await sleep(100);
      }
      if (!mover) break;
      await mover.page.locator('.four-col').nth(col).click();
      await sleep(700);
    }
    await sleep(1200);
    await shot(L, 'nextjs-games');
  },
  async auction(b) {
    const url = `${ORIGIN}nextjs-auction/?lang=en`;
    const L = await side(b, { 'auction-player': JSON.stringify({ player: uuid(), name: 'Mei' }) }, { width: 1280, height: 900 });
    const R = await side(b, { 'auction-player': JSON.stringify({ player: uuid(), name: 'Jun' }) });
    await Promise.all([L.page.goto(url), R.page.goto(url)]);
    await L.page.locator('.listings li .price-row').first().waitFor({ timeout: 60000 });
    await R.page.locator('.listings li .price-row').first().waitFor({ timeout: 60000 });
    await sleep(1000);
    await L.page.locator('.listings li').first().locator('button.primary').click();
    await sleep(1500);
    await R.page.locator('.listings li').first().locator('button.primary').click();
    await L.page.locator('.toasts > *').first().waitFor({ timeout: 10000 }).catch(() => {});
    await sleep(800);
    await shot(L, 'nextjs-auction');
  },
  async sql(b) {
    const L = await side(b, {}, { width: 1280, height: 860 });
    await L.page.goto(`${ORIGIN}nextjs-sql-approvals/?lang=en`);
    await L.page.locator('button.chip').first().waitFor();
    await sleep(1500);
    await L.page.locator('button.chip', { hasText: 'Clear carts' }).click();
    await sleep(500);
    await L.page.locator('main button.primary').filter({ hasText: /approval/i }).click();
    await L.page.locator('.qr svg, svg').first().waitFor();
    await sleep(3000);
    await shot(L, 'nextjs-sql-approvals', { fullPage: true });
  },
  // The invite queue on hibira.io, where it is shared from; the cookie
  // question is answered so the page shows what a returning visitor sees.
  async queue(b) {
    const L = await side(b, { 'portal.analytics-consent': 'denied' }, { width: 1200, height: 900 });
    await L.page.goto('https://hibira.io/tools/invite-queue/?lang=zh-TW', { waitUntil: 'networkidle' });
    await L.page.locator('.hero-globe canvas').waitFor({ timeout: 15000 }).catch(() => {});
    await sleep(4000);
    await shot(L, 'nextjs-invite-queue');
  },
  async handoff(b) {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-'));
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const L = await side(b, {}, { width: 1040, height: 700 });
    const R = await side(b, {}, { width: 360, height: 700 }, { userAgent: iphone, isMobile: true });
    await L.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://demos.hibira.io' });
    await R.ctx.grantPermissions(['camera'], { origin: 'https://demos.hibira.io' });
    await L.page.goto(`${ORIGIN}nextjs-handoff/?lang=en`);
    await L.page.locator('.pair .qr svg').waitFor();
    await L.page.locator('.pair button.link').click();
    const link = await L.page.evaluate(() => navigator.clipboard.readText());
    await R.page.goto(link);
    await L.page.locator('.pair.paired').waitFor({ timeout: 15000 });
    await R.page.locator('.viewfinder video:not(.hidden)').waitFor({ timeout: 15000 });
    await sleep(1500);
    await L.page.locator('.form input').nth(0).fill('Hibi Ramen');
    await L.page.locator('.form input').nth(1).fill('1,280');
    await L.page.locator('.form input').nth(2).fill('2026-11-10');
    await R.page.locator('.shutter').click();
    await L.page.locator('.receipt.landed').first().waitFor({ timeout: 20000 });
    await sleep(800);
    await R.page.locator('.shutter').click();
    await L.page.locator('.receipt.landed').nth(1).waitFor({ timeout: 20000 });
    await sleep(1500);
    const lp = path.join(work, 'l.png');
    const rp = path.join(work, 'r.png');
    await L.page.screenshot({ path: lp });
    await R.page.screenshot({ path: rp });
    // Desktop and phone side by side, as one picture.
    const c = await b.newPage({ viewport: { width: 1406, height: 700 }, deviceScaleFactor: 2 });
    const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
    await c.setContent(`<body style="margin:0;display:flex;gap:6px;background:#2b2b2b"><img src="${data(lp)}" width="1040" height="700"><img src="${data(rp)}" width="360" height="700"></body>`);
    await c.screenshot({ path: path.join(ROOT, 'nextjs-handoff', 'screenshot.png') });
  },
};

(async () => {
  const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES);
  for (const name of want) {
    const args = name === 'handoff' ? ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', ...(process.env.FAKE_CAMERA ? [`--use-file-for-fake-video-capture=${process.env.FAKE_CAMERA}`] : [])] : [];
    // The invite queue's globe is WebGL: software GL in a headless browser.
    if (name === 'queue') args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist');
    const b = await chromium.launch({ args });
    try {
      await SCENES[name](b);
      console.log('ok', name);
    } catch (e) {
      console.log('FAIL', name, e.message.split('\n')[0]);
    }
    await b.close();
  }
})();
