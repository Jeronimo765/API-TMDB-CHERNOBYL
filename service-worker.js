// Cache estatico con los archivos minimos para instalar y abrir el PWA.
const STATIC_CACHE = 'chernobyl-static-v7';
// Cache dinamico para recursos reutilizables que se cargan durante el uso.
const RUNTIME_CACHE = 'chernobyl-runtime-v7';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './offline.html',
  './style/style.css',
  './js/script.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png'
];

self.addEventListener('install', function (event) {
  // Precarga el shell base y la pagina offline.
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  // Limpia caches viejos y toma control inmediato del sitio.
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== STATIC_CACHE && key !== RUNTIME_CACHE;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);
  var isSameOrigin = url.origin === self.location.origin;
  var isNavigation = event.request.mode === 'navigate';

  if (isNavigation) {
    // Para navegaciones intentamos red; si falla, mostramos siempre offline.html.
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          return response;
        })
        .catch(function () {
          return caches.match('./offline.html');
        })
    );
    return;
  }

  if (isSameOrigin) {
    // Para recursos propios usamos red primero para evitar archivos viejos en desarrollo.
    event.respondWith(
      fetch(event.request)
        .then(function (networkResponse) {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          var responseToCache = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then(function (cache) {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(function () {
          return caches.match(event.request);
        })
    );
    return;
  }

  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    // Las fuentes externas se reutilizan desde cache cuando ya existen.
    event.respondWith(
      caches.match(event.request).then(function (cachedResponse) {
        var networkFetch = fetch(event.request).then(function (networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            var responseToCache = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then(function (cache) {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(function () {
          return cachedResponse;
        });

        return cachedResponse || networkFetch;
      })
    );
  }
});
