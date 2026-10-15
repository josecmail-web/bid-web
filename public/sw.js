/*
 * Service worker de Bidra Pro. No guarda en caché la app (los datos de pujas deben ser siempre los
 * actuales): solo muestra una página «Sin conexión» si falla la red al abrir una pantalla.
 */
const OFFLINE = "/offline.html";
const CACHE = "bidra-offline-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method === "GET" && req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
  } else if (req.method === "GET" && new URL(req.url).pathname === "/icons/icon-192.png") {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
  }
});
