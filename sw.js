/* LOOPLY service worker
 * - Caches the app shell so LOOPLY opens even with a weak connection.
 * - Uses "network first": you always get the latest files when online.
 * - Never caches Supabase or CDN requests (live data stays live and private).
 */
const CACHE = "looply-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll([
        "./index.html",
        "./css/styles.css",
        "./js/config.js",
        "./js/app.js",
        "./manifest.webmanifest",
        "./icons/icon-192.png",
        "./icons/icon-512.png"
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match("./index.html")))
  );
});
