/* Hunt UPC lookup. Our own data first, then keyless public product databases, then search links.
 * Loaded on demand with the scanner. No API keys live in this file or anywhere in the repo.
 *
 * Order for a retail barcode (UPC-A, EAN-13, EAN-8, GTIN-14):
 *   1. Hunt's own data (catalog, market, drops, inventory, the HW toy-code index, codes you confirmed before)
 *   2. barcode.report        keyless JSON, CORS *, retailer + crawl evidence with titles, brands, images
 *   3. owner proxy           optional: a URL saved on this phone that returns UPCitemdb-shaped JSON
 *   4. Open Products Facts   keyless, CORS *
 *   5. Open Food Facts       keyless, CORS * (snacks, drinks, and other grocery codes)
 *   6. Search links          Google Shopping, eBay sold, Amazon (tag hempsply02-20), barcode.report, UPCitemdb
 * UPCitemdb's free trial endpoint only allows its own site origin over CORS, so a browser on GitHub Pages
 * cannot call it directly. It works through the optional owner proxy (see docs/upc-lookup.md).
 * Every answer is cached on this phone (IndexedDB "hunt-upc"), so a repeat scan is instant and works offline. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HuntUpc = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var AMAZON_TAG = "hempsply02-20";
  var HIT_TTL = 90 * 24 * 3600 * 1000;
  var MISS_TTL = 24 * 3600 * 1000;
  var DB_NAME = "hunt-upc";
  var DB_VERSION = 1;
  var PROXY_KEY = "hunt-upc-proxy";

  var SOURCES = [
    { id: "barcode-report", name: "barcode.report", home: "https://barcode.report/" },
    { id: "proxy", name: "UPCitemdb (your proxy)", home: "https://www.upcitemdb.com/" },
    { id: "open-products-facts", name: "Open Products Facts", home: "https://world.openproductsfacts.org/" },
    { id: "open-food-facts", name: "Open Food Facts", home: "https://world.openfoodfacts.org/" },
  ];

  /* GS1 company prefixes Hunt cares about. A prefix names the brand owner, not the exact product. */
  var PREFIXES = [
    ["0194735", "Hot Wheels / Mattel", "hot-wheels"],
    ["0887961", "Mattel", "hot-wheels"],
    ["0027084", "Mattel", "hot-wheels"],
    ["0074299", "Mattel", "hot-wheels"],
    ["0746775", "Mattel", "hot-wheels"],
    ["0196214", "Pokémon", "pokemon"],
    ["0820650", "Pokémon", "pokemon"],
    ["0889698", "Funko", "funko"],
    ["0830395", "Funko", "funko"],
    ["0673419", "LEGO", "lego"],
    ["05702", "LEGO", "lego"],
    ["0091206", "Nike", "sneakers"],
    ["0193145", "Nike", "sneakers"],
    ["0194276", "Nike", "sneakers"],
    ["0194501", "Nike", "sneakers"],
    ["0194953", "Nike", "sneakers"],
    ["0195237", "Nike", "sneakers"],
    ["0195866", "Nike", "sneakers"],
    ["0196149", "Nike", "sneakers"],
    ["0196604", "Nike", "sneakers"],
    ["0196975", "Nike", "sneakers"],
    ["0197593", "Nike", "sneakers"],
    ["0197596", "Nike", "sneakers"],
    ["0198484", "Nike", "sneakers"],
    ["0191526", "Nike", "sneakers"],
    ["04065", "adidas", "sneakers"],
    ["04066", "adidas", "sneakers"],
    ["04067", "adidas", "sneakers"],
  ];

  var LANE_WORDS = [
    ["matchbox", /\bmatchbox\b/i],
    ["hot-wheels", /\bhot\s*wheels\b|\bhotwheels\b/i],
    ["pokemon", /pok[eé]mon|elite trainer box|\betb\b|booster (box|bundle|pack)/i],
    ["funko", /\bfunko\b|\bpop!\s|\bpop! vinyl\b|bobble-?head/i],
    ["lego", /\blego\b/i],
    ["sneakers", /\b(nike|jordan|adidas|yeezy|new balance|asics|puma|reebok|converse|vans|sneakers?|dunk low|air max|air force 1)\b/i],
  ];

  var PLACEHOLDER_IMG = /icecat-large\.png|placeholder|no[-_]?image|noimage|default[-_]?image|spacer\.gif/i;

  function digits(code) {
    return String(code == null ? "" : code).replace(/[\s-]/g, "");
  }

  function gtinCheck(body) {
    var sum = 0;
    for (var i = body.length - 1, k = 0; i >= 0; i--, k++) {
      var n = body.charCodeAt(i) - 48;
      sum += k % 2 === 0 ? n * 3 : n;
    }
    return String((10 - (sum % 10)) % 10);
  }

  function isRetailCode(code) {
    var d = digits(code);
    if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(d)) return false;
    return gtinCheck(d.slice(0, -1)) === d.charAt(d.length - 1);
  }

  function gtin14(code) {
    var d = digits(code);
    if (!isRetailCode(d)) return null;
    while (d.length < 14) d = "0" + d;
    return d;
  }

  /* 12-digit UPC-A when the code is a 0-led EAN-13 or GTIN-14, else the EAN-13. */
  function shortForm(code) {
    var g = gtin14(code);
    if (!g) return null;
    if (g.slice(0, 2) === "00") return g.slice(2);
    if (g.charAt(0) === "0") return g.slice(1);
    return g;
  }

  function prefixInfo(code) {
    var g = gtin14(code);
    if (!g) return null;
    var e13 = g.slice(1);
    for (var i = 0; i < PREFIXES.length; i++) {
      if (e13.indexOf(PREFIXES[i][0]) === 0) return { brand: PREFIXES[i][1], lane: PREFIXES[i][2], prefix: PREFIXES[i][0] };
    }
    return null;
  }

  function laneFor(text, brand) {
    var hay = [brand, text].filter(Boolean).join(" ");
    for (var i = 0; i < LANE_WORDS.length; i++) if (LANE_WORDS[i][1].test(hay)) return LANE_WORDS[i][0];
    return "other";
  }

  /* Mattel toy / peg codes look like JJK58, HKL22, GRV13. Card backs print HKL22-N9C0K. */
  function mattelKey(raw) {
    var s = String(raw == null ? "" : raw).toUpperCase().replace(/\s+/g, "");
    var m = /^([A-Z]{3}\d{2})(?:-?[A-Z0-9]{4,6})?$/.exec(s);
    return m ? m[1] : null;
  }

  function mattelCodes(text) {
    var out = [];
    var re = /\b([A-Z]{3}\d{2})\b/g;
    var m;
    var s = String(text || "");
    while ((m = re.exec(s))) if (out.indexOf(m[1]) === -1 && !/^(UPC|EAN|SKU|USD|CAD)/.test(m[1])) out.push(m[1]);
    return out;
  }

  function clean(text, max) {
    var s = String(text == null ? "" : text).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (max && s.length > max) s = s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
    return s;
  }

  function goodImage(url) {
    var s = String(url || "").trim();
    if (!/^https?:\/\//i.test(s)) return "";
    if (PLACEHOLDER_IMG.test(s)) return "";
    if (/^http:\/\//i.test(s)) s = "https://" + s.slice(7);
    if (/^https:\/\/wwww\./i.test(s)) s = "https://www." + s.slice(13);
    return s;
  }

  function addImage(list, url, first) {
    var u = goodImage(url);
    if (!u || list.indexOf(u) !== -1) return;
    if (first) list.unshift(u);
    else list.push(u);
  }

  function num(v) {
    if (v === "" || v == null) return null;
    var n = Number(String(v).replace(/[$,\s]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function finish(result, code) {
    result.code = shortForm(code) || digits(code);
    result.images = (result.images || []).slice(0, 6);
    result.image = result.images[0] || "";
    result.title = clean(result.title, 160);
    result.brand = clean(result.brand, 60);
    if (result.brand && result.brand === result.brand.toUpperCase() && /[A-Z]{4}/.test(result.brand)) result.brand = result.brand.toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
    result.description = clean(result.description, 600);
    result.category = clean(result.category, 120);
    var p = prefixInfo(code);
    if (!result.brand && p) result.brand = p.brand;
    result.lane = laneFor(result.title + " " + result.category, result.brand);
    if (result.lane === "other" && p) result.lane = p.lane;
    var hay = [result.title, result.model].concat(result.models || []).join(" ");
    result.mattelCodes = result.lane === "hot-wheels" || result.lane === "matchbox" || /mattel/i.test(result.brand) ? mattelCodes(hay) : [];
    return result;
  }

  function parseBarcodeReport(json, code) {
    if (!json || !json.product || !json.product.name) return null;
    var p = json.product;
    var ev = Array.isArray(json.evidence) ? json.evidence : [];
    var images = [];
    var retail = ev.filter(function (e) { return e && e.source && e.source.type === "retailer"; });
    retail.forEach(function (e) { addImage(images, e.image_url); });
    ev.forEach(function (e) { if (e && /amazon/i.test((e.source && e.source.name) || "")) addImage(images, e.image_url); });
    addImage(images, p.image_url);
    ev.forEach(function (e) { if (e) addImage(images, e.image_url); });
    var brands = Array.isArray(p.brands) ? p.brands : [];
    var brand = "";
    if (p.manufacturer && brands.some(function (b) { return String(b).toLowerCase() === String(p.manufacturer).toLowerCase(); })) brand = p.manufacturer;
    if (!brand) brands.forEach(function (b) { if (!brand && laneFor("", b) !== "other") brand = b; });
    if (!brand) brand = p.manufacturer || brands[0] || "";
    var category = "";
    ev.forEach(function (e) { if (e && e.category && (!category || (/>/.test(e.category) && e.category.length > category.length && !/INTERACTIVE SOFTWARE/i.test(e.category)))) category = e.category; });
    var description = "";
    ev.forEach(function (e) {
      var d = e && e.description ? String(e.description) : "";
      if (/^[\d\s]+$/.test(d) || /^EAN:/i.test(d)) return;
      if (d.length > description.length) description = d;
    });
    if (!description && p.description && String(p.description).toLowerCase() !== String(brand).toLowerCase() && brands.map(function (b) { return String(b).toLowerCase(); }).indexOf(String(p.description).toLowerCase()) === -1) description = p.description;
    var models = [];
    ev.forEach(function (e) { if (e && e.model && models.indexOf(e.model) === -1) models.push(String(e.model)); if (e && e.sku && /^[A-Z]{3}\d{2}$/.test(e.sku) && models.indexOf(e.sku) === -1) models.push(e.sku); });
    var titleEv = retail[0] && retail[0].title ? retail[0].title : "";
    return finish({
      source: "barcode-report",
      sourceName: "barcode.report",
      sourceUrl: (json.links && json.links.html) || "https://barcode.report/gtin/" + gtin14(code),
      title: p.name || titleEv,
      altTitle: titleEv && titleEv !== p.name ? titleEv : "",
      brand: brand,
      category: category,
      description: description,
      model: models[0] || "",
      models: models,
      msrp: null,
      images: images,
      evidenceCount: json.source_count || ev.length,
    }, code);
  }

  function parseOpenFacts(json, code, source) {
    if (!json || json.status !== 1 || !json.product) return null;
    var p = json.product;
    var title = p.product_name_en || p.product_name || p.generic_name_en || p.generic_name || "";
    if (!title) return null;
    var images = [];
    addImage(images, p.image_front_url || p.image_url);
    addImage(images, p.image_url);
    var host = source === "open-food-facts" ? "https://world.openfoodfacts.org" : "https://world.openproductsfacts.org";
    return finish({
      source: source,
      sourceName: source === "open-food-facts" ? "Open Food Facts" : "Open Products Facts",
      sourceUrl: host + "/product/" + (gtin14(code) || code).replace(/^0+(?=\d{13}$)/, ""),
      title: title,
      brand: String(p.brands || "").split(",")[0],
      category: String(p.categories || "").split(",").slice(-1)[0] || "",
      description: p.generic_name_en || p.generic_name || "",
      model: "",
      models: [],
      msrp: null,
      images: images,
    }, code);
  }

  /* UPCitemdb lookup JSON (trial or paid), as returned through an owner proxy. */
  function parseUpcItemDb(json, code) {
    var item = json && Array.isArray(json.items) ? json.items[0] : null;
    if (!item || !item.title) return null;
    var images = [];
    (item.images || []).forEach(function (u) { addImage(images, u); });
    var msrp = num(item.msrp) || null;
    return finish({
      source: "proxy",
      sourceName: "UPCitemdb",
      sourceUrl: "https://www.upcitemdb.com/upc/" + (shortForm(code) || code),
      title: item.title,
      brand: item.brand || "",
      category: item.category || "",
      description: item.description || "",
      model: item.model || "",
      models: [item.model, item.mpn].filter(Boolean),
      msrp: msrp,
      priceRange: num(item.lowest_recorded_price) && num(item.highest_recorded_price) ? [num(item.lowest_recorded_price), num(item.highest_recorded_price)] : null,
      images: images,
    }, code);
  }

  function searchLinks(code, title) {
    var c = shortForm(code) || digits(code);
    var q = encodeURIComponent(c);
    var links = [
      { id: "google", label: "Google Shopping", url: "https://www.google.com/search?tbm=shop&q=" + q },
      { id: "ebay", label: "eBay sold", url: "https://www.ebay.com/sch/i.html?_nkw=" + q + "&LH_Sold=1&LH_Complete=1" },
      { id: "amazon", label: "Amazon", url: "https://www.amazon.com/s?k=" + q + "&tag=" + AMAZON_TAG },
    ];
    if (gtin14(code)) {
      links.push({ id: "barcode-report", label: "barcode.report", url: "https://barcode.report/gtin/" + gtin14(code) });
      links.push({ id: "upcitemdb", label: "UPCitemdb", url: "https://www.upcitemdb.com/upc/" + c });
    }
    if (title) links.unshift({ id: "ebay-title", label: "eBay sold by name", url: "https://www.ebay.com/sch/i.html?_nkw=" + encodeURIComponent(String(title).slice(0, 80)) + "&LH_Sold=1&LH_Complete=1" });
    return links;
  }

  /* ---------- cache ---------- */
  function memoryCache() {
    var rows = {};
    var learned = {};
    return {
      get: function (key) { return Promise.resolve(rows[key] || null); },
      put: function (key, value) { rows[key] = value; return Promise.resolve(value); },
      learned: function (key) { return Promise.resolve(learned[key] || null); },
      learn: function (key, value) { learned[key] = value; return Promise.resolve(value); },
      learnedAll: function () { return Promise.resolve(Object.keys(learned).map(function (k) { return Object.assign({ key: k }, learned[k]); })); },
      clear: function () { rows = {}; learned = {}; return Promise.resolve(); },
    };
  }

  function idbCache() {
    var idb = typeof indexedDB !== "undefined" ? indexedDB : null;
    if (!idb) return memoryCache();
    var opening = null;
    function open() {
      if (opening) return opening;
      opening = new Promise(function (resolve, reject) {
        var req = idb.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains("lookups")) db.createObjectStore("lookups");
          if (!db.objectStoreNames.contains("learned")) db.createObjectStore("learned");
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      }).catch(function (err) { opening = null; throw err; });
      return opening;
    }
    function tx(storeName, mode, fn) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction(storeName, mode);
          var st = t.objectStore(storeName);
          var req = fn(st);
          t.oncomplete = function () { resolve(req && req.result !== undefined ? req.result : null); };
          t.onerror = function () { reject(t.error); };
          t.onabort = function () { reject(t.error); };
        });
      });
    }
    var fallback = memoryCache();
    return {
      get: function (key) { return tx("lookups", "readonly", function (st) { return st.get(key); }).catch(function () { return fallback.get(key); }); },
      put: function (key, value) { return tx("lookups", "readwrite", function (st) { return st.put(value, key); }).then(function () { return value; }).catch(function () { return fallback.put(key, value); }); },
      learned: function (key) { return tx("learned", "readonly", function (st) { return st.get(key); }).catch(function () { return fallback.learned(key); }); },
      learn: function (key, value) { return tx("learned", "readwrite", function (st) { return st.put(value, key); }).then(function () { return value; }).catch(function () { return fallback.learn(key, value); }); },
      /* the learned catalog: every confirmed find, keyed by GTIN-14 or "code:<CODE>" */
      learnedAll: function () {
        return open().then(function (db) {
          return new Promise(function (resolve, reject) {
            var out = [];
            var t = db.transaction("learned", "readonly");
            var req = t.objectStore("learned").openCursor();
            req.onsuccess = function () {
              var cur = req.result;
              if (!cur) return;
              out.push(Object.assign({ key: String(cur.key) }, cur.value));
              cur.continue();
            };
            t.oncomplete = function () { resolve(out); };
            t.onerror = function () { reject(t.error); };
          });
        }).catch(function () { return fallback.learnedAll(); });
      },
      clear: function () { return tx("lookups", "readwrite", function (st) { return st.clear(); }).then(function () { return tx("learned", "readwrite", function (st) { return st.clear(); }); }).catch(function () {}); },
    };
  }

  /* ---------- network ---------- */
  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; reject(new Error("timeout")); } }, ms);
      promise.then(function (v) { if (!done) { done = true; clearTimeout(timer); resolve(v); } }, function (e) { if (!done) { done = true; clearTimeout(timer); reject(e); } });
    });
  }

  function getJson(fetchFn, url, ms) {
    return withTimeout(fetchFn(url, { headers: { Accept: "application/json" }, credentials: "omit", referrerPolicy: "no-referrer" }), ms).then(function (res) {
      if (res.status === 404 || res.status === 410) return { status: "miss", json: null };
      if (res.status === 429) return { status: "limited", json: null };
      if (!res.ok) return { status: "error", json: null };
      return res.json().then(function (json) { return { status: "ok", json: json }; });
    }).catch(function (err) {
      return { status: err && err.message === "timeout" ? "timeout" : "offline", json: null };
    });
  }

  function proxyUrl(store) {
    try {
      var v = store && store.getItem ? store.getItem(PROXY_KEY) : "";
      return v && /^https:\/\//i.test(v) ? v : "";
    } catch (err) {
      return "";
    }
  }

  function plan(code, opts) {
    var g = gtin14(code);
    var s = shortForm(code);
    var steps = [
      { id: "barcode-report", url: "https://barcode.report/api/v1/products/" + g, parse: parseBarcodeReport },
    ];
    if (opts.proxy) steps.push({ id: "proxy", url: opts.proxy + (opts.proxy.indexOf("?") === -1 ? "?upc=" : "&upc=") + encodeURIComponent(s), parse: parseUpcItemDb });
    steps.push({ id: "open-products-facts", url: "https://world.openproductsfacts.org/api/v2/product/" + g.slice(1) + ".json", parse: function (j, c) { return parseOpenFacts(j, c, "open-products-facts"); } });
    steps.push({ id: "open-food-facts", url: "https://world.openfoodfacts.org/api/v2/product/" + g.slice(1) + ".json?fields=product_name,product_name_en,generic_name,generic_name_en,brands,categories,image_front_url,image_url", parse: function (j, c) { return parseOpenFacts(j, c, "open-food-facts"); } });
    return steps;
  }

  /* lookup(code, { fetch, cache, proxy, timeoutMs, now, force }) */
  function lookup(code, opts) {
    opts = opts || {};
    var g = gtin14(code);
    var out = { code: shortForm(code) || digits(code), gtin14: g, hit: false, result: null, tried: [], cached: false, links: searchLinks(code) };
    if (!g) {
      out.tried.push({ source: "web", status: "skip", note: "Not a retail barcode. Web databases only know UPC / EAN codes." });
      return Promise.resolve(out);
    }
    var cache = opts.cache || memoryCache();
    var now = opts.now || Date.now();
    var fetchFn = opts.fetch || (typeof fetch === "function" ? fetch.bind(typeof window !== "undefined" ? window : globalThis) : null);
    return cache.get(g).catch(function () { return null; }).then(function (saved) {
      var fresh = saved && saved.at && (saved.hit ? now - saved.at < HIT_TTL : now - saved.at < MISS_TTL);
      if (saved && !opts.force && (fresh || (!fetchFn) || (typeof navigator !== "undefined" && navigator.onLine === false))) {
        out.hit = !!saved.hit;
        out.result = saved.result || null;
        out.tried = saved.tried || [];
        out.cached = true;
        out.cachedAt = saved.at;
        if (out.result) out.links = searchLinks(code, out.result.title);
        return out;
      }
      if (!fetchFn) {
        out.tried.push({ source: "web", status: "offline" });
        return out;
      }
      var steps = plan(code, opts);
      var i = 0;
      function next() {
        if (i >= steps.length) return Promise.resolve(null);
        var step = steps[i++];
        return getJson(fetchFn, step.url, opts.timeoutMs || 6000).then(function (res) {
          var parsed = null;
          if (res.status === "ok") {
            try { parsed = step.parse(res.json, code); } catch (err) { parsed = null; }
          }
          out.tried.push({ source: step.id, status: parsed ? "hit" : res.status === "ok" ? "miss" : res.status });
          return parsed || next();
        });
      }
      return next().then(function (result) {
        out.hit = !!result;
        out.result = result;
        if (result) out.links = searchLinks(code, result.title);
        var allOffline = out.tried.length && out.tried.every(function (t) { return t.status === "offline" || t.status === "timeout"; });
        if (allOffline && saved) {
          out.hit = !!saved.hit;
          out.result = saved.result || null;
          out.cached = true;
          out.cachedAt = saved.at;
          return out;
        }
        if (!allOffline) cache.put(g, { at: now, hit: out.hit, result: out.result, tried: out.tried }).catch(function () {});
        return out;
      });
    });
  }

  /* ---------- Hunt's own code index (data/upc/) ---------- */
  /* Six shards by first character. Keep in sync with scripts/build-upc-index.mjs. */
  function shardOf(key) {
    var c = String(key || "").charAt(0).toUpperCase();
    if (/[0-9]/.test(c)) return "0";
    if (/[A-F]/.test(c)) return "A";
    if (c === "G" || c === "H" || c === "J") return c;
    if (/[I-Z]/.test(c)) return "K";
    return "_";
  }

  function hwThumb(t) {
    var s = String(t || "");
    return /^[0-9a-f]{20}$/.test(s) ? "assets/hw/thumbs/" + s.slice(0, 2) + "/" + s + ".webp" : s;
  }

  function rowOf(r) {
    if (!Array.isArray(r)) return r;
    if (r.length === 4) return { id: "hw:" + r[1] + ":" + r[0] + ":" + r[2] + ":" + r[3], name: r[0], year: r[1], line: r[2], thumb: hwThumb(r[3]), lane: "hot-wheels", source: "hw" };
    return { id: r[0], name: r[1], year: r[2], line: r[3], thumb: r[4] || "", lane: r[5] || "other", source: r[6] || "catalog" };
  }

  /* fetchJson(path) -> Promise<json>. Returns rows [{id,name,year,line,thumb,lane,source}] for a code. */
  function codeIndex(fetchJson, base) {
    var prefix = base == null ? "data/upc/" : base;
    var shards = {};
    function shard(name) {
      if (!shards[name]) shards[name] = fetchJson(prefix + "codes-" + name + ".json").catch(function () { delete shards[name]; return { codes: {} }; });
      return shards[name];
    }
    return {
      find: function (raw) {
        var keys = [];
        var d = digits(raw).toUpperCase();
        if (d) keys.push(d);
        var mk = mattelKey(raw);
        if (mk && keys.indexOf(mk) === -1) keys.push(mk);
        var short = shortForm(raw);
        if (short && keys.indexOf(short) === -1) keys.push(short);
        return Promise.all(keys.map(function (k) {
          return shard(shardOf(k)).then(function (json) { return (json && json.codes && json.codes[k]) || []; });
        })).then(function (lists) {
          var seen = {};
          var rows = [];
          lists.forEach(function (list, li) {
            list.forEach(function (r) {
              var row = rowOf(r);
              if (seen[row.id]) return;
              seen[row.id] = true;
              row = Object.assign({}, row, { code: keys[li] });
              rows.push(row);
            });
          });
          return rows;
        });
      },
    };
  }

  /* ---------- Mattel assortments (data/upc/assortments.json) ----------
   * Some Mattel lines print one UPC per assortment (case), shared by every
   * item in it: Monster Trucks 1:64 = FYJ44. The barcode then names the
   * case, not the truck, so the app asks "Which one is it?" and the item
   * code on the card back (JDP89) picks the exact one.
   * json = { upcs: {upc12: asst}, aliases: {code: asst}, assortments: {asst: {...,
   *   items: [[code, name, year, series, thumb, years]], hwLine, hwYears}} }
   */
  function assortItem(asst, r) {
    if (!Array.isArray(r)) return r;
    return { code: r[0] || "", name: r[1], year: r[2], series: r[3] || "", thumb: hwThumb(r[4]), years: r[5] || String(r[2] || ""), assortment: asst, lane: "hot-wheels" };
  }

  function assortKeyOf(json, raw) {
    if (!json) return null;
    var A = json.assortments || {};
    var al = json.aliases || {};
    var short = shortForm(raw);
    if (short && json.upcs && json.upcs[short]) return json.upcs[short];
    var s = String(raw == null ? "" : raw).toUpperCase().replace(/[\s-]/g, "");
    if (A[s]) return s;
    if (al[s]) return al[s];
    return null;
  }

  function assortIndex(fetchJson, base) {
    var prefix = base == null ? "data/" : base;
    var main = null;
    var hw = {};
    function load() {
      if (!main) main = fetchJson(prefix + "upc/assortments.json").catch(function () { main = null; return null; });
      return main;
    }
    function items(key) {
      return load().then(function (json) {
        var a = json && json.assortments && json.assortments[key];
        if (!a) return [];
        var own = (a.items || []).map(function (r) { return assortItem(key, r); });
        if (!a.hwLine) return own;
        /* mainline-style assortments reuse the Hot Wheels year index */
        return Promise.all((a.hwYears || []).map(function (y) {
          if (!hw[y]) hw[y] = fetchJson(prefix + "hw/idx/" + y + ".json").catch(function () { delete hw[y]; return { items: [] }; });
          return hw[y].then(function (part) {
            return (part.items || []).filter(function (it) { return it.l === a.hwLine; }).map(function (it) {
              return { code: it.t || "", name: it.n, year: it.y, series: it.s || "", thumb: it.i || "", years: String(it.y || ""), assortment: key, lane: "hot-wheels" };
            });
          });
        })).then(function (lists) { return own.concat.apply(own, lists); });
      });
    }
    return {
      load: load,
      /* raw: scanned / typed code; web: lookup result (model + Mattel codes) */
      match: function (raw, web) {
        return load().then(function (json) {
          if (!json) return null;
          var key = assortKeyOf(json, raw);
          if (!key && web) {
            var cands = [web.model].concat(web.mattelCodes || []);
            for (var i = 0; i < cands.length && !key; i++) key = cands[i] ? assortKeyOf(json, cands[i]) : null;
          }
          if (!key) return null;
          var a = json.assortments[key];
          return { key: key, name: a.name, brand: a.brand || "Hot Wheels", image: a.image || "", sourceUrl: a.sourceUrl || "", note: a.note || "", example: a.example || "" };
        });
      },
      items: items,
      /* exact item for a card-back code (JDP89 or JDP89-0910), across assortments */
      itemByCode: function (raw) {
        var mk = mattelKey(raw);
        if (!mk) return Promise.resolve(null);
        return load().then(function (json) {
          var A = (json && json.assortments) || {};
          var keys = Object.keys(A);
          var hit = null;
          keys.forEach(function (k) {
            (A[k].items || []).forEach(function (r) { if (!hit && r[0] === mk) hit = assortItem(k, r); });
          });
          return hit;
        });
      },
    };
  }

  /* newest first, then series and name; filter by item code or words */
  function sortAssort(list) {
    return list.slice().sort(function (a, b) {
      var ya = parseInt(String(a.years || a.year).split(/\D+/).filter(Boolean).sort().pop() || a.year, 10) || 0;
      var yb = parseInt(String(b.years || b.year).split(/\D+/).filter(Boolean).sort().pop() || b.year, 10) || 0;
      if (ya !== yb) return yb - ya;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  function filterAssort(list, q) {
    var s = String(q || "").trim().toUpperCase().replace(/[\s-]+/g, " ");
    if (!s) return list;
    var mk = mattelKey(s.replace(/ /g, ""));
    if (mk) return list.filter(function (it) { return it.code === mk; });
    var words = s.split(" ");
    return list.filter(function (it) {
      var hay = (it.name + " " + it.series + " " + it.code).toUpperCase();
      return words.every(function (w) { return hay.indexOf(w) !== -1; });
    });
  }

  return {
    AMAZON_TAG: AMAZON_TAG,
    SOURCES: SOURCES,
    PREFIXES: PREFIXES,
    PROXY_KEY: PROXY_KEY,
    HIT_TTL: HIT_TTL,
    MISS_TTL: MISS_TTL,
    isRetailCode: isRetailCode,
    gtin14: gtin14,
    shortForm: shortForm,
    prefixInfo: prefixInfo,
    laneFor: laneFor,
    mattelKey: mattelKey,
    mattelCodes: mattelCodes,
    goodImage: goodImage,
    parseBarcodeReport: parseBarcodeReport,
    parseOpenFacts: parseOpenFacts,
    parseUpcItemDb: parseUpcItemDb,
    searchLinks: searchLinks,
    memoryCache: memoryCache,
    idbCache: idbCache,
    proxyUrl: proxyUrl,
    lookup: lookup,
    shardOf: shardOf,
    codeIndex: codeIndex,
    assortIndex: assortIndex,
    assortKeyOf: assortKeyOf,
    sortAssort: sortAssort,
    filterAssort: filterAssort,
  };
});
