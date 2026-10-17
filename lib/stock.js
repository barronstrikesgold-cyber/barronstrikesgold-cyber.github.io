/* Hunt inventory tracker data layer.
 * The UI only talks to a Store built on an adapter. An adapter is any object with
 *   list() -> Promise<items[]>, put(item) -> Promise, remove(id) -> Promise,
 *   bulkPut(items) -> Promise, getMeta(key) -> Promise, setMeta(key, value) -> Promise, clear() -> Promise
 * Today the default adapter is IndexedDB on this phone (memory in tests). A Shopify Admin API
 * adapter can be dropped in with the same seven methods without rewriting the UI. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HuntStockData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var DB_NAME = "hunt-stock";
  var DB_VERSION = 1;
  var DEFAULT_TAX = 9.7;
  var SITE = "https://barronstrikesgold-cyber.github.io/";

  var LANES = [
    ["hot-wheels", "Hot Wheels"],
    ["matchbox", "Matchbox"],
    ["pokemon", "Pokémon"],
    ["funko", "Funko"],
    ["sneakers", "Sneakers"],
    ["lego", "LEGO"],
    ["other", "Other"],
  ];
  var VARIANTS = [
    ["", "Regular"],
    ["sth", "STH"],
    ["th", "TH"],
    ["chase", "Chase"],
    ["sealed", "Sealed"],
    ["raw", "Raw"],
    ["graded", "Graded"],
  ];
  var STATUSES = [
    ["in-stock", "In stock"],
    ["listed", "Listed"],
    ["at-show", "At show"],
    ["held-grading", "Held for grading"],
    ["sold", "Sold"],
  ];
  var CONDITIONS = ["New / sealed", "Mint card", "Card damage", "Loose", "Near mint", "Lightly played", "Used", "Damaged"];
  var CHANNELS = [
    ["show", "Show"],
    ["ebay", "eBay"],
    ["local", "Local / FB"],
    ["shopify", "Shopify"],
    ["other", "Other"],
  ];

  function label(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i][0] === id) return list[i][1];
    return id || "";
  }

  function num(value) {
    if (value === "" || value == null) return null;
    var n = Number(String(value).replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function today() {
    var d = new Date();
    var local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function newId(prefix) {
    return (prefix || "stk") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function pick(list, value, fallback) {
    for (var i = 0; i < list.length; i++) if (list[i][0] === value) return value;
    return fallback;
  }

  function normalize(raw) {
    raw = raw || {};
    var qty = num(raw.qty);
    var tax = num(raw.taxPct);
    var item = {
      id: raw.id ? String(raw.id) : newId(),
      lane: pick(LANES, raw.lane, "other"),
      name: String(raw.name || "").trim(),
      variant: pick(VARIANTS, raw.variant || "", ""),
      grade: String(raw.grade || "").trim(),
      qty: qty == null ? 1 : Math.max(0, Math.floor(qty)),
      cost: num(raw.cost),
      taxPct: tax == null ? DEFAULT_TAX : tax,
      purchaseDate: String(raw.purchaseDate || ""),
      store: String(raw.store || ""),
      condition: String(raw.condition || ""),
      photo: String(raw.photo || ""),
      imageUrl: /^https:\/\//i.test(String(raw.imageUrl || "")) ? String(raw.imageUrl) : "",
      imageLocal: /^data:image\//i.test(String(raw.imageLocal || "")) ? String(raw.imageLocal) : "",
      brand: String(raw.brand || "").trim(),
      description: String(raw.description || ""),
      msrp: num(raw.msrp),
      lookupSource: String(raw.lookupSource || ""),
      lookupUrl: /^https:\/\//i.test(String(raw.lookupUrl || "")) ? String(raw.lookupUrl) : "",
      bin: String(raw.bin || ""),
      status: pick(STATUSES, raw.status, "in-stock"),
      code: String(raw.code || ""),
      compId: String(raw.compId || ""),
      myEstimate: num(raw.myEstimate),
      listPrice: num(raw.listPrice),
      notes: String(raw.notes || ""),
      sales: Array.isArray(raw.sales) ? raw.sales.map(normalizeSale).filter(Boolean) : [],
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };

    return item;
  }

  function normalizeSale(raw) {
    if (!raw) return null;
    var price = num(raw.price);
    if (price == null) return null;
    var qty = num(raw.qty);
    return {
      id: raw.id ? String(raw.id) : newId("sale"),
      qty: qty == null || qty < 1 ? 1 : Math.floor(qty),
      price: price,
      channel: pick(CHANNELS, raw.channel, "other"),
      pay: raw.pay === "card" ? "card" : raw.pay === "cash" ? "cash" : "",
      date: String(raw.date || today()),
      at: raw.at || new Date().toISOString(),
      unitCost: num(raw.unitCost),
    };
  }

  /* Cost of one unit including sales tax paid. Null when cost is unknown. */
  function unitCost(item) {
    if (item.cost == null) return null;
    return round2(item.cost * (1 + (Number(item.taxPct) || 0) / 100));
  }

  /* eBay-equivalent net uses the house formula sold * 0.87 - 5. */
  function ebayNet(sold) {
    var s = num(sold);
    if (s == null) return null;
    return round2(s * 0.87 - 5);
  }

  function saleNet(sale) {
    var gross = sale.price * sale.qty;
    if (sale.channel === "ebay") return round2((sale.price * 0.87 - 5) * sale.qty);
    return round2(gross);
  }

  function saleProfit(sale) {
    if (sale.unitCost == null) return null;
    return round2(saleNet(sale) - sale.unitCost * sale.qty);
  }

  function recordSale(item, sale) {
    var row = normalizeSale(Object.assign({ unitCost: unitCost(item) }, sale));
    if (!row) return { ok: false, error: "Type a sold price." };
    if (item.qty < row.qty) return { ok: false, error: "Only " + item.qty + " left." };
    item.sales.push(row);
    item.qty -= row.qty;
    if (item.qty === 0) item.status = "sold";
    item.updatedAt = new Date().toISOString();
    return { ok: true, sale: row };
  }

  function undoSale(item, saleId) {
    var idx = -1;
    item.sales.forEach(function (s, i) { if (s.id === saleId) idx = i; });
    if (idx === -1) return false;
    var sale = item.sales.splice(idx, 1)[0];
    item.qty += sale.qty;
    if (item.status === "sold" && item.qty > 0) item.status = sale.channel === "show" ? "at-show" : "in-stock";
    item.updatedAt = new Date().toISOString();
    return true;
  }

  /* value(item) -> { value, kind } from the caller's verified comp, else the owner's own estimate, else null. */
  function totals(items, valueOf) {
    var out = { units: 0, skus: 0, costBasis: 0, costUnknown: 0, estValue: 0, valued: 0, unvalued: 0, realized: 0, salesCount: 0, gross: 0, profitUnknown: 0 };
    (items || []).forEach(function (item) {
      if (item.qty > 0) {
        out.skus += 1;
        out.units += item.qty;
        var uc = unitCost(item);
        if (uc == null) out.costUnknown += item.qty;
        else out.costBasis += uc * item.qty;
        var v = valueOf ? valueOf(item) : null;
        if (v && v.value != null) {
          out.estValue += v.value * item.qty;
          out.valued += item.qty;
        } else out.unvalued += item.qty;
      }
      (item.sales || []).forEach(function (sale) {
        out.salesCount += sale.qty;
        out.gross += sale.price * sale.qty;
        var p = saleProfit(sale);
        if (p == null) out.profitUnknown += 1;
        else out.realized += p;
      });
    });
    ["costBasis", "estValue", "realized", "gross"].forEach(function (k) { out[k] = round2(out[k]); });
    return out;
  }

  function dailySummary(items, date, channel) {
    var day = date || today();
    var rows = [];
    (items || []).forEach(function (item) {
      (item.sales || []).forEach(function (sale) {
        if (sale.date !== day) return;
        if (channel && sale.channel !== channel) return;
        rows.push({ item: item, sale: sale });
      });
    });
    rows.sort(function (a, b) { return String(b.sale.at).localeCompare(String(a.sale.at)); });
    var sum = { date: day, count: 0, gross: 0, cash: 0, card: 0, profit: 0, profitUnknown: 0, rows: rows };
    rows.forEach(function (r) {
      var gross = r.sale.price * r.sale.qty;
      sum.count += r.sale.qty;
      sum.gross += gross;
      if (r.sale.pay === "card") sum.card += gross;
      else if (r.sale.pay === "cash") sum.cash += gross;
      var p = saleProfit(r.sale);
      if (p == null) sum.profitUnknown += 1;
      else sum.profit += p;
    });
    ["gross", "cash", "card", "profit"].forEach(function (k) { sum[k] = round2(sum[k]); });
    return sum;
  }

  function showDays(items) {
    var days = {};
    (items || []).forEach(function (item) {
      (item.sales || []).forEach(function (sale) { if (sale.channel === "show") days[sale.date] = true; });
    });
    return Object.keys(days).sort().reverse();
  }

  /* ---------- CSV ---------- */
  var CSV_COLUMNS = ["id", "lane", "name", "variant", "grade", "qty", "cost", "taxPct", "purchaseDate", "store", "condition", "bin", "status", "code", "compId", "myEstimate", "listPrice", "notes", "soldPrice", "soldChannel", "soldDate", "salesJson", "brand", "imageUrl", "msrp", "description", "lookupSource", "lookupUrl"];

  function cell(value) {
    var text = value == null ? "" : String(value);
    if (/[",\n\r]/.test(text) || /^\s|\s$/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function toCsv(items) {
    var lines = [CSV_COLUMNS.join(",")];
    (items || []).forEach(function (item) {
      var last = item.sales && item.sales.length ? item.sales[item.sales.length - 1] : null;
      var row = Object.assign({}, item, {
        soldPrice: last ? last.price : "",
        soldChannel: last ? last.channel : "",
        soldDate: last ? last.date : "",
        salesJson: item.sales && item.sales.length ? JSON.stringify(item.sales) : "",
      });
      lines.push(CSV_COLUMNS.map(function (key) { return cell(row[key]); }).join(","));
    });
    return lines.join("\n") + "\n";
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = "";
    var quoted = false;
    var s = String(text || "").replace(/^\uFEFF/, "");
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (quoted) {
        if (ch === '"') {
          if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
        } else field += ch;
        continue;
      }
      if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && s[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += ch;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function fromCsv(text) {
    var rows = parseCsv(text);
    if (!rows.length) return { ok: false, error: "The file is empty.", items: [] };
    var head = rows[0].map(function (h) { return h.trim(); });
    if (head.indexOf("name") === -1) return { ok: false, error: "The file needs a name column.", items: [] };
    var items = [];
    rows.slice(1).forEach(function (cols) {
      var raw = {};
      head.forEach(function (key, i) { raw[key] = cols[i] == null ? "" : cols[i]; });
      if (!String(raw.name || "").trim()) return;
      var sales = [];
      if (raw.salesJson) {
        try { sales = JSON.parse(raw.salesJson); } catch (err) { sales = []; }
      } else if (raw.soldPrice) {
        sales = [{ price: raw.soldPrice, channel: raw.soldChannel, date: raw.soldDate }];
      }
      raw.sales = sales;
      items.push(normalize(raw));
    });
    return { ok: true, items: items };
  }

  /* ---------- Shopify product CSV ---------- */
  var SHOPIFY_COLUMNS = ["Handle", "Title", "Body (HTML)", "Vendor", "Product Type", "Tags", "Published", "Option1 Name", "Option1 Value", "Variant SKU", "Variant Grams", "Variant Inventory Tracker", "Variant Inventory Qty", "Variant Inventory Policy", "Variant Fulfillment Service", "Variant Price", "Variant Requires Shipping", "Variant Taxable", "Cost per item", "Image Src", "Image Alt Text", "Status"];
  var VENDORS = { "hot-wheels": "Hot Wheels", matchbox: "Matchbox", pokemon: "Pokémon", funko: "Funko", sneakers: "", lego: "LEGO", other: "" };

  function handleize(text) {
    return String(text || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
  }

  function publicImage(src) {
    var s = String(src || "");
    if (!s || /^data:/i.test(s) || /^blob:/i.test(s)) return "";
    if (/^https:\/\//i.test(s)) return s;
    if (/^https?:/i.test(s)) return "";
    return SITE + s.replace(/^\.?\//, "");
  }

  function sku(item) {
    if (item.code) return item.code;
    return "HUNT-" + String(item.id).replace(/[^A-Za-z0-9]/g, "").slice(-10).toUpperCase();
  }

  /* priceOf(item) returns the asking price for Shopify, or null. Never invented: listPrice, then a verified comp. */
  function toShopifyCsv(items, priceOf) {
    var lines = [SHOPIFY_COLUMNS.join(",")];
    var used = {};
    (items || []).filter(function (item) { return item.qty > 0 && item.status !== "sold"; }).forEach(function (item) {
      var title = item.name + (item.variant ? " (" + label(VARIANTS, item.variant) + (item.variant === "graded" && item.grade ? " " + item.grade : "") + ")" : "");
      var handle = handleize(title);
      if (used[handle]) handle += "-" + String(item.id).slice(-5).toLowerCase();
      used[handle] = true;
      var price = item.listPrice != null ? item.listPrice : priceOf ? priceOf(item) : null;
      var tags = [label(LANES, item.lane), item.variant ? label(VARIANTS, item.variant) : "", item.condition, item.bin ? "bin-" + item.bin : ""].filter(Boolean).join(", ");
      var uc = unitCost(item);
      var img = publicImage(item.photo) || publicImage(item.imageUrl);
      var row = {
        "Handle": handle,
        "Title": title,
        "Body (HTML)": [item.description, item.notes].filter(Boolean).map(function (t) { return "<p>" + String(t).replace(/[<>&]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]; }) + "</p>"; }).join(""),
        "Vendor": item.brand || VENDORS[item.lane] || "",
        "Product Type": label(LANES, item.lane),
        "Tags": tags,
        "Published": "FALSE",
        "Option1 Name": "Title",
        "Option1 Value": "Default Title",
        "Variant SKU": sku(item),
        "Variant Grams": "",
        "Variant Inventory Tracker": "shopify",
        "Variant Inventory Qty": item.qty,
        "Variant Inventory Policy": "deny",
        "Variant Fulfillment Service": "manual",
        "Variant Price": price == null ? "" : Number(price).toFixed(2),
        "Variant Requires Shipping": "TRUE",
        "Variant Taxable": "TRUE",
        "Cost per item": uc == null ? "" : uc.toFixed(2),
        "Image Src": img,
        "Image Alt Text": img ? title : "",
        "Status": "draft",
      };
      lines.push(SHOPIFY_COLUMNS.map(function (key) { return cell(row[key]); }).join(","));
    });
    return lines.join("\n") + "\n";
  }

  /* ---------- Adapters ---------- */
  function memoryAdapter(seed) {
    var items = {};
    var meta = {};
    (seed || []).forEach(function (row) { items[row.id] = JSON.parse(JSON.stringify(row)); });
    return {
      kind: "memory",
      list: function () { return Promise.resolve(Object.keys(items).map(function (k) { return JSON.parse(JSON.stringify(items[k])); })); },
      put: function (item) { items[item.id] = JSON.parse(JSON.stringify(item)); return Promise.resolve(); },
      bulkPut: function (rows) { rows.forEach(function (r) { items[r.id] = JSON.parse(JSON.stringify(r)); }); return Promise.resolve(); },
      remove: function (id) { delete items[id]; return Promise.resolve(); },
      getMeta: function (key) { return Promise.resolve(meta[key] == null ? null : JSON.parse(meta[key])); },
      setMeta: function (key, value) { meta[key] = JSON.stringify(value); return Promise.resolve(); },
      clear: function () { items = {}; meta = {}; return Promise.resolve(); },
    };
  }

  function idbAdapter(idb) {
    var factory = idb || (typeof indexedDB !== "undefined" ? indexedDB : null);
    if (!factory) return null;
    var opening = null;
    function open() {
      if (opening) return opening;
      opening = new Promise(function (resolve, reject) {
        var req = factory.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", { keyPath: "id" });
          if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { opening = null; reject(req.error); };
      });
      return opening;
    }
    function tx(store, mode, work) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction(store, mode);
          var out = work(t.objectStore(store));
          t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : undefined); };
          t.onerror = function () { reject(t.error); };
          t.onabort = function () { reject(t.error); };
        });
      });
    }
    return {
      kind: "indexeddb",
      list: function () { return tx("items", "readonly", function (s) { return s.getAll(); }).then(function (rows) { return rows || []; }); },
      put: function (item) { return tx("items", "readwrite", function (s) { s.put(item); }); },
      bulkPut: function (rows) { return tx("items", "readwrite", function (s) { rows.forEach(function (r) { s.put(r); }); }); },
      remove: function (id) { return tx("items", "readwrite", function (s) { s.delete(id); }); },
      getMeta: function (key) { return tx("meta", "readonly", function (s) { return s.get(key); }).then(function (v) { return v == null ? null : v; }); },
      setMeta: function (key, value) { return tx("meta", "readwrite", function (s) { s.put(value, key); }); },
      clear: function () {
        return tx("items", "readwrite", function (s) { s.clear(); }).then(function () {
          return tx("meta", "readwrite", function (s) { s.clear(); });
        });
      },
    };
  }

  /* localStorage fallback for browsers with IndexedDB disabled (private mode on old iOS). */
  function localAdapter(storage) {
    var KEY = "hunt-stock-v1";
    function read() {
      try { return JSON.parse(storage.getItem(KEY) || "{}") || {}; } catch (err) { return {}; }
    }
    function write(data) { storage.setItem(KEY, JSON.stringify(data)); }
    return {
      kind: "localstorage",
      list: function () { var d = read(); return Promise.resolve(Object.keys(d.items || {}).map(function (k) { return d.items[k]; })); },
      put: function (item) { var d = read(); d.items = d.items || {}; d.items[item.id] = item; write(d); return Promise.resolve(); },
      bulkPut: function (rows) { var d = read(); d.items = d.items || {}; rows.forEach(function (r) { d.items[r.id] = r; }); write(d); return Promise.resolve(); },
      remove: function (id) { var d = read(); if (d.items) delete d.items[id]; write(d); return Promise.resolve(); },
      getMeta: function (key) { var d = read(); return Promise.resolve(d.meta && d.meta[key] != null ? d.meta[key] : null); },
      setMeta: function (key, value) { var d = read(); d.meta = d.meta || {}; d.meta[key] = value; write(d); return Promise.resolve(); },
      clear: function () { storage.removeItem(KEY); return Promise.resolve(); },
    };
  }

  /* Placeholder for the Shopify Admin API backend. It documents the contract and refuses to run until
   * a server-side token proxy exists. The phone must never hold an Admin API token. */
  function shopifyAdapter(config) {
    function off() { return Promise.reject(new Error("Shopify sync is not connected yet. Use the Shopify CSV export.")); }
    return {
      kind: "shopify",
      config: { shop: (config && config.shop) || "", proxyUrl: (config && config.proxyUrl) || "" },
      list: off, put: off, bulkPut: off, remove: off, getMeta: off, setMeta: off, clear: off,
    };
  }

  function createStore(adapter) {
    var cache = [];
    var loaded = false;
    var api = {
      adapter: adapter,
      load: function () {
        return adapter.list().then(function (rows) {
          cache = (rows || []).map(normalize);
          cache.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
          loaded = true;
          return cache;
        });
      },
      loaded: function () { return loaded; },
      all: function () { return cache; },
      get: function (id) { return cache.filter(function (r) { return r.id === id; })[0] || null; },
      save: function (raw) {
        var item = normalize(Object.assign({}, raw, { updatedAt: new Date().toISOString() }));
        var at = -1;
        cache.forEach(function (r, i) { if (r.id === item.id) at = i; });
        if (at === -1) cache.unshift(item); else cache[at] = item;
        return adapter.put(item).then(function () { return item; });
      },
      saveAll: function (rows) {
        var items = rows.map(function (r) { return normalize(r); });
        var index = {};
        cache.forEach(function (r, i) { index[r.id] = i; });
        items.forEach(function (item) {
          if (index[item.id] == null) { cache.unshift(item); } else cache[index[item.id]] = item;
        });
        return adapter.bulkPut(items).then(function () { return items; });
      },
      remove: function (id) {
        cache = cache.filter(function (r) { return r.id !== id; });
        return adapter.remove(id);
      },
      clear: function () { cache = []; return adapter.clear(); },
      getMeta: function (k) { return adapter.getMeta(k); },
      setMeta: function (k, v) { return adapter.setMeta(k, v); },
    };
    return api;
  }

  return {
    DB_NAME: DB_NAME,
    DEFAULT_TAX: DEFAULT_TAX,
    LANES: LANES,
    VARIANTS: VARIANTS,
    STATUSES: STATUSES,
    CONDITIONS: CONDITIONS,
    CHANNELS: CHANNELS,
    CSV_COLUMNS: CSV_COLUMNS,
    SHOPIFY_COLUMNS: SHOPIFY_COLUMNS,
    label: label,
    num: num,
    today: today,
    newId: newId,
    normalize: normalize,
    unitCost: unitCost,
    ebayNet: ebayNet,
    saleNet: saleNet,
    saleProfit: saleProfit,
    recordSale: recordSale,
    undoSale: undoSale,
    totals: totals,
    dailySummary: dailySummary,
    showDays: showDays,
    toCsv: toCsv,
    fromCsv: fromCsv,
    parseCsv: parseCsv,
    toShopifyCsv: toShopifyCsv,
    handleize: handleize,
    publicImage: publicImage,
    memoryAdapter: memoryAdapter,
    idbAdapter: idbAdapter,
    localAdapter: localAdapter,
    shopifyAdapter: shopifyAdapter,
    createStore: createStore,
  };
});
