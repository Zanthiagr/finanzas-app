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

// ── Recordatorio nocturno (push) ────────────────────────────────────────
// El servidor (Edge Function recordatorio-nocturno, disparada por un cron
// de Postgres) manda un push por la noche a quien no haya registrado
// movimientos ese día. Esto es lo que efectivamente muestra la
// notificación del sistema operativo cuando llega, incluso con la app
// cerrada — es la única parte de todo el flujo que corre "fuera" de la
// app, en el Service Worker.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }

  const title = data.title || 'Fintual';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Al tocar la notificación, llevar a la persona directo a Movimientos
// (o enfocar la pestaña/app ya abierta si existe) en vez de abrir una
// pestaña nueva en blanco.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
