const CACHE = 'qr-tracker-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e)=>{
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(cached => cached ||
      fetch(req).then(res=>{
        // Cache new GET requests (best-effort)
        if (res.ok && new URL(req.url).origin === location.origin) {
          const resClone = res.clone();
          caches.open(CACHE).then(c=>c.put(req, resClone));
        }
        return res;
      }).catch(()=> caches.match('./index.html')))
  );
});
