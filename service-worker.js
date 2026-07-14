// Bumping this is no longer the only line of defense against stale deploys
// (see the network-first strategy for APP_SHELL below), but still bump it
// whenever the set of precached files changes, so old cache entries get
// swept in 'activate'.
const CACHE_NAME = 'vivos-cache-v4';

// Same-origin app code: changes on every deploy. Served network-first (see
// 'fetch' below) so a new deploy is picked up on the very next load instead
// of waiting for someone to remember to bump CACHE_NAME — we already got
// bitten once by relying on that. Still precached here so the very first
// offline visit after install has something to fall back to.
const APP_SHELL = [
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
  './assets/icon-512.png'
];

// Third-party libs pinned to an exact version in the URL itself — the file
// at this URL never changes, so it's safe (and faster) to cache-first these
// forever instead of hitting the network for them on every load.
const VENDOR_ASSETS = [
  'https://unpkg.com/dexie@4.4.4/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.3/dist/umd/supabase.js'
];

const ASSETS = [...APP_SHELL, ...VENDOR_ASSETS];

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

function cacheFirst(request) {
  return caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      const resClone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, resClone));
      return response;
    });
  });
}

function networkFirst(request, isNavigation) {
  // { cache: 'no-store' } forces this past the browser's own ordinary HTTP
  // cache, not just our Cache Storage. Without it, "network-first" could
  // still silently resolve from a stale disk/memory-cached response for
  // this URL, defeating the whole point (confirmed by testing: this exact
  // line was the difference between a fix staying stuck and actually
  // reaching an already-installed user on their very next reload).
  return fetch(request, { cache: 'no-store' }).then(response => {
    if (request.method === 'GET') {
      const resClone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, resClone));
    }
    return response;
  }).catch(() => {
    // Offline (or request failed): fall back to whatever we last cached.
    // Page navigations may carry query strings (e.g. shared setlist links
    // like "?tab=culto"/"?tab=ensaio") that don't match the precached
    // "./index.html" entry exactly, so ignore the search string for those.
    return caches.match(request, { ignoreSearch: isNavigation }).then(cached => {
      if (cached) return cached;
      if (isNavigation) return caches.match('./index.html');
      throw new Error('Fetch failed and no cache entry exists for this request');
    });
  });
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.hostname === 'supabase.co' || url.hostname.endsWith('.supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  if (event.request.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
    return; // let the browser handle it as usual, nothing for us to cache
  }

  if (VENDOR_ASSETS.includes(event.request.url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // App shell + everything else same-origin: network-first, so a new
  // deploy is visible on the very next load instead of being stuck behind
  // whatever was cached the first time — no dependency on remembering to
  // bump CACHE_NAME for routine content changes.
  event.respondWith(networkFirst(event.request, event.request.mode === 'navigate'));
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
