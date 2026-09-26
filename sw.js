const CACHE = 'ilha-da-magia-v6';

const CORE = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './sw.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(async cache => {
        for (const url of CORE) {
          try {
            await cache.add(url);
          } catch (error) {
            console.warn('[Ilha da Magia] No se pudo precachear:', url, error);
          }
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE)
          .then(cache => cache.put(event.request, copy))
          .catch(() => {});
        return response;
      })
      .catch(() =>
        caches.match(event.request)
          .then(cached => cached || caches.match('./index.html'))
      )
  );
});
