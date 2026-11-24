/* Service worker TaskSync — mode hors connexion (Offline-First).
 *
 * - Ressources immuables (_next/static, /icons) : cache-first → l'app
 *   démarre instantanément, même sans réseau.
 * - Pages : réseau d'abord pour rester à jour, repli sur le cache puis
 *   sur la coque "/".
 * - API (/api/**) : toujours le réseau — les données métier vivent dans
 *   IndexedDB et sont gérées par le moteur de synchronisation, jamais
 *   par le cache HTTP.
 */
const CACHE = "tasksync-v2";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (err) {
    return new Response("", { status: 504, statusText: "Hors ligne" });
  }
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const shell = await cache.match(fallbackUrl);
      if (shell) return shell;
    }
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API : jamais mise en cache (données fraîches + cookies de session).
  if (url.pathname.startsWith("/api/")) return;

  // Ressources immuables de l'application : cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/logo.svg"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigations (chargement de la page) : réseau d'abord, coque en secours.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/").catch(() => caches.match("/")));
    return;
  }

  // Autres requêtes same-origin (payloads RSC, fontes…) : SWR.
  event.respondWith(staleWhileRevalidate(request));
});
