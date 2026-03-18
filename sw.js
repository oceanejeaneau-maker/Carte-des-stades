// ═══════════════════════════════════════════════
// SERVICE WORKER — Groundhopper v8
// ═══════════════════════════════════════════════

const CACHE_NAME = 'groundhopper-v8';

const PRECACHE_URLS = [
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

  // NE JAMAIS intercepter Firebase/Google Auth
  if (
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('firebase.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('accounts.google.com') ||
    url.pathname.startsWith('/__/')
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

  // Navigation HTML → TOUJOURS réseau, jamais cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
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
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
