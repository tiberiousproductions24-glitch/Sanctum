// Sanctum service worker: offline-first cache for the app shell; network-first for content/banks.
const CACHE = 'sanctum-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/link')) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }
    catch { const m = await c.match(e.request); if (m) return m; throw new Error('offline'); }
  }));
});
