const STATIC_CACHE = 'chernobyl-static-v2';
const RUNTIME_CACHE = 'chernobyl-runtime-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './offline.html',
  './style/style.css',
  './js/script.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-maskable.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
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
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(RUNTIME_CACHE).then(function (cache) {
            cache.put('./index.html', copy);
          });
          return response;
        })
        .catch(function () {
          return caches.match(event.request)
            .then(function (cachedPage) {
              return cachedPage || caches.match('./index.html') || caches.match('./offline.html');
            });
        })
    );
    return;
  }

  if (isSameOrigin) {
    event.respondWith(
      caches.match(event.request).then(function (cachedResponse) {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then(function (networkResponse) {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          var responseToCache = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then(function (cache) {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        });
      })
    );
    return;
  }

  if (
    url.hostname === 'image.tmdb.org' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
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
