const CACHE_NAME = 'bus-yatra-v10.54';
const urlsToCache = [
  '/',
  '/owner',
  '/captain',
  '/admin',
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
  '/icons/ai-support-avatar.jpg'
];

const STATIC_CDN_ALLOWLIST = [
  'unpkg.com/leaflet@',
  'unpkg.com/html5-qrcode@',
  'www.gstatic.com/firebasejs/'
];

let currentFestivalTheme = 'none';

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SET_FESTIVAL_THEME') {
    currentFestivalTheme = event.data.festival || 'none';
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function unwrapCleanResponse(resp) {
  if (!resp || resp.status !== 200) return resp;
  if (!resp.redirected) return resp;
  const buf = await resp.clone().arrayBuffer();
  return new Response(buf, {
    status: resp.status,
    statusText: resp.statusText || 'OK',
    headers: new Headers(resp.headers)
  });
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.allSettled(
        urlsToCache.map(async url => {
          try {
            const resp = await fetch(url, { cache: 'reload' });
            if (resp && resp.status === 200) {
              const clean = await unwrapCleanResponse(resp);
              await cache.put(url, clean);
            }
          } catch (_) {}
        })
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

function resolveNavigationCacheKey(pathname) {
  const clean = (pathname || '/').replace(/\/+$/, '').toLowerCase() || '/';
  if (clean === '/' || clean === '/index' || clean === '/index.html') return '/';
  if (clean === '/owner' || clean === '/owner.html') return '/owner';
  if (clean === '/captain' || clean === '/captain.html') return '/captain';
  if (clean === '/admin' || clean === '/admin.html') return '/admin';
  return '/';
}

function buildOfflineHtmlResponse() {
  return new Response(
    `<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bus Yatra (Offline)</title><style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;text-align:center}.card{background:#fff;padding:28px 24px;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.08);max-width:360px}h2{margin:0 0 8px;font-size:19px}p{font-size:13px;color:#475569;margin:0 0 18px}button{background:#dc2626;color:#fff;border:0;padding:12px 20px;border-radius:12px;font-weight:700;cursor:pointer}</style></head><body><div class="card"><div style="font-size:40px;margin-bottom:10px">🚌</div><h2>ইন্টারনেট সংযোগ নেই</h2><p>নেটওয়ার্ক চালু করে আবার চেষ্টা করুন। একবার অনলাইনে খুললে অ্যাপ অফলাইনেও কাজ করবে।</p><button onclick="location.reload()">পুনরায় চেষ্টা করুন</button></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;
  if (event.request.method !== 'GET') return;

  // Never intercept dynamic backend APIs, Firestore database traffic, Auth, or email calls
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('brevo.com')
  ) {
    return;
  }

  // 1. HTML Navigation: Fast 1200ms Network Timeout -> Instant Offline/Cached App Shell Fallback
  if (event.request.mode === 'navigate') {
    const cacheKey = resolveNavigationCacheKey(url.pathname);
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = (await cache.match(cacheKey, { ignoreSearch: true })) ||
                     (cacheKey === '/' ? await cache.match('/index.html', { ignoreSearch: true }) : await cache.match(cacheKey + '.html', { ignoreSearch: true }));

      const networkFetch = fetch(cacheKey).then(async resp => {
        if (resp && resp.status === 200) {
          const clean = await unwrapCleanResponse(resp);
          cache.put(cacheKey, clean.clone()).catch(() => {});
          return clean;
        }
        return resp;
      });

      if (cached) {
        // Race fresh edge fetch with 1.2s ceiling so poor 2G or offline opens ALL 4 portals cleanly
        try {
          const raceResult = await Promise.race([
            networkFetch,
            new Promise(resolve => setTimeout(() => resolve(null), 1200))
          ]);
          if (raceResult && raceResult.status === 200) return raceResult;
          networkFetch.catch(() => {});
          return cached;
        } catch (_) {
          return cached;
        }
      }

      try {
        const netResp = await networkFetch;
        return netResp || buildOfflineHtmlResponse();
      } catch (_) {
        return buildOfflineHtmlResponse();
      }
    })());
    return;
  }

  // 2. Allowed Versioned Third-Party Static Libraries (Leaflet CSS/JS, Firebase Compat SDK, HTML5-QRCode)
  if (url.origin !== self.location.origin) {
    const isAllowedCdnLib = STATIC_CDN_ALLOWLIST.some(prefix => (url.hostname + url.pathname).includes(prefix));
    if (!isAllowedCdnLib) return;

    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) {
        fetch(event.request).then(resp => {
          if (resp && (resp.status === 200 || resp.type === 'opaque')) {
            cache.put(event.request, resp.clone()).catch(() => {});
          }
        }).catch(() => {});
        return cached;
      }
      try {
        const netResp = await fetch(event.request);
        if (netResp && (netResp.status === 200 || netResp.type === 'opaque')) {
          cache.put(event.request, netResp.clone()).catch(() => {});
        }
        return netResp;
      } catch (_) {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  // 3. Same-Origin Static Assets (Versioned JS/CSS, Images, Icons, Manifests)
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

  // Instant Cache-First for versioned scripts/styles (?v=...), with background revalidate + offline ignoreSearch fallback
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const exactCached = await cache.match(fetchTarget);
      if (exactCached) {
        return exactCached;
      }
      try {
        const netResp = await fetch(fetchTarget);
        if (netResp && netResp.status === 200) {
          cache.put(fetchTarget, netResp.clone()).catch(() => {});
        }
        return netResp;
      } catch (_) {
        const fuzzyCached = await cache.match(fetchTarget, { ignoreSearch: true });
        return fuzzyCached || new Response('', { status: 504 });
      }
    })());
    return;
  }

  // Cache-First + Background Revalidate for Images, Icons, Manifests
  event.respondWith(
    caches.match(fetchTarget, { ignoreSearch: true }).then(cached => {
      if (cached) {
        fetch(fetchTarget).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(fetchTarget, networkResponse.clone())).catch(() => {});
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(fetchTarget).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(fetchTarget, networkResponse.clone())).catch(() => {});
        }
        return networkResponse;
      }).catch(() => new Response('', { status: 504 }));
    })
  );
});
