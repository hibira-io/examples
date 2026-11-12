// Records the animated previews on the demos index (pages/gallery/<demo>.mp4):
// two browsers side by side using one demo against the live demo backend.
// The static build of the demos (the same tree .github/workflows/pages.yml
// deploys) is served as https://demos.hibira.io/examples/ so the demo
// backend accepts the origin, and the pages talk to the real ws.hibira.io.
//
//   node scripts/gallery/record.cjs <site dir> <demo> <work dir> [lang]
//   scripts/gallery/compose.sh <work dir> pages/gallery/<demo>.mp4
//
// <demo> is one of: lobby, dashboard, spaces, four, phaser, handoff, auction. The real mouse
// glides in 16 ms steps so the other side gets a dense cursor trail, and
// compose.sh keeps the 25 fps of the recording.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const [SITE, DEMO, DIR, LANG = 'en'] = process.argv.slice(2);
const ORIGIN = 'https://demos.hibira.io/examples/';
const W = 480;
const H = 700;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const code = (n, abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ') =>
  Array.from({ length: n }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
const uuid = () => require('crypto').randomUUID();

async function side(browser, name, init, width = W, extra = {}) {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    ...extra,
    viewport: { width, height: H },
    recordVideo: { dir: path.join(DIR, name), size: { width, height: H } },
  });
  await ctx.route(ORIGIN + '**', (route) => {
    let p = new URL(route.request().url()).pathname.replace('/examples/', '');
    if (p === '' || p.endsWith('/')) p += 'index.html';
    let f = path.join(SITE, p);
    if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ path: f });
  });
  await ctx.addInitScript(
    ([lang, entries]) => {
      localStorage.setItem('lang', lang);
      for (const [k, v] of entries) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
    },
    [LANG, Object.entries(init)],
  );
  const page = await ctx.newPage();
  return { ctx, page, width, born: Date.now(), mouse: { x: width / 2, y: H - 40 } };
}

async function glide(s, to, ms = 500) {
  const from = s.mouse;
  const steps = Math.max(2, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    await s.page.mouse.move(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
    await sleep(ms / steps);
  }
  s.mouse = to;
}
async function center(s, target, dx = 0, dy = 0) {
  const loc = typeof target === 'string' ? s.page.locator(target).first() : target;
  await loc.scrollIntoViewIfNeeded();
  const r = await loc.boundingBox();
  return { x: r.x + r.width / 2 + dx, y: r.y + r.height / 2 + dy };
}
async function click(s, target, ms = 450) {
  await glide(s, await center(s, target), ms);
  await sleep(120);
  await s.page.mouse.down();
  await sleep(60);
  await s.page.mouse.up();
}
async function type(s, text, ms = 90) {
  for (const ch of text) {
    await s.page.keyboard.insertText(ch);
    await sleep(ms);
  }
}
const player = (name) => JSON.stringify({ id: uuid(), name });

// The phone's camera for the handoff scene: a printed receipt on a table,
// drawn by the browser and turned into the y4m file Chromium's fake camera plays.
async function fakeCamera() {
  const png = path.join(DIR, 'receipt.png');
  const y4m = path.join(DIR, 'receipt.y4m');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 720, height: 1280 } });
  const row = (a, z) => `<div class="r"><span>${a}</span><span>${z}</span></div>`;
  await p.setContent(`<style>
    body{margin:0;width:720px;height:1280px;display:grid;place-items:center;
      background:repeating-linear-gradient(90deg,#5a3a22 0 38px,#634027 38px 41px,#573820 41px 90px);}
    .p{width:470px;padding:42px 40px 54px;background:#f7f3ea;transform:rotate(3deg);
      font:24px/1.45 'DejaVu Sans Mono',monospace;color:#222;box-shadow:0 18px 40px #0008}
    h1{font-size:38px;text-align:center;margin:0 0 6px;letter-spacing:2px}.c{text-align:center;font-size:19px}
    .r{display:flex;justify-content:space-between}hr{border:0;border-top:2px solid #333;margin:16px 0}
    .t{font-size:32px;font-weight:700}.bar{height:70px;margin:24px 0 10px;
      background:repeating-linear-gradient(90deg,#111 0 3px,transparent 3px 5px,#111 5px 6px,transparent 6px 10px)}
  </style><div class="p"><h1>HIBI RAMEN</h1><div class="c">Store #12 · Table 4<br>2026-11-10 12:41</div><hr>
    ${row('Tonkotsu Ramen', '¥980')}${row('Extra noodles', '¥210')}${row('Soft-boiled egg', '¥140')}${row('Green tea', '¥0')}<hr>
    ${row('Subtotal', '¥1,330')}${row('Discount', '-¥50')}<div class="r t"><span>TOTAL</span><span>¥1,280</span></div>
    <div class="c" style="text-align:left">Card **** 4821<br>Tax incl. (10%) ¥116</div><div class="bar"></div>
    <div class="c">Thank you!</div></div>`);
  await p.screenshot({ path: png });
  await b.close();
  require('child_process').execFileSync('ffmpeg', ['-v', 'error', '-y', '-loop', '1', '-i', png, '-t', '2', '-r', '15', '-pix_fmt', 'yuv420p', y4m]);
  return y4m;
}

