// ═══════════════════════════════════════════════
// SERVICE WORKER — Groundhopper v34
// ═══════════════════════════════════════════════

const CACHE_NAME = 'groundhopper-v34';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/stadiums.js',
  '/manifest.json',
  '/icons/icon-512.png',
  '/icons/icon-192.png',
  '/icons/icon-96.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME && k !== 'groundhopper-tiles').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Laisser passer les polices Google directement au réseau (CORS géré par le navigateur)
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) return;

  // Tiles carte → cache
  if (
    url.hostname.includes('openstreetmap.org') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('stadiamaps.com') ||
    url.hostname.includes('arcgisonline.com')
  ) {
    event.respondWith(
      caches.open('groundhopper-tiles').then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const res = await fetch(event.request);
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        } catch { return new Response('', { status: 503 }); }
      })
    );
    return;
  }

  // Navigation HTML → réseau d'abord, cache en secours (offline)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Rafraîchir la copie en cache à chaque visite en ligne
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put('/index.html', clone));
          }
          return res;
        })
        .catch(async () =>
          (await caches.match(event.request)) ||
          (await caches.match('/index.html')) ||
          (await caches.match('/')) ||
          new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain' } })
        )
    );
    return;
  }

  // Assets statiques → cache d'abord
  if (
    url.hostname === self.location.hostname ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('fonts.g') ||
    url.hostname.includes('cdnjs.')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const net = fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        }).catch(() => cached || new Response('', { status: 503 }));
        return cached || net;
      })
    );
  }
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING' && event.source?.url?.startsWith(self.registration.scope)) {
    self.skipWaiting();
  }
});