/* STRIVE service worker — makes the demo a real installable, offline-capable app.
   Strategy: network-first for code (deploys stay fresh), cache-first for immutable
   media (voice clips, images, PDFs). The fan "Downloads" feature pre-caches drop
   audio into VO_CACHE so it plays with no connection. */
const SHELL_CACHE = 'strive-shell-v1';
const VO_CACHE = 'strive-media-v2';

const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/ui.js', './js/data.js', './js/store.js', './js/vo.js', './js/api.js',
  './js/audio.js', './js/actions.js', './js/app.js',
  './js/fan/home.js', './js/fan/ask.js', './js/fan/discover.js', './js/fan/profile.js',
  './js/fan/lesson.js', './js/fan/library.js', './js/fan/you.js', './js/fan/tiers.js', './js/fan/invite.js',
  './js/athlete/home.js', './js/athlete/approve.js', './js/athlete/capture.js',
  './js/athlete/studio.js', './js/athlete/profile.js',
  './js/studio/overview.js', './js/studio/inbox.js', './js/studio/content.js',
  './js/studio/voice.js', './js/studio/scan.js', './js/studio/audience.js', './js/studio/earnings.js',
  './assets/angela1.webp', './assets/angela2.webp', './assets/medals.jpg', './assets/ci-logo.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(SHELL).catch(() => null)) // best effort; missing one file shouldn't block install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== VO_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API + CDN pass through

  // immutable media → cache-first (voice clips, images, drill sheets)
  if (/\/assets\/(vo|sheets)\//.test(url.pathname) || /\.(webp|jpg|png|mp3|pdf)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VO_CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }))
    );
    return;
  }

  // code + shell → network-first, cache fallback (offline still boots the app)
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() =>
      caches.match(e.request).then(hit => hit ||
        (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
    )
  );
});
