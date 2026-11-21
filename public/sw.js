// Only the install/offline screen is cached. Game code, accounts, API data and
// Socket.IO always use the live server so installing cannot freeze a release.
const CACHE = "tml-install-v2";
const OFFLINE = "/offline.html";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          OFFLINE,
          "/assets/app/icon-portal-192.png",
          "/assets/app/icon-portal-512.png",
        ]),
      )
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("tml-install-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    event.request.mode !== "navigate" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
