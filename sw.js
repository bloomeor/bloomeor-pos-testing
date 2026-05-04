const CACHE_NAME = 'bloomeor-enterprise-v3';
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'manifest.json',
  'main/css/styles.css',
  'main/js/app.js',
  'main/js/auth.js',
  'main/images/logo/Bloomeor-logo.png',
  'main/html/dashboard.html',
  'main/html/pos.html',
  'main/html/orders.html',
  'main/html/sales.html',
  'main/html/customers.html',
  'main/html/inventory.html',
  'main/html/purchases.html',
  'main/html/suppliers.html',
  'main/html/payments.html',
  'main/html/expenses.html',
  'main/html/reminders.html',
  'main/html/reports.html',
  'main/html/settings.html'
];

// Install Event - Pre-cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 PWA: Pre-caching Enterprise Assets (Relative Paths)');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('⚠️ PWA: Pre-cache failed for some assets. Service Worker will still install.', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Strategic Caching
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cacheCopy);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});
