/* Strive service worker (live app + the demo at demo.html).
   Network-first for pages and code so a deploy shows up on the next open; cache-first for immutable
   media under /assets/. The API lives on another origin and is never cached here.
   MEDIA keeps the demo's cache name so its "Downloads" keep working offline. */
const SHELL = 'strive-live-v1';
const MEDIA = 'strive-media-v3';

const FILES = [
  './', './index.html', './manifest.webmanifest',
  './app/app.css', './app/main.js', './app/api.js', './app/state.js', './app/ui.js', './app/player.js',
  './app/recorder.js', './app/onboard.js', './app/fan.js', './app/studio.js',
  './assets/angela1.webp', './assets/angela2.webp', './assets/medals.jpg', './assets/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== MEDIA).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (/\/assets\/|\.(webp|jpg|jpeg|png|mp3|pdf)$/i.test(url.pathname)) {
    e.respondWith(caches.open(MEDIA).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
    return res;
  }).catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