const SCENES = {
  // Two players in one room: ready, start, the reaction round, a chat line.
  async lobby(b) {
    const room = code(4);
    const url = `${ORIGIN}nextjs-lobby/?room=${room}&lang=${LANG}`;
    const L = await side(b, 'left', { player: player('Jun') });
    const R = await side(b, 'right', { player: player('Dara') });
    await L.page.goto(url);
    await L.page.locator('.players li').first().waitFor();
    await R.page.goto('about:blank');
    const t0 = Date.now();
    await sleep(500);
    await R.page.goto(url);
    await L.page.locator('.players li').nth(1).waitFor();
    await R.page.locator('.players li').nth(1).waitFor();
    await sleep(500);
    await click(R, R.page.locator('.players + .row button').first());
    await sleep(500);
    await click(L, L.page.locator('.players + .row button').first());
    await sleep(400);
    await click(L, L.page.locator('.players + .row button.primary'));
    const play = async (s, delays) => {
      for (const ms of delays) {
        await s.page.locator('.pad.go').waitFor({ timeout: 8000 });
        await sleep(ms);
        await click(s, '.pad', 60);
        await s.page.locator('.pad.go').waitFor({ state: 'detached', timeout: 8000 });
      }
    };
    await Promise.all([play(L, [380, 120, 300]), play(R, [160, 360, 200])]);
    await sleep(600);
    await click(R, R.page.locator('.chat input'));
    await type(R, 'gg! again?', 85);
    await R.page.keyboard.press('Enter');
    await sleep(1600);
    return { L, R, t0 };
  },

  // One side runs the simulator; both dashboards draw the same ticks.
  async dashboard(b) {
    const url = `${ORIGIN}nextjs-dashboard/?lang=${LANG}`;
    const L = await side(b, 'left', {});
    const R = await side(b, 'right', {});
    await L.page.goto(url);
    await R.page.goto(url);
    await L.page.locator('.kpis').waitFor();
    await R.page.locator('.kpis').waitFor();
    await sleep(800);
    const t0 = Date.now();
    await sleep(500);
    await click(L, L.page.locator('.actions button').first(), 700);
    await glide(R, { x: W * 0.6, y: H * 0.55 }, 900);
    await sleep(6500);
    await glide(L, { x: W * 0.3, y: H * 0.7 }, 800);
    await sleep(2500);
    return { L, R, t0 };
  },

  // Live cursors, typing that syncs per character, field locks.
  async spaces(b) {
    const plan = code(5, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
    const url = `${ORIGIN}nextjs-spaces/?plan=${plan}&lang=${LANG}`;
    const L = await side(b, 'left', { 'planner-user': JSON.stringify({ id: 'rec-jun-' + plan, name: 'Jun', color: '#e5484d' }) });
    const R = await side(b, 'right', { 'planner-user': JSON.stringify({ id: 'rec-dara-' + plan, name: 'Dara', color: '#ffc53d' }) });
    await L.page.goto(url);
    await L.page.locator('.avatars li').first().waitFor();
    await R.page.goto('about:blank');
    const t0 = Date.now();
    await sleep(500);
    await R.page.goto(url);
    await R.page.locator('.avatars li').nth(1).waitFor();
    await L.page.locator('.avatars li').nth(1).waitFor();
    await sleep(400);
    const fields = (s) => s.page.locator('.board input, .board textarea');
    await glide(R, await center(R, fields(R).nth(0), 120, 30), 700);
    await click(L, fields(L).nth(0), 600);
    const drift = glide(R, { x: R.mouse.x - 110, y: R.mouse.y + 6 }, 1200);
    await type(L, 'Autumn in Tokyo', 110);
    await drift;
    await sleep(300);
    await click(L, fields(L).nth(1), 500);
    const follow = glide(R, await center(R, fields(R).nth(1), 130, 22), 900);
    await type(L, 'Tokyo · Hakone', 120);
    await follow;
    await glide(L, { x: L.mouse.x + 140, y: L.mouse.y + 14 }, 500);
    await click(R, fields(R).nth(2), 600);
    await type(R, '11/20 – 11/24', 110);
    await glide(R, { x: R.mouse.x + 110, y: R.mouse.y + 14 }, 500);
    await sleep(1400);
    return { L, R, t0 };
  },

  // Connect Four between two browsers over client events.
  async four(b) {
    const room = code(4);
    const url = `${ORIGIN}nextjs-games/four/?room=${room}&lang=${LANG}`;
    const L = await side(b, 'left', { player: player('Emi') });
    const R = await side(b, 'right', { player: player('Bao') });
    await L.page.goto(url);
    await L.page.locator('.four').waitFor();
    await R.page.goto('about:blank');
    const t0 = Date.now();
    await sleep(500);
    await R.page.goto(url);
    await R.page.locator('.four').waitFor();
    await L.page.locator('.four-card .players li, .players li').nth(1).waitFor();
    await sleep(600);
    const moves = [3, 3, 4, 4, 2, 5, 1];
    for (let i = 0; i < moves.length; i++) {
      const sides = [L, R];
      let mover = null;
      for (let tries = 0; tries < 60 && !mover; tries++) {
        for (const s of sides) if (await s.page.locator('.four.my-turn').count()) mover = s;
        if (!mover) await sleep(100);
      }
      if (!mover) break;
      await click(mover, mover.page.locator('.four-col').nth(moves[i]), 380);
      await sleep(450);
    }
    await sleep(2000);
    return { L, R, t0 };
  },

  // The Phaser lobby and the web lobby in one room.
  async phaser(b) {
    const room = code(4);
    const L = await side(b, 'left', { player: player('Hana') }, 600);
    const R = await side(b, 'right', { player: player('Indra') }, 360);
    await L.page.goto(`${ORIGIN}phaser-lobby/?room=${room}&lang=${LANG}`);
    await L.page.locator('canvas').waitFor();
    await sleep(2500);
    await R.page.goto('about:blank');
    const t0 = Date.now();
    await sleep(500);
    await R.page.goto(`${ORIGIN}nextjs-lobby/?room=${room}&lang=${LANG}`);
    await R.page.locator('.players li').nth(1).waitFor();
    await sleep(800);
    await click(R, R.page.locator('.chat input'));
    await type(R, 'hi from the web!', 85);
    await R.page.keyboard.press('Enter');
    await sleep(800);
    await click(R, R.page.locator('.players + .row button').first());
    await sleep(500);
    const box = await L.page.locator('canvas').boundingBox();
    const at = (gx, gy) => ({ x: box.x + (gx * box.width) / 960, y: box.y + (gy * box.height) / 640 });
    const tapAt = async (s, p, ms) => {
      await glide(s, p, ms);
      await sleep(80);
      await s.page.mouse.down();
      await sleep(60);
      await s.page.mouse.up();
    };
    await tapAt(L, at(110, 350), 600);
    await sleep(500);
    await tapAt(L, at(258, 350), 450);
    for (const [l, r] of [[150, 380], [360, 140], [170, 330]]) {
      await R.page.locator('.pad.go').waitFor({ timeout: 8000 });
      await Promise.all([sleep(l).then(() => tapAt(L, at(653, 230), 60)), sleep(r).then(() => click(R, '.pad', 60))]);
      await R.page.locator('.pad.go').waitFor({ state: 'detached', timeout: 8000 });
    }
    await sleep(1800);
    return { L, R, t0 };
  },
  // The auction house: a bid, an outbid on the other side, then buy now.
  async auction(b) {
    const url = `${ORIGIN}nextjs-auction/?lang=${LANG}`;
    const L = await side(b, 'left', { 'auction-player': JSON.stringify({ player: uuid(), name: 'Mei' }) });
    const R = await side(b, 'right', { 'auction-player': JSON.stringify({ player: uuid(), name: 'Jun' }) });
    await L.page.goto(url);
    await R.page.goto(url);
    await L.page.locator('.listings li .price-row').first().waitFor({ timeout: 20000 });
    await R.page.locator('.listings li .price-row').first().waitFor({ timeout: 20000 });
    // A listing both players can afford, with buy now and time left, in the
    // same place on both sides.
    const n = await L.page.locator('.listings li').evaluateAll((lis) =>
      lis.findIndex((li) => {
        const buy = li.querySelector('button.secondary');
        const price = Number(buy?.textContent.replace(/[^0-9]/g, '') || Infinity);
        return price <= 600 && !/^0:[0-5]/.test(li.innerText.match(/\d+:\d\d/)?.[0] ?? '');
      }),
    );
    const item = (s) => s.page.locator('.listings li').nth(Math.max(0, n));
    await item(L).scrollIntoViewIfNeeded();
    await item(R).scrollIntoViewIfNeeded();
    await sleep(800);
    const t0 = Date.now();
    await sleep(500);
    await click(L, item(L).locator('button.primary'), 700);
    await sleep(1400);
    await click(R, item(R).locator('button.primary'), 700);
    // The outbid side refreshes its wallet, which moves the cards a little.
    await L.page.locator('.toasts > *').first().waitFor({ timeout: 8000 });
    await sleep(1800);
    await click(L, item(L).locator('button.secondary'), 600);
    await sleep(2500);
    return { L, R, t0 };
  },
  // The handoff: a desktop expense form and a phone that scans its link and
  // shoots a receipt (Chromium's fake camera plays receipt.y4m, see FAKE_CAMERA).
  async handoff(b) {
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const L = await side(b, 'left', {}, 1040);
    const R = await side(b, 'right', {}, 360, { userAgent: iphone, isMobile: true, hasTouch: false });
    await L.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://demos.hibira.io' });
    await R.ctx.grantPermissions(['camera'], { origin: 'https://demos.hibira.io' });
    await L.page.goto(`${ORIGIN}nextjs-handoff/?lang=${LANG}`);
    await L.page.locator('.pair .qr svg').waitFor();
    await L.page.locator('.pair button.link').click();
    const link = await L.page.evaluate(() => navigator.clipboard.readText());
    await R.page.goto('about:blank');
    const t0 = Date.now();
    await sleep(600);
    await R.page.goto(link);
    await L.page.locator('.pair.paired').waitFor({ timeout: 15000 });
    await R.page.locator('.viewfinder video:not(.hidden)').waitFor({ timeout: 15000 });
    await sleep(1200);
    await click(L, L.page.locator('.form input').first());
    await type(L, 'Hibi Ramen', 80);
    await sleep(300);
    await click(R, '.shutter', 500);
    await L.page.locator('.receipt.landed').first().waitFor({ timeout: 20000 });
    await sleep(500);
    await click(L, L.page.locator('.form input').nth(1));
    await type(L, '1,280', 90);
    await click(L, L.page.locator('.form input').nth(2));
    await type(L, '2026-11-10', 60);
    await sleep(300);
    await click(R, '.shutter', 400);
    await L.page.locator('.receipt.landed').nth(1).waitFor({ timeout: 20000 });
    await sleep(1800);
    return { L, R, t0 };
  },
};

(async () => {
  if (!SCENES[DEMO]) throw new Error('unknown demo ' + DEMO);
  const args = DEMO === 'handoff' ? ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${await fakeCamera()}`] : [];
  const b = await chromium.launch({ args, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
  const { L, R, t0 } = await SCENES[DEMO](b);
  const tEnd = Date.now();
  if (process.env.SHOTS) {
    await L.page.screenshot({ path: path.join(DIR, 'left.png') });
    await R.page.screenshot({ path: path.join(DIR, 'right.png') });
  }
  await L.ctx.close();
  await R.ctx.close();
  await b.close();
  const vid = (n) => path.join(DIR, n, fs.readdirSync(path.join(DIR, n)).find((f) => f.endsWith('.webm')));
  fs.writeFileSync(
    path.join(DIR, 'timing.json'),
    JSON.stringify({
      left: vid('left'),
      right: vid('right'),
      leftStart: (t0 - L.born) / 1000,
      rightStart: (t0 - R.born) / 1000,
      duration: (tEnd - t0) / 1000,
      leftWidth: L.width,
      height: H,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
