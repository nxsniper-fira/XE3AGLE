/* XE3AGLE SW — network-first HTML so login/session never hits a dead cache */
const CACHE = 'xe3agle-ui-refresh-1';
const CORE = [
  '/',
  '/index.html',
  '/login.html',
  '/app.html',
  '/api-config.js',
  '/css/core.css',
  '/css/components.css',
  '/css/mobile.css',
  '/css/modern.css',
  '/css/landing.css',
  '/js/app.js',
  '/js/login-page.js',
  '/js/legacy-v8.js',
  '/js/v10-engine.js',
  '/js/auth/api-client.js',
  '/js/auth/auth-manager.js',
  '/js/auth/sync-manager.js',
  '/js/account/privacy.js',
  '/js/ui/theme-manager.js',
  '/assets/icons/xe3agle-logo.png',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API — always network (avoids broken offline auth)
  if (url.pathname.startsWith('/api/')) return;

  const isNav =
    req.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/app' ||
    url.pathname === '/login' ||
    url.pathname.endsWith('.html');

  if (isNav) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return r;
        })
        .catch(async () => {
          const cached =
            (await caches.match(req)) ||
            (await caches.match('/app.html')) ||
            (await caches.match('/login.html')) ||
            (await caches.match('/index.html'));
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // Static assets: cache falling back to network
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req)
        .then((r) => {
          if (r.ok && (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/') || url.pathname.startsWith('/assets/'))) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return r;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
