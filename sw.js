// FluentCam Academy Pro Service Worker (Chrome & iPadOS PWA Installable)
// - HTML/JS/CSS: Network-first (instant updates, offline fallback)
// - Static images/icons/avatars/vendor: Cache-first (fast classroom loading)
// - Never intercepts Firebase RTDB, Gemini API, GitHub API, SSE, or WebSockets
const VERSION = 'fc-20261124f';
const CORE = `${VERSION}-core`;
const ASSETS = `${VERSION}-assets`;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CORE)
      .then((c) => c.addAll(['./', './index.html', './manifest.webmanifest']))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never intercept live APIs, Firebase RTDB, GitHub API, or EventSource SSE streams
  if (
    url.hostname.includes('firebasedatabase.app') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('api.github.com') ||
    req.headers.get('accept') === 'text/event-stream'
  ) {
    return;
  }

  const isAsset =
    /\/(assets|icons|vendor)\//.test(url.pathname) ||
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'fonts.gstatic.com';

  if (isAsset) {
    e.respondWith(
      caches.open(ASSETS).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Network-first for app code (HTML/JS/CSS) so updates apply immediately
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) caches.open(CORE).then((c) => c.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
