// The app is online-only now (Clerk auth + Supabase, no offline/local data
// copy — see README). This service worker exists ONLY so the app still
// satisfies PWA installability criteria (so it can be "added to home
// screen"); it does not cache app code or API data. A previous version of
// this file cached the whole app shell for offline use — the 'activate'
// handler below clears out any of those old caches for people who already
// had the app installed.
const CACHE_NAME = 'vivos-cache-v5-online-only';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
  );
  self.clients.claim();
});

// No-op: intentionally does not call event.respondWith(), so every request
// just goes to the network as if there were no service worker at all. Kept
// only because some installability checks look for a registered fetch
// handler.
self.addEventListener('fetch', () => {});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
