// ترجمان — سرویس‌ورکر: فقط پوسته‌ی اپ را کش می‌کند، هرگز درخواست‌های API را
const CACHE = 'tarjoman-v2.3.0';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/theme.css',
  './css/layout.css',
  './css/components.css',
  './css/app.css',
  './js/langs.js',
  './js/i18n.js',
  './js/storage.js',
  './js/keys.js',
  './js/theme.js',
  './js/gemini.js',
  './js/subtitles.js',
  './js/documents.js',
  './js/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // هرگز فراخوانی‌های API یا منابع خارجی را کش/دست‌کاری نکن
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
