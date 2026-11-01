/* Robot School Academy — service worker.
   Кешує лише оболонку застосунку (сторінку, скрипти, іконки), щоб він швидко відкривався й працював як застосунок.
   Файли уроків, тести й результати йдуть через сервер (POST) і НЕ кешуються. */
const CACHE = 'rsa-shell-v2.0';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('rsa-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/video/')) return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
