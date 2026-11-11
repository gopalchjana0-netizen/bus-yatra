const CACHE_NAME = 'bus-yatra-v10.49';
const urlsToCache = [
  '/style.css',
  '/tailwind.js',
  '/app.js',
  '/app-admin.js',
  '/app-owner.js',
  '/app-captain.js',
  '/common.js',
  '/assets/ai-agent-avatar.jpg',
  '/assets/avatar-customer-male.jpg',
  '/assets/avatar-customer-female.jpg',
  '/manifest.json',
  '/manifest-diwali.json',
  '/manifest-owner.json',
  '/manifest-admin.json',
  '/manifest-captain.json',
  '/icons/favicon.png',
  '/icons/favicon-diwali.png',
  '/icons/logo-customer.png',
  '/icons/logo-customer-diwali.png',
  '/icons/logo-owner.png',
  '/icons/logo-admin.png',
  '/icons/logo-captain.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-diwali-192.png',
  '/icons/icon-diwali-512.png',
  '/icons/owner-192.png',
  '/icons/owner-512.png',
  '/icons/admin-192.png',
  '/icons/admin-512.png',
  '/icons/captain-192.png',
  '/icons/captain-512.png',
  '/icons/ai-support-avatar.jpg',
  '/assets/ai-agent-avatar.jpg'
];

let currentFestivalTheme = 'none';

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SET_FESTIVAL_THEME') {
    currentFestivalTheme = event.data.festival || 'none';
  }
});

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of urlsToCache) {
        try {
          const resp = await fetch(url);
          if (resp && resp.status === 200) {
            await cache.put(url, resp);
          }
        } catch (_) {}
      }
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // Never touch non-GET requests (mutations)
  if (event.request.method !== 'GET') return;

  // Never intercept backend API endpoints, Firebase Firestore/Auth, or Brevo
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('brevo.com')
  ) {
    return;
  }

  // 1. Navigation requests: NEVER INTERCEPT!
  // Let the browser load HTML natively from Cloudflare Pages edge (20-30ms).
  // This completely eliminates ERR_FAILED and redirect caching conflicts!
  if (event.request.mode === 'navigate') {
    return;
  }

  // 2. Cross-origin requests: NEVER INTERCEPT!
  // Let the browser handle external CDN libraries, map tiles, and external fonts natively.
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. Same-Origin Static Assets (JS, CSS, Images, Icons, Fonts)
  // Dynamic Festival Icon Routing (declared before any fetchTarget access):
  let fetchTarget = event.request;
  if (currentFestivalTheme === 'diwali') {
    if (url.pathname === '/icons/icon-192.png') fetchTarget = '/icons/icon-diwali-192.png';
    else if (url.pathname === '/icons/icon-512.png') fetchTarget = '/icons/icon-diwali-512.png';
    else if (url.pathname === '/icons/logo-customer.png') fetchTarget = '/icons/logo-customer-diwali.png';
    else if (url.pathname === '/icons/favicon.png') fetchTarget = '/icons/favicon-diwali.png';
    else if (url.pathname === '/manifest.json') fetchTarget = '/manifest-diwali.json';
  } else if (currentFestivalTheme !== 'none') {
    if (url.pathname === '/icons/icon-192.png') fetchTarget = `/icons/icon-${currentFestivalTheme}-192.png`;
    else if (url.pathname === '/icons/icon-512.png') fetchTarget = `/icons/icon-${currentFestivalTheme}-512.png`;
    else if (url.pathname === '/icons/logo-customer.png') fetchTarget = `/icons/logo-customer-${currentFestivalTheme}.png`;
  }

  // For critical application scripts and stylesheets, prioritize fresh network response with offline fallback
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(fetchTarget).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(fetchTarget, clone)).catch(() => {});
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(fetchTarget, { ignoreSearch: true }).then(cached => cached || new Response('', { status: 504 }));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(fetchTarget, { ignoreSearch: true }).then(cached => {
      if (cached) {
        // Revalidate in background
        fetch(fetchTarget).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(fetchTarget, clone)).catch(() => {});
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(fetchTarget).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(fetchTarget, clone)).catch(() => {});
        }
        return networkResponse;
      });
    })
  );
});
