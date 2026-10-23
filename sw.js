const CACHE_NAME = "sistem-pelaporan-v37";
const APP_SHELL = [
  "./",
  "./index.html",
  "./assets/css/style.css",
  "./manifest.webmanifest",
  "./data/README.txt",
  "./data/desa/desa dan kelurahan.json",
  "./config/app-config.json",
  "./data/webhook.json",
  "./assets/images/icons/favicon.ico",
  "./assets/images/icons/favicon-16x16.png",
  "./assets/images/icons/favicon-32x32.png",
  "./assets/images/icons/apple-touch-icon.png",
  "./assets/images/icons/android-chrome-192x192.png",
  "./assets/images/icons/android-chrome-512x512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate";
  const alwaysFresh = requestUrl.pathname.includes("/data/desa/") ||
    requestUrl.pathname.endsWith("/config/app-config.json") ||
    requestUrl.pathname.endsWith("/data/webhook.json") ||
    requestUrl.pathname.endsWith("/RUNNING.txt") ||
    requestUrl.pathname.endsWith("/index.html") ||
    requestUrl.pathname.endsWith("/assets/css/style.css") ||
    requestUrl.pathname.endsWith("/manifest.webmanifest") ||
    requestUrl.pathname.endsWith("/sw.js");

  if (isNavigation || alwaysFresh) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(event.request, { cache: "no-store" });
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, response.clone());
          }
          return response;
        } catch (error) {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          throw error;
        }
      })()
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (event.request.url.startsWith(self.location.origin)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
