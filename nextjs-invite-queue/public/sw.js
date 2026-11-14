// The invite queue's service worker: it keeps the page's shell (its HTML,
// scripts, styles and images) so the installed app opens at once and still
// opens offline. The line, the chat and sign-in always come from the
// network: requests to other origins and anything that is not a GET pass
// straight through.

const CACHE = 'invite-queue-v1';
const SCOPE = new URL(self.registration.scope).pathname;
// On hibira.io a language's page has the site's language prefix
// (/ja/tools/invite-queue/), but its build files are the same ones, under
// the path without it.
const BASE = SCOPE.replace(/^\/(zh-tw|zh-cn|ja|ko|th|vi)(?=\/tools\/)/, '');

// The three pages and the build files they load, so the first visit
// already leaves a shell that opens offline.
async function saveShell() {
  const c = await caches.open(CACHE);
  const pages = [SCOPE, SCOPE + 'get/', SCOPE + 'give/'];
  await c.addAll(pages);
  const files = new Set();
  for (const page of pages) {
    const html = await (await c.match(page)).text();
    for (const m of html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)) files.add(new URL(m[1], location.origin).pathname);
  }
  await c.addAll([...files]);
}

self.addEventListener('install', (e) => {
  e.waitUntil(saveShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('invite-queue-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || !(url.pathname.startsWith(SCOPE) || url.pathname.startsWith(BASE))) return;

  // Pages: the network first, so a new version shows as soon as it is out;
  // the saved copy when offline.
  if (req.mode === 'navigate' && url.pathname.startsWith(SCOPE)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() => caches.match(url.pathname).then((hit) => hit || caches.match(SCOPE))),
    );
    return;
  }

  // Build files have their hash in the name and never change; icons and
  // images change rarely. Saved copy first, filled from the network.
  if (/\/_next\/static\/|\.(png|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
