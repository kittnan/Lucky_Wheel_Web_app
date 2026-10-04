/* Lucky Wheel service worker — makes the app work with no internet after the first visit.
   Bump VER when you change vendor/ or fonts/ files so browsers re-download them. */
const VER = 'lucky-wheel-v1';
const FONTS = ['cinzel-500-latin', 'cinzel-700-latin', 'cinzel-900-latin']
  .concat(['300', '400', '500', '600', '700'].flatMap(w => [`kanit-${w}-latin`, `kanit-${w}-thai`]))
  .map(f => `fonts/${f}.woff2`);
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'vendor/xlsx.full.min.js', 'fonts/fonts.css', ...FONTS];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || req.url.endsWith('/index.html');
  if (isPage) {                                   // pages: network first (always get the newest deploy), cache as fallback
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VER).then(c => c.put('index.html', copy)); return r; })
      .catch(() => caches.match('index.html').then(r => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const copy = r.clone(); caches.open(VER).then(c => c.put(req, copy)); return r; })));
});
