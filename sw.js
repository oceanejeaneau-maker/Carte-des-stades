// ═══════════════════════════════════════════════
// SERVICE WORKER — Carte des Stades
// Cache-first pour assets, network-first pour Firebase
// ═══════════════════════════════════════════════

const CACHE_NAME = 'stades-v3';
const CACHE_STATIC = 'stades-static-v3';

// Ressources à mettre en cache immédiatement
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  // Leaflet
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster-src.js',
  'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&family=Share+Tech+Mono&display=swap',
];

// ── Installation : pré-cache ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        // On essaie chaque ressource individuellement pour ne pas bloquer sur une erreur
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => console.warn('Cache miss:', url, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── Activation : nettoyer anciens caches ──────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie selon l'URL ─────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase, auth, Firestore → toujours réseau (pas de cache)
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.pathname.includes('/__/')
  ) {
    return; // laisser passer normalement
  }

  // Tiles de carte (OpenStreetMap, CartoDB, etc.) → cache puis réseau
  if (
    url.hostname.includes('tile.openstreetmap') ||
    url.hostname.includes('basemaps.cartocdn') ||
    url.hostname.includes('tiles.stadiamaps') ||
    url.hostname.includes('server.arcgisonline')
  ) {
    event.respondWith(cacheFirstWithFallback(event.request, 'stades-tiles-v1'));
    return;
  }

  // Assets statiques → cache d'abord, réseau si absent
  if (
    url.hostname === self.location.hostname ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('fonts.googleapis') ||
    url.hostname.includes('fonts.gstatic') ||
    url.hostname.includes('cdnjs.cloudflare') ||
    url.hostname.includes('flagcdn.com')
  ) {
    event.respondWith(cacheFirstWithFallback(event.request, CACHE_STATIC));
    return;
  }
});

// ── Helpers ───────────────────────────────────
async function cacheFirstWithFallback(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Hors ligne et pas en cache → page offline si c'est une navigation
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}
