// ═══════════════════════════════════════════════
// SERVICE WORKER — Carte des Stades v4
// ═══════════════════════════════════════════════

const CACHE_NAME = 'stades-v4';

const PRECACHE_URLS = ['/index.html', '/manifest.json', '/icon.svg'];

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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME && k !== 'stades-tiles').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ⛔ NE JAMAIS cacher Firebase/Google
  if (
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('firebase.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.pathname.startsWith('/__/')
  ) return;

  // Tiles carte → cache
  if (url.hostname.includes('openstreetmap.org') || url.hostname.includes('cartocdn.com') ||
      url.hostname.includes('stadiamaps.com') || url.hostname.includes('arcgisonline.com')) {
    event.respondWith(
      caches.open('stades-tiles').then(async cache => {
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

  // Navigation HTML → réseau d'abord
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => { if (res.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone())); return res; })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets statiques → cache d'abord
  if (url.hostname === self.location.hostname ||
      url.hostname.includes('unpkg.com') || url.hostname.includes('fonts.g') ||
      url.hostname.includes('cdnjs.') || url.hostname.includes('flaticon.com') ||
      url.hostname.includes('flagcdn.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const net = fetch(event.request)
          .then(res => { if (res.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone())); return res; })
          .catch(() => cached || new Response('', {status: 503}));
        return cached || net;
      })
    );
  }
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
