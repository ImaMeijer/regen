/* Service worker: app-schil offline beschikbaar. Data (Open-Meteo, Buienradar) gaat er bewust buiten om:
   de app bewaart zelf de laatste versie mét ophaaltijd en meldt het als die verouderd is.
   Bump CACHE bij elke release zodat oude schillen worden opgeruimd. */
const CACHE = 'regen-v33';
const SHELL = ['./', './index.html', './app.css', './app.js', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // netwerk eerst; zonder netwerk de laatst gecachte schil
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
