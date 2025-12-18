// Nombres para el caché
const CACHE_NAME = 'planificador-v1';
// Archivos que se guardarán en caché (la app completa)
// ¡Asegúrate de que los nombres de los iconos coincidan!
const cacheUrls = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Evento "install"
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto, añadiendo archivos...');
        return cache.addAll(cacheUrls);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch(err => {
        console.log('Error al cachear archivos:', err);
      })
  );
});

// Evento "activate"
self.addEventListener('activate', e => {
  const cacheWhitelist = [CACHE_NAME];
  e.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Evento "fetch"
self.addEventListener('fetch', e => {
  e.respondWith(
    // Intenta buscar en la red primero
    fetch(e.request).catch(() => {
      // Si falla (offline), busca en el caché
      return caches.match(e.request);
    })
  );
});