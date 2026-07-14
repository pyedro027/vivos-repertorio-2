// IMPORTANT: bump this version on every deploy that changes any cached asset.
// The browser only re-checks/re-installs the service worker when THIS FILE's
// bytes change, so changing CACHE_NAME here is what forces stale caches to be
// replaced (see 'activate' handler below).
const CACHE_NAME = 'vivos-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './db.js',
  './sync.js',
  './supabaseClient.js',
  './manifest.json',
  './assets/logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  'https://unpkg.com/dexie@4.4.4/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.3/dist/umd/supabase.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.hostname === 'supabase.co' || url.hostname.endsWith('.supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Page navigations may carry query strings (e.g. shared setlist links like
  // "?tab=culto"/"?tab=ensaio") that don't match the precached "./index.html"
  // entry exactly. Ignore the search string for those so they still hit cache.
  const isNavigation = event.request.mode === 'navigate';

  event.respondWith(
    caches.match(event.request, { ignoreSearch: isNavigation }).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (event.request.method === 'GET' && !url.protocol.startsWith('chrome-extension')) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        }
        return response;
      }).catch(() => {
        // Offline and nothing cached: for navigations, fall back to the app
        // shell instead of letting the browser show its default offline page.
        if (isNavigation) return caches.match('./index.html');
        throw new Error('Fetch failed and no cache entry exists for this request');
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
