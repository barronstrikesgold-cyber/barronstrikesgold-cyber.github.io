var CACHE = "reseller-shell-20261011h";
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
  "./photos/knockout.jpg",
  "./photos/m6a.jpg",
  "./photos/mb-356.jpg",
  "./photos/mb-vanquish.jpg",
  "./photos/tech-sticker.jpg",
  "./data/hw/1968.json",
  "./data/hw/1969.json",
  "./data/hw/1970.json",
  "./data/hw/1971.json",
  "./data/hw/1972.json",
  "./data/hw/1973.json",
  "./data/hw/1974.json",
  "./data/hw/1975.json",
  "./data/hw/1976.json",
  "./data/hw/1977.json",
  "./data/hw/1978.json",
  "./data/hw/1979.json",
  "./data/hw/1980.json",
  "./data/hw/1981.json",
  "./data/hw/1982.json",
  "./data/hw/1983.json",
  "./data/hw/1984.json",
  "./data/hw/1985.json",
  "./data/hw/1986.json",
  "./data/hw/1987.json",
  "./data/hw/1988.json",
  "./data/hw/1989.json",
  "./data/hw/1990.json",
  "./data/hw/1991.json",
  "./data/hw/1992.json",
  "./data/hw/1993.json",
  "./data/hw/1994.json",
  "./data/hw/1995.json",
  "./data/hw/1996.json",
  "./data/hw/1997.json",
  "./data/hw/1998.json",
  "./data/hw/1999.json",
  "./data/hw/2000.json",
  "./data/hw/2001.json",
  "./data/hw/2002.json",
  "./data/hw/2003.json",
  "./data/hw/2004.json",
  "./data/hw/2005.json",
  "./data/hw/2006.json",
  "./data/hw/2007.json",
  "./data/hw/2008.json",
  "./data/hw/2009.json",
  "./data/hw/2010.json",
  "./data/hw/2011.json",
  "./data/hw/2012.json",
  "./data/hw/2013.json",
  "./data/hw/2014.json",
  "./data/hw/2015.json",
  "./data/hw/2016.json",
  "./data/hw/2017.json",
  "./data/hw/2018.json",
  "./data/hw/2019.json",
  "./data/hw/2020.json",
  "./data/hw/2021.json",
  "./data/hw/2022.json",
  "./data/hw/2023.json",
  "./data/hw/2024.json",
  "./data/hw/2025.json",
  "./data/hw/2026.json",
  "./data/hw/index.json",
  "./data/hw/manifest.json",
  "./data/hw/thumb-report.json",
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
