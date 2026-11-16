const CAMPORA_CACHE = 'campora-shell-v1';
const CAMPORA_OFFLINE_ASSETS = ['/offline', '/campora-app-icon.png', '/favicon.png'];
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CAMPORA_CACHE).then(cache => cache.addAll(CAMPORA_OFFLINE_ASSETS.map(url => new Request(url, {cache:'reload'}))).catch(() => {}))); self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('campora-shell-')&&k!==CAMPORA_CACHE).map(k=>caches.delete(k)));await self.clients.claim()})()); });
self.addEventListener('fetch', (event) => { const req=event.request; if(req.method!=='GET' || new URL(req.url).origin!==self.location.origin) return; if(req.mode==='navigate'){event.respondWith(fetch(req).catch(async()=> (await caches.match('/offline')) || new Response('You are offline. Reconnect and try again.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));return;} if(CAMPORA_OFFLINE_ASSETS.some(path=>new URL(req.url).pathname===path)){event.respondWith(caches.match(req).then(hit=>hit||fetch(req)));} });
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || '' }; }
  const title = data.title || 'CARTOMUX';
  const options = {
    body: data.body || 'You have a new CARTOMUX update.',
    icon: data.icon || '/campusdrop-mark.png',
    badge: data.badge || '/campusdrop-mark.png',
    tag: data.tag || 'campusdrop-notification',
    renotify: true,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        try { await client.navigate(target); } catch {}
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
