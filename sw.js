const CACHE_NAME = "mg-fitclub-v20261006-education";
const APP_SHELL = [
  "./nutrition.html",
  "./nutrition-builder.html",
  "./nutrition-view.html",
  "./nutrition.js?v=20261005",
  "./nutrition.css?v=20261005",
  "./workouts.js?v=20261005",
  "./workout-domain.js",
  "./workouts.css?v=20261005",
  "./",
  "./account.html",
  "./mg-api.js?v=20261006-api-domain",
  "./access-control.js?v=20260928-device",
  "./device-verification.html",
  "./device-verification.js?v=20260928",
  "./access-center.html",
  "./access-center.js?v=20260928-pilot-review",
  "./access-center.css?v=20260919",
  "./app.html",
  "./app-install.css?v=20260920",
  "./app-install.js?v=20260920-browsers",
  "./preview-notice.css",
  "./preview-notice.js",
  "./mg-journal.html",
  "./journal.css?v=20260919",
  "./journal-layout.css?v=20260920-menu",
  "./journal-player.js?v=20260920",
  "./journal-gallery.css?v=20260920",
  "./journal-gallery.js?v=20260920",
  "./videos/functional-wellbeing.html",
  "./videos/strength-confidence.html",
  "./videos/healthy-nutrition.html",
  "./videos/mg-lifestyle.html",
  "./journal-motion.js?v=20260919",
  "./dashboard.html",
  "./coach-dashboard.html",
  "./admin-dashboard.html",
  "./education.html",
  "./education-studio.html",
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
  "./assets/education/mg-anatomy-character.png",
  "./assets/vendor/three/three.module.js",
  "./assets/vendor/three/examples/jsm/environments/RoomEnvironment.js",
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
            .filter((key) => key.startsWith("mg-fitclub-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Never read or write authenticated/API responses in Cache Storage.
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      url.pathname.startsWith("/api/") || request.headers.has("authorization") ||
      request.headers.has("range") || request.cache === "no-store") return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const media = /\.(mp4|webm|jpg|jpeg|png|webp|woff2?)$/i.test(url.pathname);
    if (media) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    try {
      const response = await fetch(request);
      if (response.ok && response.status === 200 &&
          !/no-store|private/i.test(response.headers.get("cache-control") || "")) {
        await cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        const fallback = await cache.match("./account.html");
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
