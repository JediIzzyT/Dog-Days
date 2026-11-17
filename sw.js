"use strict";

// Bump the version whenever any offline file changes. Updates activate after all game tabs close.
const SCOPE = self.registration.scope;
const CACHE_PREFIX = `dog-days-shell:${SCOPE}:`;
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const APP_URL = new URL("./index.html", SCOPE).href;
const ASSETS = [
  APP_URL,
  new URL("./manifest.webmanifest", SCOPE).href,
  new URL("./icons/paw.svg", SCOPE).href,
  new URL("./icons/icon-192.png", SCOPE).href,
  new URL("./icons/icon-512.png", SCOPE).href,
  new URL("./icons/apple-touch-icon.png", SCOPE).href
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isAppPage = event.request.mode === "navigate" &&
    (url.origin + url.pathname === SCOPE || url.origin + url.pathname === APP_URL);
  const cacheKey = isAppPage ? APP_URL : url.href;
  if (!isAppPage && !ASSETS.includes(cacheKey)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(cacheKey) || fetch(event.request);
  })());
});
