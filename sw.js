const VERSION = 'fec-v3';
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

  // Ignore non-GET requests (Firebase uses POST/PATCH internally)
  if (e.request.method !== 'GET') return;

  // Ignore external APIs — Firebase, Google, Anthropic
  const external = [
    'firestore.googleapis.com', 'firebase', 'googleapis.com',
    'gstatic.com', 'accounts.google.com', 'anthropic.com',
    'firebaseio.com', 'firebaseapp.com'
  ];
  if (external.some(h => url.hostname.includes(h))) return;

  // Bible JSON files: cache-first
  if (url.pathname.startsWith('/bibles/')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (resp.ok) {
            caches.open(VERSION).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        }).catch(() => caches.match(e.request));
      })
    );
    return;
  }

  // Same-origin app shell: network-first, cache fallback
  if (url.hostname === self.location.hostname) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp.ok) {
          caches.open(VERSION).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
  }
});
