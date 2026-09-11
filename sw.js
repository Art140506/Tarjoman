// ترجمان — سرویس‌ورکر: پوسته‌ی اپ را به‌روز نگه می‌دارد و درخواست API خارجی را دست نمی‌زند
const CACHE = 'tarjoman-v2.4.0';
const SHELL = [
  './', './index.html', './manifest.json', './icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './css/theme.css', './css/layout.css', './css/components.css', './css/app.css',
  './js/langs.js', './js/i18n.js', './js/storage.js', './js/keys.js', './js/theme.js',
  './js/gemini.js', './js/subtitles.js', './js/documents.js', './js/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  const isNavigation = event.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/';
  event.respondWith((async () => {
    if (isNavigation) {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        if (fresh.ok) { const c = await caches.open(CACHE); c.put(event.request, fresh.clone()); }
        return fresh;
      } catch (_) {
        return (await caches.match(event.request)) || caches.match('./index.html');
      }
    }
    const cached = await caches.match(event.request);
    const network = fetch(event.request).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(event.request, res.clone())).catch(() => {});
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
