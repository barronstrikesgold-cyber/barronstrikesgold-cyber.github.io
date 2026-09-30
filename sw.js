var CACHE = "reseller-shell-20260930c";
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
  "./photos/matchbox.jpg",
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
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) { return caches.delete(key); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(event.request).then(function (hit) {
        if (hit) return hit;
        if (event.request.mode === "navigate") return caches.match("./index.html");
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      });
    })
  );
});
