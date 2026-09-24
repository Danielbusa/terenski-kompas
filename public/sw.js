const SHELL_CACHE = "terenski-kompas-shell-v4";
const TILE_CACHE = "terenski-kompas-osm-v1";
const CORE = ["/", "/login", "/join", "/donate", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== SHELL_CACHE && key !== TILE_CACHE).map((key) => caches.delete(key)),
  )));
  self.clients.claim();
});

async function trimCache(cacheName, maximumItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  while (keys.length > maximumItems) await cache.delete(keys.shift());
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (url.hostname === "tile.openstreetmap.org") {
    event.respondWith(caches.open(TILE_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) {
        await cache.put(event.request, response.clone());
        void trimCache(TILE_CACHE, 500);
      }
      return response;
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(async (response) => {
      if (response.ok) (await caches.open(SHELL_CACHE)).put(event.request, response.clone());
      return response;
    }).catch(async () => (await caches.match(event.request)) || (await caches.match("/"))));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => {
    const network = fetch(event.request).then(async (response) => {
      if (response.ok) (await caches.open(SHELL_CACHE)).put(event.request, response.clone());
      return response;
    });
    return cached || network;
  }));
});
