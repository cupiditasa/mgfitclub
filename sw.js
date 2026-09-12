const CACHE_NAME = "mg-fitclub-v20260912";
const APP_SHELL = [
  "./",
  "./account.html",
  "./app.html",
  "./preview-notice.css",
  "./preview-notice.js",
  "./mg-journal.html",
  "./journal.css",
  "./journal-motion.js",
  "./dashboard.html",
  "./coach-dashboard.html",
  "./admin-dashboard.html",
  "./secretary.html",
  "./support.html",
  "./athlete-shared-theme.css",
  "./athlete-shared-theme.js",
  "./mg-role-theme.css",
  "./mg-role-theme.js",
  "./panel-theme.css",
  "./assets/video/dashboard-bg-progressive.mp4",
  "./assets/video/dashboard-poster.jpg",
  "./assets/brand/mg-mark-acid.webp",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
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
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request)
          .then((response) => {
            const copy = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, copy));
            return response;
          })
          .catch(() => caches.match("./account.html")),
    ),
  );
});
