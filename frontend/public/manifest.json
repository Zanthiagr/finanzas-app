// Service Worker minimalista — solo para habilitar instalación PWA
// No cachea archivos JS/CSS para evitar que versiones viejas bloqueen la app

const CACHE_NAME = 'fintual-shell-v1';

self.addEventListener('install', (e) => {
  // Activa inmediatamente sin esperar
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Toma control inmediato y limpia cachés viejos
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Siempre va a la red — sin caché que pueda quedar obsoleto
  // Solo interceptamos navegación para redirigir a index.html (SPA routing)
  const { request } = e;
  
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => fetch('/index.html'))
    );
    return;
  }
  
  // Todo lo demás va directo a la red
  // No cacheamos nada para evitar versiones obsoletas
});
