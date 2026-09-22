(function () {
  var C = window.ResellerCash;
  var D = window.ResellerDates;
  var P = window.ResellerPrices;
  var S = window.ResellerSearch;
  var R = window.ResellerProviders;
  var Inv = window.ResellerInventory;

  var TITLES = {
    cars: "Cars",
    sports: "Sports",
    sneakers: "Sneakers",
    tech: "Tech",
    streetwear: "Streetwear",
    golf: "Golf",
  };
  var NOT_TRACKED = {
    sneakers: "Not tracked yet: New Balance 991, 992, and 993. No exact photo was bundled for those models.",
    streetwear: "Not tracked yet: Palace, Stussy, and Chrome Hearts. No exact photo was bundled.",
    golf: "Not tracked yet: Scotty Cameron, Titleist, Ping, TaylorMade, Callaway, Mizuno, Odyssey. No exact photo and no settled sale.",
  };
  var SHOE_SIZES = ["8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12"];
  var CLOTHES_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
  var FAST_SHOES = { 10: 1, 11: 1 };
  var FAST_CLOTHES = { M: 1, L: 1, XL: 1 };
  var STOCK_MARKS = ["On shelf", "Not here", "Sold out"];
  var STORE_NAMES = ["Walmart", "Target", "Goodwill", "Best Buy", "Dollar Tree"];

  var catalog = {};
  var drops = [];
  var stores = [];
  var golf = { look: [], note: "" };
  var seedFile = null;
  var invState = null;
  var bootError = "";
  var stream = null;
  var scanTimer = null;

  var state = {
    tab: "hunt",
    view: "root",
    cat: "",
    storeId: "",
    itemId: "",
    invId: "",
    dropId: "",
    query: "",
    from: "hunt",
    refreshing: false,
    note: "",
    stack: [],
    moveFocus: false,
    profitId: "c:f40",
  };

  var screen = document.getElementById("screen");
  var sheet = document.getElementById("sheet");

  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function money(n) {
    var v = Number(n);
    if (!Number.isFinite(v)) return "Unknown";
    return (v < 0 ? "-" : "") + "$" + Math.abs(v).toFixed(2);
  }

  function shipping() {
    var n = Number(localStorage.getItem("reseller-ship"));
    return Number.isFinite(n) ? n : 0;
  }

  function tax() {
    var n = Number(localStorage.getItem("reseller-tax"));
    return Number.isFinite(n) ? n : 0;
  }

  function titleFor(cat) {
    return TITLES[cat] || cat || "";
  }

  function allCatalog() {
    var list = [];
    Object.keys(catalog).forEach(function (key) {
      (catalog[key] || []).forEach(function (item) {
        item.category = item.category || key;
        list.push(item);
      });
    });
    return list;
  }

  function findCatalog(id) {
    return allCatalog().filter(function (item) { return item.id === id; })[0] || null;
  }

  function findInv(id) {
    return (invState.items || []).filter(function (item) { return item.id === id; })[0] || null;
  }

  function findStore(id) {
    return stores.filter(function (store) { return store.id === id; })[0] || null;
  }

  function findDrop(id) {
    return drops.filter(function (row) { return row.id === id; })[0] || null;
  }

  function gradesFor(category) {
    if (category === "sneakers") return ["Deadstock", "Light wear", "Beat"];
    if (category === "streetwear") return ["NWT", "Used", "Stained"];
    if (category === "tech") return ["Powers on", "Locked", "Dead"];
    return ["Sealed", "Card damage", "Loose"];
  }

  function gradeMap() { return readJson("reseller-grade", {}); }
  function stockMap() { return readJson("reseller-stock", {}); }
  function sizeMap() { return readJson("reseller-sizes", {}); }
  function marksMap() { return readJson("reseller-marks", {}); }

  function gradeOfCatalog(item) {
    return gradeMap()[item.id] || "";
  }

  function storeNamesFor(item) {
    var names = [];
    stores.forEach(function (store) {
      var rows = itemsForStore(store);
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].id === item.id) {
          names.push(store.name);
          break;
        }
      }
    });
    return names;
  }

  function itemsForStore(store) {
    if (!store) return [];
    if (Array.isArray(store.ids)) {
      return store.ids.map(findCatalog).filter(Boolean);
    }
    var list = [];
    (store.cats || []).forEach(function (cat) {
      list = list.concat(catalog[cat] || []);
    });
    return list;
  }

  function invForCatalog(item) {
    return Inv.visible(invState).filter(function (row) {
      return row.catalogId === item.id;
    })[0] || null;
  }

  function invStatusText(item) {
    var hit = invForCatalog(item);
    return hit ? hit.status || "In inventory" : "Not in inventory";
  }

  function badge(kind, label) {
    var file = {
      Strong: "strong",
      Watch: "watch",
      Pass: "pass",
      STH: "sth",
      "Verify STH": "verify",
      Duplicate: "duplicate",
      Sold: "sold",
      "No settled sale": "no-sale",
      "Photo needed": "photo-needed",
    }[kind] || "watch";
    return '<span class="badge badge-' + esc(file === "no-sale" ? "nosale" : file === "photo-needed" ? "photo" : file) + '"><img src="assets/states/' + file + '.svg" alt="">' + esc(label || kind) + "</span>";
  }

  function thumb(item) {
    if (item && item.photoMatched && item.photo) {
      return '<span class="thumb"><img src="' + esc(item.photo) + '" alt="' + esc(item.photoAlt || item.name) + '"></span>';
    }
    return '<span class="thumb thumb-needed"><img src="assets/states/photo-needed.svg" alt=""><em>Photo needed</em></span>';
  }

  function photoBlock(item) {
    if (item && item.photoMatched && item.photo) {
      return '<figure class="gallery"><img src="' + esc(item.photo) + '" alt="' + esc(item.photoAlt || item.name) + '"><figcaption>' + esc(item.photoSource || "Local photograph.") + "</figcaption></figure>";
    }
    return '<div class="photo-needed" role="img" aria-label="Photo needed"><img src="assets/states/scene-empty.svg" alt=""><strong>Photo needed</strong><p>' + esc((item && item.photoSource) || "No exact photo is bundled.") + "</p></div>";
  }

  function retailNum(item) {
    var typed = readJson("reseller-shelf", {})[item.id];
    if (typed != null && typed !== "" && Number.isFinite(Number(typed))) return Number(typed);
    if (item.id === "topps-s1") return 24.99;
    if (item.category === "cars" && Number(item.shelfNum) === 1) return 1;
    if (item.shelfNum != null && /\$\d|about \$/i.test(item.shelf || "")) return Number(item.shelfNum);
    return null;
  }

  function netText(item) {
    var price = P.settledSale(item.id);
    if (!price) return "Unknown";
    var low = C.cashLeft(price.low, shipping());
    var high = C.cashLeft(price.high, shipping());
    if (low == null || high == null) return "Unknown";
    var text = Math.abs(low - high) < 0.009 ? money(low) : money(Math.min(low, high)) + "–" + money(Math.max(low, high));
    var retail = retailNum(item);
    var beat = "";
    if (retail != null) beat = high > retail ? " · beats retail" : " · does not beat retail";
    return text + " after about 13% fees and shipping" + beat;
  }

  function historyRows(id, fallback) {
    var list = (readJson("reseller-history", {})[id] || []).slice(0, 5);
    if (!list.length) return [fallback];
    return list;
  }

  function pushHistory(id, row) {
    if (!id) return;
    var map = readJson("reseller-history", {});
    var list = map[id] || [];
    list.unshift(row);
    map[id] = list.slice(0, 5);
    writeJson("reseller-history", map);
  }

  function fallbackHistory(item) {
    var price = P.settledSale(item.id);
    return {
      time: (price && price.date) || item.date || "No date",
      source: price ? price.source : "No settled sale",
      retail: P.retailLabel(item),
      sold: price ? price.label : "No settled sale",
      enteredBy: price ? "snapshot" : "none",
    };
  }

  function checkLinks(query) {
    var links = [
      ["Walmart", R.CHECK.walmart, "walmart"],
      ["Target", R.CHECK.target, "target"],
      ["Best Buy", R.CHECK.bestbuy, "bestbuy"],
      ["ShopGoodwill", R.CHECK.goodwill, "goodwill"],
      ["Dollar Tree", R.CHECK.dollartree, "dollartree"],
      ["Google", R.CHECK.google, "walmart"],
      ["Google Shopping", R.CHECK.shopping, "target"],
    ];
    return '<div class="check-row">' + links.map(function (link) {
      return '<a href="' + esc(R.checkHref(link[1], query)) + '" target="_blank" rel="noopener noreferrer"><img src="assets/stores/check-' + link[2] + '.svg" alt="">' + esc(link[0]) + "</a>";
    }).join("") + "</div>";
  }

  function isProductUrl(url) {
    if (!url || String(url).indexOf("https://") !== 0) return false;
    return !/search|searchTerm|searchpage|Ntt=|tbm=shop/i.test(url);
  }

  function productLink(url, label) {
    if (!isProductUrl(url)) return '<p class="fine">No product page stored. Search links only.</p>';
    return '<a class="text-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label || "Open product page") + "</a>";
  }

  function catalogRow(item) {
    var fit = item.fitness || "Watch";
    return '<button class="item-row" type="button" data-item="' + esc(item.id) + '">' +
      thumb(item) +
      '<span><span class="row-name">' + esc(item.name) + "</span>" +
      '<span class="row-meta">' + esc(titleFor(item.category)) + " · " + esc(P.retailLabel(item)) + " · Resell " + esc(P.resellLabel(item)) + "</span>" +
      '<span class="row-meta">' + esc(invStatusText(item)) + (gradeOfCatalog(item) ? " · " + esc(gradeOfCatalog(item)) : "") + "</span></span>" +
      badge(fit, fit) + "</button>";
  }

  function invBadgeKind(item) {
    if (item.status === "Sold") return "Sold";
    if (item.tag === "sth") return "STH";
    if (item.tag === "verify-sth") return "Verify STH";
    if (item.tag === "duplicate") return "Duplicate";
    return "Watch";
  }

  function invRow(item) {
    var kind = invBadgeKind(item);
    var target = item.resaleLabel || (item.resaleLow != null ? item.resaleLow + "–" + item.resaleHigh : "none");
    return '<button class="item-row" type="button" data-inv="' + esc(item.id) + '">' +
      thumb(item) +
      '<span><span class="row-name">' + esc(item.name) + "</span>" +
      '<span class="row-meta">' + esc(item.category || "Cars") + " · Cost " + money(item.cost) + " · Target " + esc(target) + "</span>" +
      '<span class="row-meta">' + esc(item.status || "On hand") + (item.grade ? " · " + esc(item.grade) : "") + " · Photo needed</span></span>" +
      badge(kind, kind) + "</button>";
  }

  function strongCards() {
    var html = "";
    S.sortByFitness(allCatalog().filter(function (item) { return item.fitness === "Strong"; })).forEach(function (item) {
      html += catalogRow(item);
    });
    S.sortInventory(Inv.visible(invState).filter(function (item) {
      return item.tag === "sth" || item.tag === "verify-sth";
    })).forEach(function (item) {
      html += invRow(item);
    });
    return html || '<div class="state-card"><img src="assets/states/scene-empty.svg" alt=""><strong>Nothing to verify</strong><p>Strong buys and cars that still need a Super check show up here.</p></div>';
  }

  function summaryBlock() {
    var summary = Inv.portfolio(invState, seedFile);
    return '<section class="stats" aria-label="Portfolio">' +
      stat(summary.packages + " packages", "In this book") +
      stat(summary.investedLabel, "Invested band") +
      stat(summary.targetLabel, "Target band") +
      stat(summary.verifiedSupers + " super · " + summary.toVerify + " to check", "Verified · still to verify") +
      "</section>" +
      '<div class="band-viz" aria-hidden="true"><span class="band-track"><span class="band-fill"></span></span><span class="band-track"><span class="band-fill band-fill-target"></span></span></div>' +
      '<p class="viz-note">Import bands for the 78-package book. Not a live market chart.</p>';
  }

  function huntBody() {
    if (state.query.trim()) {
      var hits = S.sortByFitness(S.searchRecords(searchPool(), state.query), function (rec) {
        return rec.fitness || rec.status || "Pass";
      });
      if (!hits.length) {
        return stateCard("no-results", "No results", "If it is not on this list, leave it.");
      }
      return '<div class="list">' + hits.map(function (rec) {
        if (rec.kind === "inventory") return invRow(rec.ref);
        if (rec.kind === "golf") return golfRow(rec.name);
        return catalogRow(rec.ref);
      }).join("") + "</div>";
    }
    return '<div class="qa-grid">' +
      action("scan", "Scan item") + action("check-price", "Check price") + action("add-purchase", "Add purchase") + action("review-inventory", "Review inventory") +
      "</div>" +
      '<section><p class="kicker">Strong / Verify now</p><div class="list">' + strongCards() + "</div></section>" +
      '<section><p class="kicker">Stores</p><div class="scroll-row">' + stores.map(storeCard).join("") + "</div></section>" +
      '<section><p class="kicker">Categories</p><div class="cat-grid">' +
      ["cars", "sports", "sneakers", "tech", "streetwear", "golf"].map(catCard).join("") +
      "</div></section>";
  }

  function stat(value, label) {
    return '<div class="stat"><b>' + esc(value) + "</b><span>" + esc(label) + "</span></div>";
  }

  function action(name, label) {
    return '<button class="qa" type="button" data-action="' + name + '">' + esc(label) + "</button>";
  }

  function storeCard(store) {
    return '<button class="store-card" type="button" data-store="' + esc(store.id) + '"><img src="assets/stores/' + esc(store.id) + '.svg" alt=""><span>' + esc(store.name) + "</span></button>";
  }

  function catCard(cat) {
    return '<button class="cat-card" type="button" data-cat="' + esc(cat) + '"><img src="assets/categories/' + esc(cat) + '.svg" alt=""><span>' + esc(titleFor(cat)) + "</span></button>";
  }

  function stateCard(kind, title, copy) {
    return '<div class="state-card"><img src="assets/states/scene-' + kind + '.svg" alt=""><strong>' + esc(title) + "</strong><p>" + esc(copy) + "</p></div>";
  }

  function searchPool() {
    var records = allCatalog().map(function (item) {
      return {
        kind: "catalog",
        name: item.name,
        notes: item.digest || "",
        category: item.category,
        categoryTitle: titleFor(item.category),
        stores: storeNamesFor(item).join(" "),
        grade: gradeOfCatalog(item),
        status: invStatusText(item),
        fitness: item.fitness,
        ref: item,
      };
    });
    Inv.visible(invState).forEach(function (item) {
      records.push({
        kind: "inventory",
        name: item.name,
        notes: item.notes || "",
        category: item.category,
        categoryTitle: item.category,
        store: item.store,
        stores: item.store,
        grade: item.grade,
        status: item.status,
        tag: item.tag,
        fitness: item.tag === "sth" ? "STH" : item.tag === "verify-sth" ? "Verify STH" : "Watch",
        ref: item,
      });
    });
    (golf.look || []).forEach(function (name) {
      records.push({
        kind: "golf",
        name: name,
        notes: golf.note,
        category: "golf",
        categoryTitle: "Golf",
        store: "Goodwill",
        stores: "Goodwill",
        status: "Not tracked",
        fitness: "Pass",
      });
    });
    return records;
  }

  function golfRow(name) {
    return '<button class="item-row" type="button" data-golf="' + esc(name) + '">' +
      thumb(null) +
      '<span><span class="row-name">' + esc(name) + '</span><span class="row-meta">Golf · Retail unknown · Resell none</span><span class="row-meta">Not tracked · Photo needed</span></span>' +
      badge("Pass", "Pass") + "</button>";
  }

  function offlineBanner() {
    if (navigator.onLine) return "";
    return '<div class="banner"><img src="assets/states/offline.svg" alt=""><span>Offline. Trusted snapshots and your inventory are still on this phone.</span></div>';
  }

  function renderHunt() {
    return offlineBanner() +
      summaryBlock() +
      '<label class="search"><span>Search</span><input id="hunt-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Name, notes, store, grade, status" value="' + esc(state.query) + '"></label>' +
      '<div id="hunt-body">' + huntBody() + "</div>" +
      visitBlock();
  }

  function visitBlock() {
    var ids = readJson("reseller-visit", []);
    if (!ids.length) return "";
    var names = ids.map(findCatalog).filter(Boolean).map(function (item) { return item.name; });
    if (!names.length) return "";
    return '<section class="tool"><p class="kicker">This visit</p><p>' + esc(names.join(", ")) + '</p><button class="solid" type="button" data-action="visit-done">Done</button></section>';
  }

  function renderStores() {
    return "<h1>Stores</h1>" + offlineBanner() + '<div class="list">' + stores.map(function (store) {
      return '<button class="item-row" type="button" data-store="' + esc(store.id) + '">' +
        '<span class="thumb"><img src="assets/stores/' + esc(store.id) + '.svg" alt=""></span>' +
        '<span><span class="row-name">' + esc(store.name) + '</span><span class="row-meta">Hunt this store</span></span>' +
        '<span class="badge badge-watch">Open</span></button>';
    }).join("") + "</div>";
  }

  function renderStore() {
    var store = findStore(state.storeId);
    if (!store) return stateCard("error", "Missing store", "That store is not on the list.");
    var items = S.sortByFitness(itemsForStore(store), function (item) { return item.fitness; });
    var body = items.length
      ? items.map(catalogRow).join("")
      : stateCard("empty", "Nothing tracked here", store.look);
    var golfHtml = store.id === "goodwill"
      ? '<p class="kicker">Golf look-for</p><div class="list">' + (golf.look || []).map(golfRow).join("") + '</div><p class="fine">' + esc(golf.note || NOT_TRACKED.golf) + "</p>"
      : "";
    return '<button class="back" type="button" data-back>Back</button><h1>' + esc(store.name) + "</h1>" +
      '<p class="digest">' + esc(store.look) + "</p>" +
      '<form data-store-search="' + esc(store.id) + '"><label class="search"><span>Search this store</span><input id="store-q" type="search" enterkeyhint="search" placeholder="Search this store" autocomplete="off"></label><button class="solid full" type="submit">Search ' + esc(store.name) + "</button></form>" +
      '<div class="list">' + body + "</div>" + golfHtml;
  }

  function renderCategory() {
    if (state.cat === "golf") {
      return '<button class="back" type="button" data-back>Back</button><h1>Golf</h1>' +
        stateCard("empty", "Photo needed", NOT_TRACKED.golf) +
        '<div class="list">' + (golf.look || []).map(golfRow).join("") + "</div>";
    }
    var items = S.sortByFitness(catalog[state.cat] || [], function (item) { return item.fitness; });
    return '<button class="back" type="button" data-back>Back</button><h1>' + esc(titleFor(state.cat)) + "</h1>" +
      (NOT_TRACKED[state.cat] ? '<p class="fine">' + esc(NOT_TRACKED[state.cat]) + "</p>" : "") +
      '<div class="list">' + items.map(catalogRow).join("") + "</div>";
  }

  function chips(values, current, attr, fast) {
    return '<div class="chips">' + values.map(function (value) {
      var on = current === value ? " is-on" : "";
      var hot = fast && fast[value] ? " is-fast" : "";
      return '<button class="chip' + on + hot + '" type="button" ' + attr + '="' + esc(value) + '">' + esc(value) + "</button>";
    }).join("") + "</div>";
  }

  function renderCatalogDetail() {
    var item = findCatalog(state.itemId);
    if (!item) return stateCard("error", "Missing item", "That product is not on the list.");
    var price = P.settledSale(item.id);
    var stock = stockMap()[item.id];
    var sizeKind = item.category === "sneakers" ? "shoe" : item.category === "streetwear" ? "clothes" : "";
    var sizes = sizeKind === "shoe" ? SHOE_SIZES : CLOTHES_SIZES;
    var owned = invForCatalog(item);
    var rows = historyRows(item.id, fallbackHistory(item));
    return '<button class="back" type="button" data-back>Back</button>' +
      photoBlock(item) +
      "<h1>" + esc(item.name) + "</h1>" +
      "<p>" + badge(item.fitness || "Watch", item.fitness || "Watch") + " " + (price ? esc(price.label) : badge("No settled sale", "No settled sale")) + "</p>" +
      (item.digest ? '<p class="digest">' + esc(item.digest) + "</p>" : "") +
      '<section class="tool"><p class="kicker">Price</p>' +
      "<p>Retail · " + esc(P.retailLabel(item)) + "</p>" +
      "<p>Tracked sold · " + esc(price ? price.label : "No settled sale") + "</p>" +
      "<p>Source · " + esc(price ? price.source + (price.sales ? ", " + price.sales + " sales" : "") : "No settled sale") + "</p>" +
      "<p>Date · " + esc(price ? price.date : "No settled sale") + "</p>" +
      "<p>Sentiment · " + esc(P.sentimentOf(item)) + "</p>" +
      (price && price.note ? "<p>" + esc(price.note) + "</p>" : "") +
      '<p id="net-out">Net · ' + esc(netText(item)) + "</p>" +
      priceMeter(item, price) +
      '<label class="field"><span>Shipping</span><input id="ship-in" type="number" inputmode="decimal" step="0.01" value="' + esc(String(shipping())) + '"></label>' +
      '<label class="field"><span>Shelf you saw</span><input id="shelf-in" type="number" inputmode="decimal" step="0.01" value="' + esc(retailNum(item) != null ? String(retailNum(item)) : "") + '"></label>' +
      '<p class="fine">A shelf you type is yours. It does not become a tracked sale.</p></section>' +
      '<section class="tool"><p class="kicker">Grade</p>' + chips(gradesFor(item.category), gradeOfCatalog(item), "data-grade") + "</section>" +
      (sizeKind ? '<section class="tool"><p class="kicker">Size</p><p class="fine">' + esc(item.sizing || "") + "</p>" + chips(sizes, sizeMap()[item.id] || "", "data-size", sizeKind === "shoe" ? FAST_SHOES : FAST_CLOTHES) + "</section>" : "") +
      '<section class="tool"><p class="kicker">Stock</p><label class="field"><span>Store</span><select id="stock-store">' + STORE_NAMES.map(function (name) {
        var selected = stock && stock.store === name ? " selected" : "";
        return "<option" + selected + ">" + esc(name) + "</option>";
      }).join("") + "</select></label>" + chips(STOCK_MARKS, stock && stock.mark, "data-stock") +
      '<p class="fine">' + (stock ? esc(stock.mark + " · " + (stock.store || "") + " · " + String(stock.time || "").slice(0, 16).replace("T", " ")) : "You mark what you see. No quantity is fetched.") + "</p></section>" +
      '<section class="tool"><p class="kicker">Last five checks</p>' + rows.map(function (row) {
        return "<p>" + esc(String(row.time || "").slice(0, 16).replace("T", " ")) + " · " + esc(row.source) + " · " + esc(row.retail) + " · " + esc(row.sold) + (row.enteredBy === "user" ? " · you entered this" : "") + "</p>";
      }).join("") + "</section>" +
      "<section><p class=\"kicker\">Check</p>" + checkLinks(item.name) + productLink(item.buyUrl, item.buyLabel || "Open product page") + '<p class="fine">Local Goodwill pegs are usually not online.</p></section>' +
      '<div class="actions"><button class="solid" type="button" data-mark="found">Found</button><button class="ghost" type="button" data-mark="left">Left it</button>' +
      (owned ? '<button class="ghost" type="button" data-inv="' + esc(owned.id) + '">In inventory</button>' : '<button class="solid" type="button" data-action="add-inv">Add to inventory</button>') +
      '<button class="ghost" type="button" data-action="copy-notes">Copy notes</button></div>';
  }

  function priceMeter(item, price) {
    if (!price) {
      return '<div class="state-card"><img src="assets/viz/no-history.svg" alt=""><strong>No settled sale</strong><p>Asking prices are not sales.</p></div>';
    }
    var retail = retailNum(item);
    var high = Number(price.high) || 1;
    var width = retail == null ? 8 : Math.max(4, Math.min(100, (retail / high) * 100));
    return '<div class="meter"><p>Retail ' + esc(P.retailLabel(item)) + '</p><div class="meter-track"><span class="meter-fill" style="width:' + width + '%"></span></div><p>Tracked ' + esc(price.label) + '</p><div class="meter-track"><span class="meter-fill" style="width:100%"></span></div><p class="fine">One stored snapshot. Not a live chart.</p></div>';
  }

  function renderDrops() {
    var rows = drops.slice().sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0; });
    var html = "";
    var last = "";
    rows.forEach(function (row) {
      var status = D.releaseState(row.iso);
      var label = row.dateLabel + " · " + status;
      if (label !== last) {
        html += '<p class="when">' + esc(label) + "</p>";
        last = label;
      }
      html += '<button class="item-row" type="button" data-drop="' + esc(row.id) + '">' +
        (row.photoMatched && row.photo ? thumb(row) : '<span class="thumb"><img src="assets/calendar/release.svg" alt=""></span>') +
        '<span><span class="row-name">' + esc(row.name) + "</span><span class=\"row-meta\">" + esc(row.category) + " · " + esc(row.format) + "</span><span class=\"row-meta\">" + esc(status) + " · " + esc(row.fitness || "") + "</span></span>" +
        badge(row.fitness || "Watch", row.fitness || "Watch") + "</button>";
    });
    return "<h1>Drops</h1>" + offlineBanner() + '<div class="timeline list">' + html + "</div>";
  }

  function renderDrop() {
    var item = findDrop(state.dropId);
    if (!item) return stateCard("error", "Missing drop", "That release is not on the calendar.");
    var status = D.releaseState(item.iso);
    var photo = item.photoMatched && item.photo ? photoBlock(item) : '<div class="photo-needed" role="img" aria-label="Photo needed"><img src="assets/calendar/release.svg" alt=""><strong>Photo needed</strong><p>' + esc(item.photoSource || item.photoNote || "No exact photo is bundled for this release.") + "</p></div>";
    return '<button class="back" type="button" data-back>Back</button>' + photo +
      "<h1>" + esc(item.name) + "</h1>" +
      "<p>" + esc(item.dateLabel) + " · " + esc(status) + "</p>" +
      "<p>Category · " + esc(item.category) + "</p><p>Format · " + esc(item.format) + "</p>" +
      "<p>Printed retail · " + esc(item.printed || "unknown") + "</p>" +
      "<p>Tracked sold · " + esc(item.sold || "No settled sale") + "</p>" +
      "<p>Sentiment · " + esc(item.sentiment || "unknown") + "</p>" +
      '<p class="digest">' + esc(item.digest || "") + "</p>" +
      badge(item.fitness || "Watch", item.fitness || "Watch") +
      "<section><p class=\"kicker\">Check</p>" + checkLinks(item.name) + productLink(item.buyUrl, item.buyLabel) + "</section>";
  }

  function renderInventory() {
    if (bootError) return stateCard("error", "Inventory needs a reset", bootError);
    var rows = S.sortInventory(Inv.visible(invState));
    var summary = Inv.portfolio(invState, seedFile);
    var list = rows.length
      ? rows.map(invRow).join("")
      : stateCard("empty", "No packages", "Import the book or add a purchase.");
    return "<h1>Inventory</h1>" +
      '<section class="stats" id="inventory-summary" aria-label="Inventory summary">' +
      stat(summary.packages + " packages", "In this book") +
      stat(summary.investedLabel, "Invested band") +
      stat(summary.targetLabel, "Target band") +
      stat(summary.verifiedSupers + " super · " + summary.toVerify + " to check", "Verified · still to verify") +
      "</section>" +
      '<div class="band-viz" aria-hidden="true"><span class="band-track"><span class="band-fill"></span></span><span class="band-track"><span class="band-fill band-fill-target"></span></span></div>' +
      '<div class="actions"><button class="solid" type="button" data-action="add-purchase">Add</button><button class="ghost" type="button" data-action="export-json">Export JSON</button><button class="ghost" type="button" data-action="export-csv">Export CSV</button><button class="ghost" type="button" data-action="import-json">Import JSON</button></div>' +
      '<div class="list" id="inventory-list">' + list + "</div>";
  }

  function renderInvDetail() {
    var item = findInv(state.invId);
    if (!item) return stateCard("error", "Missing package", "That package is not in inventory.");
    var mid = C.targetMid(item.resaleLow, item.resaleHigh);
    var estimate = mid == null
      ? "Unknown"
      : money(C.netProfit({ sold: mid, cost: item.cost, shipping: shipping(), tax: tax() })) + " from target midpoint " + money(mid) + ". Not a settled sale.";
    var tracked = item.catalogId ? P.settledSale(item.catalogId) : null;
    var history = (item.soldHistory || []).map(function (entry) {
      return "<p>Sold " + esc(String(entry.at || "").slice(0, 16).replace("T", " ")) + " · " + (entry.price == null ? "no price entered" : esc(money(entry.price))) + "</p>";
    }).join("");
    return '<button class="back" type="button" data-back>Back</button>' +
      photoBlock(item) +
      "<h1>" + esc(item.name) + "</h1>" +
      "<p>" + badge(invBadgeKind(item), invBadgeKind(item)) + "</p>" +
      '<section class="tool"><p>Cost · ' + money(item.cost) + "</p>" +
      "<p>Target · " + esc(item.resaleLabel || "none") + "</p>" +
      "<p>Midpoint · " + (mid == null ? "Unknown" : esc(money(mid))) + "</p>" +
      "<p>Estimated net · " + esc(estimate) + "</p>" +
      (tracked ? "<p>Tracked sold · " + esc(tracked.label) + " · " + esc(tracked.source) + " · " + esc(tracked.date) + ". Your target stays " + esc(item.resaleLabel || "the range you saved") + ".</p>" : "<p>Tracked sold · No settled sale</p>") +
      "<p>Notes · " + esc(item.notes || "None") + "</p>" +
      "<p>Status · " + esc(item.status || "On hand") + "</p>" +
      "<p>Grade · " + esc(item.grade || "Not set") + "</p>" +
      "<p>Photo · Photo needed</p></section>" +
      (history ? '<section class="tool"><p class="kicker">Sold history</p>' + history + "</section>" : "") +
      "<section><p class=\"kicker\">Check</p>" + checkLinks(item.name) + "</section>" +
      '<div class="actions"><button class="solid" type="button" data-action="keep">Keep</button><button class="solid" type="button" data-action="sold">Sold</button><button class="ghost" type="button" data-action="edit-inv">Edit</button><button class="danger" type="button" data-action="remove-inv">Remove</button></div>';
  }

  function invForm(item) {
    item = item || { category: "Cars", status: "On hand", tag: "mainline", store: "Walmart" };
    var cats = ["Cars", "Sports", "Sneakers", "Tech", "Streetwear", "Golf"];
    return '<button class="back" type="button" data-back>Back</button><h1>' + (item.id ? "Edit" : "Add purchase") + "</h1>" +
      '<form id="inv-form" class="tool">' +
      field("Name", "inv-name", "text", item.name || "") +
      field("Cost", "inv-cost", "number", item.cost != null ? item.cost : "") +
      field("Target low", "inv-low", "number", item.resaleLow != null ? item.resaleLow : "") +
      field("Target high", "inv-high", "number", item.resaleHigh != null ? item.resaleHigh : "") +
      '<label class="field"><span>Notes</span><textarea id="inv-notes">' + esc(item.notes || "") + "</textarea></label>" +
      '<label class="field"><span>Category</span><select id="inv-cat">' + cats.map(function (cat) {
        return "<option" + (item.category === cat ? " selected" : "") + ">" + cat + "</option>";
      }).join("") + "</select></label>" +
      '<label class="field"><span>Store</span><select id="inv-store">' + ["", "Walmart", "Target", "Goodwill", "Best Buy", "Dollar Tree", "Inventory"].map(function (name) {
        return "<option" + (item.store === name ? " selected" : "") + ">" + esc(name) + "</option>";
      }).join("") + "</select></label>" +
      '<label class="field"><span>Grade</span><select id="inv-grade"><option value="">Not set</option>' + gradesFor(categoryKey(item.category)).map(function (grade) {
        return "<option" + (item.grade === grade ? " selected" : "") + ">" + esc(grade) + "</option>";
      }).join("") + "</select></label>" +
      '<p class="fine" id="size-gate">Shoes need a US size. Clothes need a letter size. No size tag is a pass.</p>' +
      field("Size", "inv-size", "text", item.size || "") +
      '<button class="solid full" type="submit">' + (item.id ? "Save" : "Add to inventory") + "</button></form>";
  }

  function field(label, id, type, value) {
    var extra = type === "number" ? ' inputmode="decimal" step="0.01"' : "";
    return '<label class="field"><span>' + esc(label) + '</span><input id="' + id + '" type="' + type + '"' + extra + ' value="' + esc(value) + '"></label>';
  }

  function categoryKey(name) {
    var map = { Cars: "cars", Sports: "sports", Sneakers: "sneakers", Tech: "tech", Streetwear: "streetwear", Golf: "golf" };
    return map[name] || "cars";
  }

  function renderGolfDetail() {
    return '<button class="back" type="button" data-back>Back</button>' +
      photoBlock({ photoSource: golf.note || NOT_TRACKED.golf }) +
      "<h1>" + esc(state.itemId) + "</h1>" +
      '<p class="digest">' + esc(golf.note || NOT_TRACKED.golf) + "</p>" +
      "<p>Retail · Retail unknown</p><p>Tracked sold · No settled sale</p><p>Sentiment · unknown</p>" +
      badge("Pass", "Pass") +
      "<section><p class=\"kicker\">Check</p>" + checkLinks(state.itemId + " Goodwill") + "</section>";
  }

  function renderProfit() {
    var options = '<optgroup label="Catalog">' + allCatalog().map(function (item) {
      return '<option value="c:' + esc(item.id) + '">' + esc(item.name) + "</option>";
    }).join("") + '</optgroup><optgroup label="Inventory">' + Inv.visible(invState).map(function (item) {
      return '<option value="i:' + esc(item.id) + '">' + esc(item.name) + "</option>";
    }).join("") + "</optgroup>";
    return "<h1>Profit</h1>" +
      '<p class="fine">13% fees. Shipping and optional tax are yours. No sold number stays Unknown.</p>' +
      '<form id="profit-form" class="tool">' +
      '<label class="field"><span>Item</span><select id="profit-item">' + options + "</select></label>" +
      field("Shelf / cost", "profit-cost", "number", "") +
      '<p id="profit-tracked"></p><p id="profit-target"></p>' +
      field("Your sold", "profit-sold", "number", "") +
      field("Shipping", "profit-ship", "number", shipping()) +
      field("Tax, optional", "profit-tax", "number", tax()) +
      '<p class="kicker">Result</p><p id="profit-fees"></p><p id="profit-net"></p><p id="profit-roi"></p><p id="profit-even"></p>' +
      "</form>";
  }

  function screenHtml() {
    if (bootError && state.tab !== "inventory") {
      return stateCard("error", "Reseller hit a problem", bootError) + '<button class="solid" type="button" data-action="retry">Try again</button>';
    }
    if (state.view === "category") return renderCategory();
    if (state.view === "store") return renderStore();
    if (state.view === "catalog") return renderCatalogDetail();
    if (state.view === "drop") return renderDrop();
    if (state.view === "inv") return renderInvDetail();
    if (state.view === "inv-form") return invForm(state.invId ? findInv(state.invId) : null);
    if (state.view === "golf") return renderGolfDetail();
    if (state.tab === "stores") return renderStores();
    if (state.tab === "drops") return renderDrops();
    if (state.tab === "inventory") return renderInventory();
    if (state.tab === "profit") return renderProfit();
    return "<h1 class=\"kicker\">Hunt</h1>" + renderHunt();
  }

  function render() {
    screen.innerHTML = screenHtml();
    screen.setAttribute("aria-busy", state.refreshing ? "true" : "false");
    document.querySelectorAll(".tabbar [data-tab]").forEach(function (btn) {
      var on = btn.getAttribute("data-tab") === state.tab;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    var checked = localStorage.getItem("reseller-checked-at");
    document.getElementById("checked-line").textContent = "Last checked · " + (checked ? formatWhen(checked) : "Not checked yet");
    document.getElementById("status-live").textContent = state.note || "";
    if (state.tab === "profit" && state.view === "root") bindProfit();
    var hunt = document.getElementById("hunt-q");
    if (hunt && state.tab === "hunt" && state.view === "root") {
      var pos = state.query.length;
      if (document.activeElement && document.activeElement.id === "hunt-q") {
        hunt.focus();
        hunt.setSelectionRange(pos, pos);
      }
    }
    if (state.moveFocus) {
      var heading = screen.querySelector("h1");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus();
      }
      state.moveFocus = false;
    }
  }

  function formatWhen(iso) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch (err) {
      return String(iso).slice(0, 16).replace("T", " ");
    }
  }

  function push(partial) {
    state.stack.push({
      tab: state.tab,
      view: state.view,
      cat: state.cat,
      storeId: state.storeId,
      itemId: state.itemId,
      invId: state.invId,
      dropId: state.dropId,
      query: state.query,
      from: state.from,
    });
    Object.assign(state, partial);
    state.moveFocus = true;
    render();
  }

  function back() {
    var prev = state.stack.pop();
    if (!prev) {
      state.tab = "hunt";
      state.view = "root";
    } else {
      Object.assign(state, prev);
    }
    state.moveFocus = true;
    render();
  }

  function setTab(tab) {
    state.stack = [];
    state.tab = tab;
    state.view = "root";
    state.query = "";
    state.moveFocus = true;
    render();
  }

  function bindProfit() {
    var form = document.getElementById("profit-form");
    if (!form) return;
    var itemEl = document.getElementById("profit-item");
    var costEl = document.getElementById("profit-cost");
    var soldEl = document.getElementById("profit-sold");
    var shipEl = document.getElementById("profit-ship");
    var taxEl = document.getElementById("profit-tax");
    itemEl.value = state.profitId || itemEl.value;
    function selected() {
      var value = itemEl.value || "";
      if (value.indexOf("i:") === 0) return { kind: "inventory", item: findInv(value.slice(2)) };
      return { kind: "catalog", item: findCatalog(value.slice(2)) };
    }
    function fill() {
      var picked = selected();
      state.profitId = itemEl.value;
      if (!picked.item) return;
      if (picked.kind === "inventory") costEl.value = picked.item.cost != null ? String(picked.item.cost) : "";
      else costEl.value = retailNum(picked.item) != null ? String(retailNum(picked.item)) : "";
      soldEl.value = "";
      paint();
    }
    function paint() {
      var picked = selected();
      var item = picked.item;
      var cost = costEl.value === "" ? null : Number(costEl.value);
      var typed = soldEl.value === "" ? null : Number(soldEl.value);
      var ship = Number(shipEl.value) || 0;
      var taxVal = Number(taxEl.value) || 0;
      localStorage.setItem("reseller-ship", String(ship));
      localStorage.setItem("reseller-tax", String(taxVal));
      var tracked = null;
      var targetLine = "Target · none";
      if (item && picked.kind === "catalog") tracked = P.settledSale(item.id);
      if (item && picked.kind === "inventory") {
        targetLine = "Target · " + (item.resaleLabel || "none") + " · not a settled sale";
        if (item.catalogId) tracked = P.settledSale(item.catalogId);
      }
      document.getElementById("profit-target").textContent = targetLine;
      document.getElementById("profit-tracked").textContent = tracked
        ? "Tracked sold · " + tracked.label + " · " + tracked.source + " · " + tracked.date
        : "Tracked sold · No settled sale";
      var low = null;
      var high = null;
      var source = "Unknown";
      if (typed != null && Number.isFinite(typed)) {
        low = high = typed;
        source = "You entered this";
      } else if (tracked) {
        low = tracked.low;
        high = tracked.high;
        source = "Tracked snapshot";
      }
      var feeEl = document.getElementById("profit-fees");
      var netEl = document.getElementById("profit-net");
      var roiEl = document.getElementById("profit-roi");
      var evenEl = document.getElementById("profit-even");
      var even = C.breakEven({ cost: cost || 0, shipping: ship, tax: taxVal });
      evenEl.textContent = "Break-even · " + money(even);
      if (low == null || !Number.isFinite(low)) {
        feeEl.textContent = "Fees · Unknown";
        netEl.textContent = "Net profit · Unknown";
        roiEl.textContent = "ROI · Unknown";
        return;
      }
      var feeLow = C.feeAmount(Math.min(low, high), 0.13);
      var feeHigh = C.feeAmount(Math.max(low, high), 0.13);
      var netLow = C.netProfit({ sold: Math.min(low, high), cost: cost || 0, shipping: ship, tax: taxVal });
      var netHigh = C.netProfit({ sold: Math.max(low, high), cost: cost || 0, shipping: ship, tax: taxVal });
      var roiLow = C.roi(netLow, cost);
      var roiHigh = C.roi(netHigh, cost);
      feeEl.textContent = "Fees · " + spanMoney(feeLow, feeHigh) + " · " + source;
      netEl.textContent = "Net profit · " + spanMoney(netLow, netHigh);
      roiEl.textContent = "ROI · " + (roiLow == null ? "Unknown" : spanPct(roiLow, roiHigh));
    }
    itemEl.addEventListener("change", fill);
    [costEl, soldEl, shipEl, taxEl].forEach(function (el) { el.addEventListener("input", paint); });
    fill();
  }

  function spanMoney(low, high) {
    if (Math.abs(low - high) < 0.009) return money(low);
    return money(low) + "–" + money(high);
  }

  function spanPct(low, high) {
    function pct(n) {
      var p = n * 100;
      if (Math.abs(p) >= 100) return Math.round(p).toLocaleString("en-US") + "%";
      return p.toFixed(1) + "%";
    }
    if (Math.abs(low - high) < 0.0001) return pct(low);
    return pct(Math.min(low, high)) + "–" + pct(Math.max(low, high));
  }

  function saveInvForm(existing) {
    var name = document.getElementById("inv-name").value.trim();
    if (!name) return;
    var category = document.getElementById("inv-cat").value;
    var size = document.getElementById("inv-size").value.trim();
    if ((category === "Sneakers" || category === "Streetwear") && !size) {
      document.getElementById("size-gate").textContent = "Add a size before you save shoes or clothes.";
      return;
    }
    var low = document.getElementById("inv-low").value;
    var high = document.getElementById("inv-high").value;
    var row = {
      id: existing && existing.id,
      name: name,
      cost: Number(document.getElementById("inv-cost").value) || 0,
      resaleLow: low === "" ? null : Number(low),
      resaleHigh: high === "" ? null : Number(high),
      resaleLabel: low !== "" && high !== "" ? low + "–" + high : "",
      notes: document.getElementById("inv-notes").value.trim(),
      category: category,
      store: document.getElementById("inv-store").value,
      grade: document.getElementById("inv-grade").value,
      size: size,
      tag: existing ? existing.tag : "mainline",
      status: existing ? existing.status : "On hand",
      date: existing ? existing.date : new Date().toISOString().slice(0, 10),
      catalogId: existing ? existing.catalogId : null,
    };
    Inv.upsertUser(invState, row);
    Inv.write(localStorage, invState);
    state.tab = "inventory";
    state.view = "root";
    state.stack = [];
    state.moveFocus = true;
    render();
  }

  function addCatalog(item) {
    var owned = invForCatalog(item);
    if (owned) {
      push({ tab: "inventory", view: "inv", invId: owned.id });
      return;
    }
    var row = Inv.upsertUser(invState, {
      name: item.name,
      notes: item.digest || "",
      cost: retailNum(item) || 0,
      resaleLow: null,
      resaleHigh: null,
      resaleLabel: "",
      tag: "mainline",
      store: "",
      date: new Date().toISOString().slice(0, 10),
      status: "On hand",
      category: titleFor(item.category),
      grade: gradeOfCatalog(item),
      catalogId: item.id,
    });
    Inv.write(localStorage, invState);
    push({ tab: "inventory", view: "inv", invId: row.id });
  }

  async function refreshAll() {
    state.refreshing = true;
    state.note = "Checking sources…";
    render();
    var results = [];
    for (var i = 0; i < R.PROVIDERS.length; i++) {
      var plan = R.refreshPlan(R.PROVIDERS[i]);
      if (plan.status === "attempt") {
        results.push(await attemptDollarTree());
      } else {
        results.push(plan);
      }
    }
    results.forEach(function (result) {
      R.applyRefreshResult(null, result);
    });
    var when = new Date().toISOString();
    localStorage.setItem("reseller-checked-at", when);
    writeJson("reseller-provider-log", { at: when, results: results });
    if (state.itemId && state.view === "catalog") {
      var item = findCatalog(state.itemId);
      if (item) {
        var price = P.settledSale(item.id);
        pushHistory(item.id, {
          time: when,
          source: "Refresh",
          retail: P.retailLabel(item),
          sold: price ? price.label : "No settled sale",
          enteredBy: "refresh",
        });
      }
    }
    state.refreshing = false;
    state.note = "Trusted snapshots kept. Store sites are blocked from this browser.";
    render();
  }

  function attemptDollarTree() {
    var url = R.CHECK.dollartreeJson + encodeURIComponent("hot wheels");
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 2500) : null;
    return fetch(url, { mode: "cors", credentials: "omit", signal: controller ? controller.signal : undefined }).then(function (res) {
      if (!res.ok) {
        return { id: "dollar-tree", status: "blocked", updatesPrice: false, message: "Dollar Tree refused the fetch. No price was saved." };
      }
      return { id: "dollar-tree", status: "blocked", updatesPrice: false, message: "Dollar Tree answered, and this app still did not save a settled sale." };
    }).catch(function () {
      return { id: "dollar-tree", status: "blocked", updatesPrice: false, message: "Dollar Tree blocked the fetch from this site. No price was invented." };
    }).then(function (result) {
      if (timer) clearTimeout(timer);
      return result;
    });
  }

  function openSheet(html) {
    sheet.innerHTML = '<div class="sheet-body">' + html + "</div>";
    if (!sheet.open) sheet.showModal();
  }

  function closeSheet() {
    stopCamera();
    if (sheet.open) sheet.close();
    sheet.innerHTML = "";
  }

  function stopCamera() {
    if (scanTimer) clearInterval(scanTimer);
    scanTimer = null;
    if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    stream = null;
  }

  function sourcesHtml() {
    var log = readJson("reseller-provider-log", null);
    var body = R.PROVIDERS.map(function (provider) {
      var logged = log && (log.results || []).filter(function (row) { return row.id === provider.id; })[0];
      var status = (logged && logged.status) || provider.status;
      return '<section class="tool"><p class="kicker">' + esc(provider.name) + "</p><p>" + esc(status) + (provider.userEntered ? " · user-entered" : "") + "</p><p>Last success · " + esc(provider.lastSuccess || "none") + "</p><p>" + esc((logged && logged.message) || provider.detail) + "</p></section>";
    }).join("");
    return "<h2>Data sources</h2><p>This is a static page. It cannot scrape a store or a sold marketplace.</p>" + body +
      (bootError ? stateCard("blocked", "Blocked", bootError) : "") +
      '<button class="solid full" type="button" data-action="close-sheet">Close</button>';
  }

  function download(filename, text, type) {
    var blob = new Blob([text], { type: type });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function copyNotes(item) {
    var price = P.settledSale(item.id);
    var text = [item.name, item.digest || "", "Retail: " + P.retailLabel(item), "Sold: " + (price ? price.label : "No settled sale"), "Source: " + (price ? price.source : "No settled sale")].filter(Boolean).join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
  }

  document.addEventListener("click", function (event) {
    var tab = event.target.closest("[data-tab]");
    if (tab) { setTab(tab.getAttribute("data-tab")); return; }
    var backBtn = event.target.closest("[data-back]");
    if (backBtn) { back(); return; }
    var storeBtn = event.target.closest("[data-store]");
    if (storeBtn) {
      push({ view: "store", storeId: storeBtn.getAttribute("data-store"), from: state.tab });
      return;
    }
    var catBtn = event.target.closest("[data-cat]");
    if (catBtn) { push({ view: "category", cat: catBtn.getAttribute("data-cat") }); return; }
    var itemBtn = event.target.closest("[data-item]");
    if (itemBtn) {
      state.profitId = "c:" + itemBtn.getAttribute("data-item");
      push({ view: "catalog", itemId: itemBtn.getAttribute("data-item") });
      return;
    }
    var invBtn = event.target.closest("[data-inv]");
    if (invBtn) {
      state.profitId = "i:" + invBtn.getAttribute("data-inv");
      push({ tab: state.tab === "hunt" ? "inventory" : state.tab, view: "inv", invId: invBtn.getAttribute("data-inv") });
      return;
    }
    var dropBtn = event.target.closest("[data-drop]");
    if (dropBtn) { push({ view: "drop", dropId: dropBtn.getAttribute("data-drop") }); return; }
    var golfBtn = event.target.closest("[data-golf]");
    if (golfBtn) { push({ view: "golf", itemId: golfBtn.getAttribute("data-golf") }); return; }
    var gradeBtn = event.target.closest("[data-grade]");
    if (gradeBtn && state.itemId) {
      var grades = gradeMap();
      grades[state.itemId] = gradeBtn.getAttribute("data-grade");
      writeJson("reseller-grade", grades);
      render();
      return;
    }
    var stockBtn = event.target.closest("[data-stock]");
    if (stockBtn && state.itemId) {
      var stocks = stockMap();
      var storeEl = document.getElementById("stock-store");
      stocks[state.itemId] = { mark: stockBtn.getAttribute("data-stock"), store: storeEl ? storeEl.value : "", time: new Date().toISOString() };
      writeJson("reseller-stock", stocks);
      render();
      return;
    }
    var sizeBtn = event.target.closest("[data-size]");
    if (sizeBtn && state.itemId) {
      var sizes = sizeMap();
      sizes[state.itemId] = sizeBtn.getAttribute("data-size");
      writeJson("reseller-sizes", sizes);
      render();
      return;
    }
    var markBtn = event.target.closest("[data-mark]");
    if (markBtn && state.itemId) {
      var marks = marksMap();
      var kind = markBtn.getAttribute("data-mark");
      marks[state.itemId] = kind;
      writeJson("reseller-marks", marks);
      if (kind === "found") {
        var visit = readJson("reseller-visit", []);
        if (visit.indexOf(state.itemId) === -1) visit.push(state.itemId);
        writeJson("reseller-visit", visit);
      }
      state.note = kind === "found" ? "Marked found for this visit." : "Marked left it.";
      render();
      return;
    }
    var actionBtn = event.target.closest("[data-action]");
    if (!actionBtn) return;
    var actionName = actionBtn.getAttribute("data-action");
    if (actionName === "refresh") { refreshAll(); return; }
    if (actionName === "sources") { openSheet(sourcesHtml()); return; }
    if (actionName === "close-sheet") { closeSheet(); return; }
    if (actionName === "retry") { boot(); return; }
    if (actionName === "scan") { openScan(); return; }
    if (actionName === "check-price") { openCheck(); return; }
    if (actionName === "add-purchase") {
      state.invId = "";
      push({ tab: "inventory", view: "inv-form", invId: "" });
      return;
    }
    if (actionName === "review-inventory") { setTab("inventory"); return; }
    if (actionName === "visit-done") { writeJson("reseller-visit", []); render(); return; }
    if (actionName === "add-inv") { var current = findCatalog(state.itemId); if (current) addCatalog(current); return; }
    if (actionName === "copy-notes") { var noted = findCatalog(state.itemId); if (noted) copyNotes(noted); state.note = "Notes copied."; render(); return; }
    if (actionName === "edit-inv") { push({ view: "inv-form", invId: state.invId }); return; }
    if (actionName === "keep") {
      var kept = findInv(state.invId);
      if (kept) {
        kept.status = kept.tag === "sth" ? "STH" : kept.tag === "verify-sth" ? "Verify STH" : "On hand";
        Inv.write(localStorage, invState);
        render();
      }
      return;
    }
    if (actionName === "sold") { openSold(); return; }
    if (actionName === "confirm-sold") {
      var soldItem = findInv(state.invId);
      var priceRaw = document.getElementById("sold-price");
      var price = priceRaw && priceRaw.value !== "" ? Number(priceRaw.value) : null;
      if (soldItem) {
        soldItem.status = "Sold";
        soldItem.soldHistory = soldItem.soldHistory || [];
        soldItem.soldHistory.unshift({ at: new Date().toISOString(), price: Number.isFinite(price) ? price : null });
        Inv.write(localStorage, invState);
      }
      closeSheet();
      render();
      return;
    }
    if (actionName === "remove-inv") {
      openSheet("<h2>Remove this package?</h2><p>It leaves the list. The 78-package import will not put it back. Sold history on this row goes with it.</p><button class=\"danger full\" type=\"button\" data-action=\"confirm-remove\">Remove</button>");
      return;
    }
    if (actionName === "confirm-remove") {
      Inv.markRemoved(invState, state.invId);
      Inv.write(localStorage, invState);
      closeSheet();
      state.view = "root";
      state.tab = "inventory";
      state.stack = [];
      render();
      return;
    }
    if (actionName === "export-json") {
      download("reseller-inventory.json", JSON.stringify({ items: Inv.visible(invState) }, null, 2), "application/json");
      return;
    }
    if (actionName === "export-csv") {
      download("reseller-inventory.csv", Inv.toCsv(Inv.visible(invState)), "text/csv");
      return;
    }
    if (actionName === "import-json") {
      openSheet('<h2>Import JSON</h2><p>Rows merge by id. Photos that are not exact local matches stay Photo needed.</p><label class="field"><span>File</span><input id="import-file" type="file" accept="application/json,.json"></label><button class="solid full" type="button" data-action="run-import">Import</button><p id="import-error" class="fine"></p>');
      return;
    }
    if (actionName === "run-import") {
      var fileEl = document.getElementById("import-file");
      var file = fileEl && fileEl.files && fileEl.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var result = Inv.importJson(invState, JSON.parse(String(reader.result)));
          if (!result.ok) {
            document.getElementById("import-error").textContent = result.error;
            return;
          }
          Inv.write(localStorage, invState);
          closeSheet();
          render();
        } catch (err) {
          var node = document.getElementById("import-error");
          if (node) node.textContent = "That file is not JSON this app can read. Your list was not changed.";
        }
      };
      reader.readAsText(file);
      return;
    }
    if (actionName === "run-scan-text") {
      var typed = document.getElementById("scan-q");
      state.query = typed ? typed.value : "";
      closeSheet();
      state.tab = "hunt";
      state.view = "root";
      render();
    }
  });

  document.addEventListener("input", function (event) {
    if (event.target.id === "hunt-q") {
      state.query = event.target.value;
      var box = document.getElementById("hunt-body");
      if (box) box.innerHTML = huntBody();
      return;
    }
    if (event.target.id === "ship-in" || event.target.id === "shelf-in") {
      if (event.target.id === "ship-in") localStorage.setItem("reseller-ship", String(Number(event.target.value) || 0));
      if (event.target.id === "shelf-in" && state.itemId) {
        var shelves = readJson("reseller-shelf", {});
        if (event.target.value === "") delete shelves[state.itemId];
        else shelves[state.itemId] = Number(event.target.value);
        writeJson("reseller-shelf", shelves);
      }
      var item = findCatalog(state.itemId);
      var out = document.getElementById("net-out");
      if (item && out) out.textContent = "Net · " + netText(item);
    }
  });

  document.addEventListener("change", function (event) {
    if (event.target.id !== "inv-cat") return;
    var sel = document.getElementById("inv-grade");
    if (!sel) return;
    var current = sel.value;
    var grades = gradesFor(categoryKey(event.target.value));
    sel.innerHTML = '<option value="">Not set</option>' + grades.map(function (grade) {
      return "<option" + (grade === current ? " selected" : "") + ">" + esc(grade) + "</option>";
    }).join("");
  });

  document.addEventListener("submit", function (event) {
    var form = event.target.closest("[data-store-search]");
    if (form) {
      event.preventDefault();
      var store = findStore(form.getAttribute("data-store-search"));
      var q = document.getElementById("store-q");
      if (store) window.open(R.checkHref(store.search, q ? q.value : ""), "_blank", "noopener,noreferrer");
      return;
    }
    if (event.target.id === "inv-form") {
      event.preventDefault();
      saveInvForm(state.invId ? findInv(state.invId) : null);
    }
    if (event.target.id === "profit-form") event.preventDefault();
  });

  sheet.addEventListener("click", function (event) {
    if (event.target === sheet) closeSheet();
  });
  sheet.addEventListener("close", stopCamera);

  function openScan() {
    openSheet('<h2>Scan item</h2><p>The camera can read a code on the package. It does not check a store\'s inventory.</p><video id="scan-video" playsinline muted></video><p id="scan-msg" class="fine"></p><label class="field"><span>Or type the name</span><input id="scan-q" type="text" autocomplete="off"></label><button class="solid full" type="button" data-action="run-scan-text">Search the list</button>');
    var msg = document.getElementById("scan-msg");
    if (!navigator.mediaDevices || !window.BarcodeDetector) {
      msg.textContent = "This browser has no barcode detector here. Type the name instead.";
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (media) {
      stream = media;
      var video = document.getElementById("scan-video");
      video.srcObject = media;
      return video.play().then(function () {
        var detector = new BarcodeDetector({ formats: ["ean_13", "upc_a", "upc_e", "code_128", "qr_code"] });
        scanTimer = setInterval(function () {
          detector.detect(video).then(function (codes) {
            if (!codes[0]) return;
            state.query = codes[0].rawValue;
            closeSheet();
            state.tab = "hunt";
            state.view = "root";
            render();
          }).catch(function () {});
        }, 500);
      });
    }).catch(function () {
      msg.textContent = "Camera permission was blocked. Type the name instead.";
    });
  }

  function openCheck() {
    openSheet('<h2>Check price</h2><label class="field"><span>Name</span><input id="check-q" type="search" autocomplete="off"></label><div id="check-hits"></div><button class="solid full" type="button" data-action="close-sheet">Close</button>');
    var input = document.getElementById("check-q");
    var hits = document.getElementById("check-hits");
    function paint() {
      var found = S.searchRecords(allCatalog(), input.value).slice(0, 8);
      hits.innerHTML = found.map(function (item) {
        var price = P.settledSale(item.id);
        return "<p><strong>" + esc(item.name) + "</strong><br>Retail " + esc(P.retailLabel(item)) + " · " + esc(price ? price.label + " · " + price.source + " · " + price.date : "No settled sale") + "</p>";
      }).join("") || "<p>No settled sale for that name unless it is one of the trusted snapshots.</p>";
    }
    input.addEventListener("input", paint);
    paint();
  }

  function openSold() {
    openSheet('<h2>Mark sold</h2><p>Leave the price blank if you do not want to store one. Blank is not a guess.</p><label class="field"><span>Sold price, optional</span><input id="sold-price" type="number" inputmode="decimal" step="0.01"></label><button class="solid full" type="button" data-action="confirm-sold">Save sold</button>');
  }

  function boot() {
    bootError = "";
    screen.innerHTML = stateCard("loading", "Loading", "Opening your hunt.");
    Promise.all([
      fetch("data/catalog.json").then(function (res) { if (!res.ok) throw new Error("catalog"); return res.json(); }),
      fetch("data/drops.json").then(function (res) { if (!res.ok) throw new Error("drops"); return res.json(); }),
      fetch("data/inventory-seed.json").then(function (res) { if (!res.ok) throw new Error("inventory"); return res.json(); }),
      fetch("data/stores.json").then(function (res) { if (!res.ok) throw new Error("stores"); return res.json(); }),
      fetch("data/golf.json").then(function (res) { if (!res.ok) throw new Error("golf"); return res.json(); }),
    ]).then(function (parts) {
      catalog = parts[0];
      drops = parts[1];
      seedFile = parts[2];
      stores = parts[3];
      golf = parts[4];
      var loaded = Inv.load(localStorage, seedFile);
      if (!loaded.ok) {
        bootError = "Saved inventory could not be read. It was not replaced. Export is unavailable until you reset from a backup, or clear site data.";
        invState = { version: 2, items: [], tombstones: [], migratedBought: true };
        render();
        return;
      }
      invState = loaded.state;
      render();
    }).catch(function () {
      bootError = "The app files did not load.";
      if (!navigator.onLine) bootError = "Offline, and this phone does not have the app shell cached yet.";
      screen.innerHTML = stateCard(navigator.onLine ? "error" : "offline", navigator.onLine ? "Could not open" : "Offline", bootError);
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  boot();
})();
