const CACHE_NAME = 'pushup-v10';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/vendor/chart.umd.min.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/apple-touch-icon.png',
  '/emom-timer.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Navigation requests (HTML pages) — cache-first, network fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).catch(() => {
          // Fallback to cached index.html or simple offline response
          return caches.match('/index.html').then((cachedIndex) => {
             return cachedIndex || new Response('Offline mode. Please connect to the internet.', {
                 status: 503,
                 statusText: 'Service Unavailable',
                 headers: new Headers({
                     'Content-Type': 'text/plain'
                 })
             });
          });
        });
      })
    );
    return;
  }

  // Static assets (cache-first)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
          // Check if we received a valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
          });
          return networkResponse;
      }).catch(() => {
          // General offline fallback
          return new Response('Offline', {
             status: 503,
             statusText: 'Service Unavailable'
          });
      });
    })
  );
});
