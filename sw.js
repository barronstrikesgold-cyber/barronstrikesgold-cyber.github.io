var CACHE = "reseller-shell-20261012d";
var SHELL = [
  "./404.html",
  "./app.js",
  "./apple-touch-icon.png",
  "./assets/brand/icon-192.png",
  "./assets/brand/icon-512.png",
  "./assets/brand/icon-maskable.png",
  "./assets/brand/mark.svg",
  "./assets/brand/wordmark.svg",
  "./assets/calendar/release.svg",
  "./assets/categories/cars.svg",
  "./assets/categories/golf.svg",
  "./assets/categories/sneakers.svg",
  "./assets/categories/sports.svg",
  "./assets/categories/streetwear.svg",
  "./assets/categories/tech.svg",
  "./assets/states/blocked.svg",
  "./assets/states/duplicate.svg",
  "./assets/states/empty.svg",
  "./assets/states/error.svg",
  "./assets/states/loading.svg",
  "./assets/states/no-results.svg",
  "./assets/states/no-sale.svg",
  "./assets/states/offline.svg",
  "./assets/states/pass.svg",
  "./assets/states/photo-needed.svg",
  "./assets/states/scene-blocked.svg",
  "./assets/states/scene-empty.svg",
  "./assets/states/scene-error.svg",
  "./assets/states/scene-loading.svg",
  "./assets/states/scene-no-results.svg",
  "./assets/states/scene-offline.svg",
  "./assets/states/sold.svg",
  "./assets/states/sth.svg",
  "./assets/states/strong.svg",
  "./assets/states/verify.svg",
  "./assets/states/watch.svg",
  "./assets/stores/bestbuy.svg",
  "./assets/stores/check-bestbuy.svg",
  "./assets/stores/check-dollartree.svg",
  "./assets/stores/check-goodwill.svg",
  "./assets/stores/check-target.svg",
  "./assets/stores/check-walmart.svg",
  "./assets/stores/dollartree.svg",
  "./assets/stores/goodwill.svg",
  "./assets/stores/target.svg",
  "./assets/stores/walmart.svg",
  "./assets/viz/no-history.svg",
  "./cash.js",
  "./data/drops.json",
  "./data/golf.json",
  "./data/stores.json",
  "./favicon-32.png",
  "./icon.svg",
  "./index.html",
  "./lib/amazon.js",
  "./lib/dates.js",
  "./lib/flow.js",
  "./lib/hunt-drops.js",
  "./lib/inventory.js",
  "./lib/market.js",
  "./lib/prices.js",
  "./lib/providers.js",
  "./lib/resale-cards.js",
  "./lib/rules.js",
  "./lib/scan.js",
  "./lib/search.js",
  "./manifest.webmanifest",
  "./photos/sneakers.svg",
  "./photos/streetwear.svg",
  "./photos/tech.svg",
  "./data/hw/manifest.json",
  "./styles.css",
  "./sw.js"
];

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(SHELL);
  }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) { return caches.delete(key); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isHwData(url) {
  return url.pathname.indexOf("/data/hw/") !== -1;
}

function isHuntData(url) {
  return url.pathname.indexOf("/data/") !== -1 && url.pathname.slice(-5) === ".json" && !isHwData(url);
}

function cacheUrl(request) {
  var url = new URL(request.url);
  url.search = "";
  return url.toString();
}

function storeResponse(request, response) {
  if (!response || !response.ok) return;
  var copy = response.clone();
  caches.open(CACHE).then(function (cache) {
    cache.put(cacheUrl(request), copy);
  });
}

function offlineFallback(request) {
  return caches.match(cacheUrl(request)).then(function (hit) {
    if (hit) {
      var headers = new Headers(hit.headers);
      headers.set("X-Reseller-From-Cache", "1");
      return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers: headers });
    }
    if (request.mode === "navigate") return caches.match("./index.html");
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  });
}

function staleWhileRevalidate(event) {
  var key = cacheUrl(event.request);
  var refresh = caches.open(CACHE).then(function (cache) {
    return fetch(event.request).then(function (res) {
      if (res && res.ok) return cache.put(key, res.clone()).then(function () { return res; });
      return res;
    }).catch(function () { return null; });
  });
  event.waitUntil(refresh.then(function () { return null; }));
  event.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(key).then(function (cached) {
      if (cached) return cached;
      return refresh.then(function (res) {
        return res || offlineFallback(event.request);
      });
    });
  }));
}

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;
  if (isHwData(url)) {
    staleWhileRevalidate(event);
    return;
  }
  var shellFile = /\.(html|js|css)$/.test(url.pathname) || url.pathname.endsWith("/");
  var imageFile = /\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(url.pathname);
  var pull = (isHuntData(url) || shellFile || imageFile) ? fetch(event.request, { cache: "no-store" }) : fetch(event.request);
  event.respondWith(
    pull.then(function (res) {
      storeResponse(event.request, res);
      return res;
    }).catch(function () {
      return offlineFallback(event.request);
    })
  );
});
