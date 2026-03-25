const CACHE_NAME = 'msfc-v5';
const STATIC_ASSETS = [
  '/crypto-brunch/',
  '/crypto-brunch/index.html',
  '/crypto-brunch/manifest.json',
  '/crypto-brunch/icon-192.png',
  '/crypto-brunch/icon-512.png'
];

// Install - cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch - network first for API, cache first for static
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // API calls (binance, odaily) - network only, don't cache
  if (url.hostname.includes('binance.com') || 
      url.hostname.includes('allorigins') || 
      url.hostname.includes('corsproxy') ||
      url.hostname.includes('odaily')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      headers: {'Content-Type': 'application/json'}
    })));
    return;
  }
  
  // Static assets - cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match('/crypto-brunch/index.html'))
  );
});
