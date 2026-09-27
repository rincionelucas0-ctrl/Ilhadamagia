const CACHE = 'ilha-da-magia-v8';

// Solo recursos locales de la aplicación. Nunca guardar respuestas de Supabase/Auth
// ni URLs firmadas, porque pueden contener datos privados o quedar obsoletas.
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './offline.html',
  './apple-touch-icon.png',
];

function isSupabaseRequest(request) {
  try {
    const url = new URL(request.url);
    return url.hostname.endsWith('.supabase.co') || url.hostname.includes('supabase');
  } catch (_) {
    return false;
  }
}

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (_) {
    return false;
  }
}

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
  const request = event.request;
  if (request.method !== 'GET') return;

  // Supabase/Auth/storage siempre van directo a red.
  if (isSupabaseRequest(request)) return;

  // El navegador no debe cachear recursos de terceros desde este SW.
  if (!isSameOrigin(request)) return;

  const url = new URL(request.url);

  // Navegación: primero red para recibir versiones nuevas; si no hay red,
  // usar el shell guardado y, como último recurso, la pantalla offline.
  if (request.mode === 'navigate') {
    const isAppShell = url.pathname === new URL('./', self.location).pathname || url.pathname.endsWith('/index.html');
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok && isAppShell) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put('./index.html', copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => isAppShell
          ? caches.match('./index.html').then(cached => cached || caches.match('./offline.html'))
          : caches.match('./offline.html')
        )
    );
    return;
  }

  // Solo cachear recursos locales estáticos conocidos. No guardar consultas
  // dinámicas, signed URLs ni respuestas de APIs.
  const isStatic =
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.endsWith('/manifest.json') ||
    url.pathname.endsWith('/offline.html');

  if (!isStatic) return;

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
      return cached || network;
    })
  );
});
