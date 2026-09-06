const CACHE_VERSION = "secondpart-pwa-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// Intentionally no fetch interception yet. SecondPart contains authenticated,
// frequently changing marketplace data, so we do not cache user or listing
// responses until an explicit offline-data policy is designed and tested.
