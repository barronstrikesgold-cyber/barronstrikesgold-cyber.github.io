var CACHE = "reseller-shell-20261001c";
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
  "./data/catalog.json",
  "./data/drops.json",
  "./data/golf.json",
  "./data/inventory-seed.json",
  "./data/stores.json",
  "./favicon-32.png",
  "./icon.svg",
  "./index.html",
  "./lib/dates.js",
  "./lib/hunt-drops.js",
  "./lib/inventory.js",
  "./lib/prices.js",
  "./lib/providers.js",
  "./lib/rules.js",
  "./lib/search.js",
  "./manifest.webmanifest",
  "./photos/airpods.jpg",
  "./photos/artifacts.jpg",
  "./photos/bape.jpg",
  "./photos/bowman-bb.jpg",
  "./photos/chrome-fb.jpg",
  "./photos/civic.jpg",
  "./photos/collab-tee.jpg",
  "./photos/cuda.jpg",
  "./photos/dunk-sb.jpg",
  "./photos/etb.jpg",
  "./photos/f40.jpg",
  "./photos/fifa.jpg",
  "./photos/firebird.jpg",
  "./photos/hoodie.jpg",
  "./photos/impala.jpg",
  "./photos/ipad.jpg",
  "./photos/iphone.jpg",
  "./photos/jordan-1.jpg",
  "./photos/jordan-11.jpg",
  "./photos/jordan-3.jpg",
  "./photos/jordan-4.jpg",
  "./photos/lotus.jpg",
  "./photos/macbook.jpg",
  "./photos/mustang.jpg",
  "./photos/nb-2002r.jpg",
  "./photos/nb-550.jpg",
  "./photos/nb-990.jpg",
  "./photos/optic-fb.jpg",
  "./photos/porsche.jpg",
  "./photos/samba.jpg",
  "./photos/select-fb.jpg",
  "./photos/skyline.jpg",
  "./photos/sneakers.svg",
  "./photos/streetwear.svg",
  "./photos/supreme.jpg",
  "./photos/switch.jpg",
  "./photos/tech.svg",
  "./photos/topps-fb.jpg",
  "./photos/topps-s1.jpg",
  "./photos/watch.jpg",
  "./photos/wnba.jpg",
  "./photos/yeezy.jpg",
  "./photos/d100.jpg",
  "./photos/db5.jpg",
  "./photos/drift.jpg",
  "./photos/ferrari12.jpg",
  "./photos/ff-supra.jpg",
  "./photos/belair.jpg",
  "./photos/datsun.jpg",
  "./photos/mb-911.jpg",
  "./photos/mb-bronco.jpg",
  "./photos/mb-gtr.jpg",
  "./photos/mb-integra.jpg",
  "./photos/mb-jag.jpg",
  "./photos/lincoln.jpg",
  "./photos/m4.jpg",
  "./photos/maxima.jpg",
  "./photos/otto.jpg",
  "./photos/ram.jpg",
  "./photos/sierra.jpg",
  "./photos/starion.jpg",
  "./photos/subaru.jpg",
  "./photos/supra-tooned.jpg",
  "./styles.css",
  "./sw.js"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(SHELL);
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

function isHuntData(url) {
  return url.pathname.indexOf("/data/") !== -1 && url.pathname.slice(-5) === ".json";
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

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;
  var pull = isHuntData(url) ? fetch(event.request, { cache: "no-store" }) : fetch(event.request);
  event.respondWith(
    pull.then(function (res) {
      storeResponse(event.request, res);
      return res;
    }).catch(function () {
      return offlineFallback(event.request);
    })
  );
});
