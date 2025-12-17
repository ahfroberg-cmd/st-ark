//
// Copyright 2024 ST-ARK
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
const VERSION = "v1.0.0";
const APP_SHELL = ["/", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];
const CORE_CACHE = `core-${VERSION}`;
const RUNTIME_CACHE = `rt-${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CORE_CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![CORE_CACHE, RUNTIME_CACHE].includes(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Enkelt SWR för mål-JSON + statik; NetworkFirst för sidor
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // API/HTML = NetworkFirst (med fallback cache)
  const isDoc = e.request.mode === "navigate" || (e.request.headers.get("accept") || "").includes("text/html");
  if (isDoc) {
    e.respondWith(
      fetch(e.request).then((r) => {
        const copy = r.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Mål-JSON: stale-while-revalidate
  const isGoalsJson = url.pathname.startsWith("/public/goals/") || url.pathname.endsWith("/psykiatri.json");
  if (isGoalsJson) {
    e.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        const net = fetch(e.request).then((r) => { cache.put(e.request, r.clone()); return r; }).catch(() => null);
        return cached || net || fetch(e.request);
      })
    );
    return;
  }

  // Övrig statik: CacheFirst
  if (url.pathname.startsWith("/icons/") || url.pathname.endsWith(".png") || url.pathname.endsWith(".jpg")) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
        const copy = r.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(e.request, copy));
        return r;
      }))
    );
    return;
  }
});
