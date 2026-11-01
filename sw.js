/* Service worker: app-schil offline beschikbaar, data altijd eerst van het netwerk.
   Bump CACHE bij elke release zodat oude schillen worden opgeruimd. */
const CACHE = 'regen-v7';
const SHELL = ['./', './index.html', './app.css', './app.js', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // netwerk eerst; bij geen netwerk de laatste gecachte versie (ook voor API-antwoorden, zodat de laatste data zichtbaar blijft)
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && (url.origin === self.location.origin || url.hostname.endsWith('open-meteo.com') || url.hostname.endsWith('buienradar.nl'))) {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: url.origin === self.location.origin }))
  );
});
