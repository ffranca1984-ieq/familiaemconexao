const VERSION = 'fec-v4';
const APP_CACHE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(APP_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only handle GET requests
  if (e.request.method !== 'GET') return;

  // Skip all external domains
  const skip = [
    'firestore.googleapis.com', 'firebase', 'googleapis.com',
    'gstatic.com', 'accounts.google.com', 'anthropic.com',
    'firebaseio.com', 'firebaseapp.com', 'vercel.app',
    'vercel-scripts.com', 'vercel.live'
  ];
  if (skip.some(h => url.hostname.includes(h))) return;

  // Bible JSON: cache-first
  if (url.pathname.startsWith('/bibles/')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (resp && resp.ok && resp.status === 200) {
            const clone = resp.clone();
            caches.open(VERSION).then(c => c.put(e.request, clone));
          }
          return resp;
        }).catch(() => caches.match(e.request));
      })
    );
    return;
  }

  // Same origin only: network-first, cache fallback
  if (url.hostname === self.location.hostname) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.ok && resp.status === 200) {
          const clone = resp.clone();
          caches.open(VERSION).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
  }
});
