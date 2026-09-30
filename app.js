(function () {
  var C = window.ResellerCash;
  var D = window.ResellerDates;
  var P = window.ResellerPrices;
  var S = window.ResellerSearch;
  var R = window.ResellerProviders;
  var Inv = window.ResellerInventory;
  var Rules = window.ResellerRules;

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
    lane: "",
    storeId: "",
    itemId: "",
    invId: "",
    dropId: "",
    query: "",
    invQuery: "",
    invFilter: "all",
    from: "hunt",
    refreshing: false,
    note: "",
    stack: [],
    moveFocus: false,
    profitId: "c:cuda",
  };

  var screen = document.getElementById("screen");
  var sheet = document.getElementById("sheet");
  var zoom = document.getElementById("zoom");

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

  function gradeOfCatalog(item) {
    return gradeMap()[item.id] || "";
  }

  function retailNum(item) {
    var typed = readJson("reseller-shelf", {})[item.id];
    if (typed != null && typed !== "" && Number.isFinite(Number(typed))) return Number(typed);
    if (item.id === "topps-s1") return 24.99;
    if (item.category === "cars" && Number(item.shelfNum) === 1) return 1;
    if (item.shelfNum != null && /\$\d|about \$/i.test(item.shelf || "")) return Number(item.shelfNum);
    return null;
  }

  function shelfLabel(item) {
    if (!item) return "";
    if (item.id === "m6a") return "Near ¥7200";
    if (item.id === "etb") return "Printed $49.99";
    return P.retailLabel(item);
  }

  function golfItems() {
    return (golf.look || []).map(function (name) {
      return { id: "golf:" + name, name: name, kind: "golf", category: "golf" };
    });
  }

  function laneItems(lane) {
    if (lane === "golf") return golfItems();
    return Rules.byLane(allCatalog(), lane);
  }

  function storeLanes(store) {
    if (!store) return [];
    if (store.lanes && store.lanes.length) return store.lanes.slice();
    return Rules.storeLanes(store.id);
  }

  function photoFor(item) {
    if (!item) return null;
    if (item.photoMatched && item.photo) return { src: item.photo, alt: item.photoAlt || item.name || "" };
    if (item.catalogId) {
      var cat = findCatalog(item.catalogId);
      if (cat && cat.photoMatched && cat.photo) return { src: cat.photo, alt: cat.photoAlt || item.name || "" };
    }
    return null;
  }

  function pegPhoto(item, large) {
    var shot = photoFor(item);
    if (shot) return '<span class="peg-photo' + (large ? " is-hero" : "") + '"><img src="' + esc(shot.src) + '" alt=""></span>';
    if (!large) return "";
    return '<span class="peg-photo is-empty is-hero"><em>Photo needed</em></span>';
  }

  function decisionBar(verdict) {
    var buy = verdict === "Buy";
    return '<span class="decision decision-' + (buy ? "buy" : "pass") + '"><strong>' + (buy ? "Buy" : "Pass") + "</strong><span>" + (buy ? "If the card matches" : "Leave it") + "</span></span>";
  }

  function restockNote() {
    return '<p class="fine">Restocks, confirm with the store: Walmart often Monday, Tuesday, or midweek. Target often Sunday night or Monday. Dollar Tree follows freight. Kroger is a vendor stop, not a store tab. A case code is freight, not a national day.</p>';
  }

  function pegMoney(item) {
    var pay = Rules.payFor(item) || shelfLabel(item) || "Shelf price on the tag";
    var line = Rules.priceLine(item);
    if (line === "No sold data") return esc(pay) + " · No sold data";
    return esc(pay) + " · " + esc(line);
  }

  function priceDetail(item, comp) {
    if (comp) return "Sourced comp · " + comp.label + " · " + comp.source;
    var money = Rules.moneyOf(item);
    if (!money) return "No sold data";
    return "Last sold " + money.sold + " · Net " + money.net;
  }

  function priceNote(item, comp) {
    if (comp) return '<a class="text-link" href="' + esc(comp.url) + '" target="_blank" rel="noopener noreferrer">Open source</a>';
    var money = Rules.moneyOf(item);
    if (money) return '<p class="fine">' + esc(money.note) + " Re-check solds before listing. Net is sold × 0.87 − $5.</p>";
    return '<p class="fine">No source URL and no sheet sold. Do not invent a sold.</p>';
  }

  function pegCard(item, opts) {
    opts = opts || {};
    var verdict = Rules.verdictFor(item);
    var idAttr = item.kind === "golf" ? ' data-golf="' + esc(item.name) + '"' : ' data-item="' + esc(item.id) + '"';
    var links = opts.links || "";
    var photo = pegPhoto(item, true);
    return '<article class="peg"><button class="peg-open is-stack" type="button"' + idAttr + ">" +
      photo +
      '<span class="peg-copy"><span class="peg-name">' + esc(item.name) + "</span></span>" +
      decisionBar(verdict) +
      '<span class="peg-foot"><span class="peg-tell">' + esc(Rules.tellsFor(item)) + "</span>" +
      '<span class="peg-meta">' + pegMoney(item) + "</span></span></button>" +
      links + "</article>";
  }

  function storeLinks(name, store) {
    var links = [];
    if (store) links.push(["Search on " + store.name, R.checkHref(store.search, name)]);
    links.push(["Google", R.checkHref(R.CHECK.google, name)]);
    links.push(["Google Shopping", R.checkHref(R.CHECK.shopping, name)]);
    return '<div class="link-row">' + links.map(function (link) {
      return '<a href="' + esc(link[1]) + '" target="_blank" rel="noopener noreferrer">' + esc(link[0]) + "</a>";
    }).join("") + "</div>";
  }

  function retailerLabel(store) {
    return { walmart: "Walmart.com", target: "Target.com", goodwill: "Goodwill.com", bestbuy: "BestBuy.com", dollartree: "DollarTree.com" }[store && store.id] || "";
  }

  function allCheckLinks(query, store) {
    var links = [
      ["Walmart.com", R.CHECK.walmart],
      ["Target.com", R.CHECK.target],
      ["Goodwill.com", R.CHECK.goodwill],
      ["BestBuy.com", R.CHECK.bestbuy],
      ["DollarTree.com", R.CHECK.dollartree],
      ["Google", R.CHECK.google],
      ["Google Shopping", R.CHECK.shopping],
    ];
    if (store) {
      var host = retailerLabel(store);
      links = links.filter(function (link) { return link[0] !== host; });
      links.unshift(["Search on " + store.name, store.search]);
    }
    return '<div class="link-row">' + links.map(function (link) {
      return '<a href="' + esc(R.checkHref(link[1], query)) + '" target="_blank" rel="noopener noreferrer">' + esc(link[0]) + "</a>";
    }).join("") + "</div>";
  }

  function sellBucket(item) {
    if (item.tag === "sth" || item.tag === "priority") return "sell";
    if (item.tag === "verify-sth") return "verify";
    if (item.tag === "duplicate") return "duplicate";
    return "hand";
  }

  function sellHint(item) {
    if (item.tag === "sth") return "Sell this first. Confirmed Super in this book.";
    if (item.tag === "priority") return "Sell ahead of the mainlines.";
    if (item.tag === "verify-sth") return "Verify the card before you price it as a Super.";
    if (item.tag === "duplicate") return "Duplicate. Do not count it twice.";
    return "";
  }

  function bookTarget(item) {
    if (item.resaleLow == null || item.resaleHigh == null) return "No book target";
    var low = Number(item.resaleLow);
    var high = Number(item.resaleHigh);
    if (!Number.isFinite(low) || !Number.isFinite(high)) return "No book target";
    return "Book target $" + String(low).replace(/\.0$/, "") + "–$" + String(high).replace(/\.0$/, "");
  }

  function invBadge(item) {
    if (item.status === "Sold") return '<span class="status">Sold</span>';
    if (item.tag === "sth") return '<span class="status status-sth">Status · STH</span>';
    if (item.tag === "verify-sth") return '<span class="status status-verify">Status · Verify</span>';
    if (item.tag === "priority") return '<span class="status">Sell ahead</span>';
    if (item.tag === "duplicate") return '<span class="status">Duplicate</span>';
    return '<span class="status">On hand</span>';
  }

  function flagLabel(item) {
    if (item.tag === "sth") return "STH";
    if (item.tag === "verify-sth") return "Verify STH";
    if (item.status === "Sold") return "Sold";
    return "";
  }

  function invRow(item) {
    var hint = sellHint(item);
    var flag = flagLabel(item);
    var photo = pegPhoto(item, false);
    var shot = photoFor(item);
    return '<article class="peg"><button class="peg-open' + (photo ? "" : " no-photo") + '" type="button" data-inv="' + esc(item.id) + '">' +
      photo +
      '<span class="peg-copy"><span class="peg-top"><span class="peg-name">' + esc(item.name) + "</span>" + invBadge(item) + "</span>" +
      '<span class="peg-tell">' + esc(item.notes || "No notes") + "</span>" +
      '<span class="peg-meta">' + esc(bookTarget(item)) + (flag ? " · " + esc(flag) : "") + (hint ? " · " + esc(hint) : "") + (shot ? "" : " · Photo needed") + "</span></span></button></article>";
  }

  function offlineBanner() {
    if (navigator.onLine) return "";
    return '<div class="banner"><img src="assets/states/offline.svg" alt=""><span>Offline. The buy list and your inventory are still on this phone.</span></div>';
  }

  function stateCard(kind, title, copy) {
    return '<div class="state-card"><img src="assets/states/scene-' + kind + '.svg" alt=""><strong>' + esc(title) + "</strong><p>" + esc(copy) + "</p></div>";
  }

  function searchPool() {
    var records = allCatalog().map(function (item) {
      return {
        kind: "catalog",
        name: item.name,
        notes: (item.digest || "") + " " + Rules.tellsFor(item),
        category: Rules.laneFor(item),
        categoryTitle: (Rules.laneMeta(Rules.laneFor(item)) || {}).title || "",
        fitness: Rules.verdictFor(item),
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
    golfItems().forEach(function (item) {
      records.push({
        kind: "golf",
        name: item.name,
        notes: golf.note,
        category: "golf",
        categoryTitle: "Golf",
        store: "Goodwill",
        stores: "Goodwill",
        status: "No sold data",
        fitness: "Buy",
        ref: item,
      });
    });
    return records;
  }

  function storeButton(store) {
    return '<button class="store-pick" type="button" data-store="' + esc(store.id) + '"><span class="mono">' + esc(store.monogram || store.name.slice(0, 1)) + "</span><span><b>" + esc(store.name) + "</b><span>" + esc(store.short || store.look) + "</span></span><span class=\"chev\" aria-hidden=\"true\">›</span></button>";
  }

  function renderHunt() {
    var body = state.query.trim() ? huntResults() : '<div class="store-list">' + stores.map(storeButton).join("") + "</div>" +
      '<button class="ghost" type="button" data-action="scan">Scan a code</button>';
    return offlineBanner() +
      "<h1>Where are you?</h1>" +
      '<p class="digest">Pick the store, then the aisle. The list after that is short on purpose.</p>' +
      '<label class="search"><span>Search</span><input id="hunt-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Card name, notes, Subaru, Lotus" value="' + esc(state.query) + '"></label>' +
      '<div id="hunt-body">' + body + "</div>";
  }

  function huntResults() {
    var hits = S.searchRecords(searchPool(), state.query);
    if (!hits.length) return stateCard("no-results", "Leave it", "If it is not on the buy list, leave it.");
    return '<div class="list">' + hits.map(function (rec) {
      if (rec.kind === "inventory") return invRow(rec.ref);
      if (rec.kind === "golf") return pegCard(rec.ref);
      return pegCard(rec.ref);
    }).join("") + "</div>";
  }

  function renderLanes() {
    var store = findStore(state.storeId);
    if (!store) return stateCard("error", "Missing store", "That store is not on the list.");
    var lanes = storeLanes(store);
    return '<button class="back" type="button" data-back>Stores</button><h1>' + esc(store.name) + "</h1>" +
      '<p class="digest">' + esc(store.look) + "</p>" +
      '<p class="fine">This list stays in the app. Retailer search is a separate button and opens that store’s site.</p>' +
      '<div class="lane-list">' + lanes.map(function (id) {
        var meta = Rules.laneMeta(id);
        if (!meta) return "";
        var buys = laneItems(id).filter(function (item) { return Rules.verdictFor(item) === "Buy"; }).length;
        var count = buys ? buys + " on the buy list" : "Pass lane";
        return '<button class="lane-card" type="button" data-lane="' + esc(id) + '"><span class="mono">' + esc(meta.title.slice(0, 2).toUpperCase()) + '</span><span><b>' + esc(meta.title) + "</b><span>" + esc(meta.blurb) + " · " + esc(count) + "</span></span><span class=\"chev\" aria-hidden=\"true\">›</span></button>";
      }).join("") + "</div>";
  }

  function renderLane() {
    var meta = Rules.laneMeta(state.lane);
    var store = findStore(state.storeId);
    if (!meta) return stateCard("error", "Missing aisle", "That category is not on the hunt.");
    var items = laneItems(state.lane);
    var buys = items.filter(function (item) { return Rules.verdictFor(item) === "Buy"; });
    var passes = items.filter(function (item) { return Rules.verdictFor(item) !== "Buy"; });
    var buyHtml = buys.length
      ? buys.map(function (item) { return pegCard(item); }).join("")
      : '<p class="fine">Nothing in this aisle is a blind buy.</p>';
    var passHtml = passes.length
      ? '<details class="leave"' + (buys.length ? "" : " open") + '><summary>Leave these (' + passes.length + ")</summary><div class=\"list\">" + passes.map(function (item) { return pegCard(item); }).join("") + "</div></details>"
      : "";
    if (state.lane === "leave" || state.lane === "selective") {
      return '<button class="back" type="button" data-back>' + esc(store ? store.name : "Back") + "</button>" +
        '<p class="kicker">' + esc(meta.kicker) + "</p><h1>" + esc(meta.title) + "</h1>" +
        '<p class="digest">' + esc(meta.rule) + "</p>" +
        '<div class="list">' + items.map(function (item) { return pegCard(item); }).join("") + "</div>";
    }
    return '<button class="back" type="button" data-back>' + esc(store ? store.name : "Back") + "</button>" +
      '<p class="kicker">' + esc(meta.kicker) + "</p><h1>" + esc(meta.title) + "</h1>" +
      '<p class="digest">' + esc(meta.rule) + "</p>" +
      '<p class="kicker">Buy list</p><div class="list">' + buyHtml + "</div>" + passHtml;
  }

  function renderStores() {
    return "<h1>Stores</h1>" + offlineBanner() +
      '<p class="digest">Pick a store to open its buy list in this app.</p>' +
      restockNote() +
      '<p class="fine">That is not the retailer. Search on Walmart, Target, and the others is a button on the next screen. It leaves this app and opens their site. It does not filter this list, and it is not a shelf count.</p>' +
      '<div class="store-list">' + stores.map(storeButton).join("") + "</div>";
  }

  function renderStore() {
    var store = findStore(state.storeId);
    if (!store) return stateCard("error", "Missing store", "That store is not on the list.");
    var items = [];
    storeLanes(store).forEach(function (lane) {
      laneItems(lane).forEach(function (item) {
        if (Rules.verdictFor(item) === "Buy") items.push(item);
      });
    });
    var body = items.length
      ? items.map(function (item) { return pegCard(item, { links: storeLinks(item.name, store) }); }).join("")
      : stateCard("empty", "No buy list here", store.look);
    var golfNote = store.id === "goodwill" ? '<p class="fine">' + esc(golf.note || "") + "</p>" : "";
    return '<button class="back" type="button" data-back>Stores</button><h1>' + esc(store.name) + "</h1>" +
      '<p class="digest">' + esc(store.look) + "</p>" +
      '<p class="fine">The cards below are this app’s buy list. The button under the field leaves this app and searches ' + esc(store.name) + '’s own site. It does not filter these cards.</p>' +
      restockNote() +
      '<form data-store-search="' + esc(store.id) + '"><label class="search"><span>On ' + esc(store.name) + '.com</span><input id="store-q" type="search" enterkeyhint="search" placeholder="Name to look up on ' + esc(store.name) + '" autocomplete="off"></label><button class="solid full" type="submit">Search on ' + esc(store.name) + ".com</button></form>" +
      '<div class="list">' + body + "</div>" + golfNote;
  }

  function chips(values, current, attr, fast) {
    return '<div class="chips">' + values.map(function (value) {
      var on = current === value ? " is-on" : "";
      var hot = fast && fast[value] ? " is-fast" : "";
      return '<button class="chip' + on + hot + '" type="button" ' + attr + '="' + esc(value) + '">' + esc(value) + "</button>";
    }).join("") + "</div>";
  }

  function heroPhoto(item) {
    var shot = photoFor(item);
    if (shot) {
      return '<button class="hero-photo" type="button" data-zoom="' + esc(shot.src) + '" data-alt="' + esc(shot.alt) + '"><img src="' + esc(shot.src) + '" alt="' + esc(shot.alt) + '"><span class="zoom-hint">Full photo</span></button>';
    }
    return '<div class="photo-needed" role="img" aria-label="Photo needed"><img src="assets/states/photo-needed.svg" alt=""><strong>Photo needed</strong><p>' + esc((item && item.photoSource) || "No exact photo is bundled.") + "</p></div>";
  }

  function renderCatalogDetail() {
    var item = findCatalog(state.itemId);
    if (!item) return stateCard("error", "Missing item", "That product is not on the buy list.");
    var verdict = Rules.verdictFor(item);
    var comp = Rules.compOf(item);
    var stock = stockMap()[item.id];
    var sizeKind = item.category === "sneakers" ? "shoe" : item.category === "streetwear" ? "clothes" : "";
    var sizes = sizeKind === "shoe" ? SHOE_SIZES : CLOTHES_SIZES;
    var owned = invForCatalog(item);
    var store = findStore(state.storeId);
    return '<button class="back" type="button" data-back>Back</button>' +
      heroPhoto(item) +
      '<p class="kicker">' + esc((Rules.laneMeta(Rules.laneFor(item)) || {}).title || "") + "</p>" +
      "<h1>" + esc(item.name) + "</h1>" +
      '<section class="call call-' + (verdict === "Buy" ? "buy" : "pass") + '"><strong>' + esc(verdict) + "</strong><p>" + esc(Rules.tellsFor(item)) + "</p></section>" +
      '<section class="tool"><p class="kicker">Price</p>' +
      "<p>" + esc(Rules.payFor(item) || ("Shelf · " + shelfLabel(item))) + "</p>" +
      "<p>" + esc(priceDetail(item, comp)) + "</p>" +
      priceNote(item, comp) +
      "</section>" +
      '<section class="tool"><p class="kicker">Grade</p>' + chips(gradesFor(item.category), gradeOfCatalog(item), "data-grade") + "</section>" +
      (sizeKind ? '<section class="tool"><p class="kicker">Size</p><p class="fine">' + esc(item.sizing || "") + "</p>" + chips(sizes, sizeMap()[item.id] || "", "data-size", sizeKind === "shoe" ? FAST_SHOES : FAST_CLOTHES) + "</section>" : "") +
      '<section class="tool"><p class="kicker">What you saw</p><label class="field"><span>Store</span><select id="stock-store">' + STORE_NAMES.map(function (name) {
        var selected = (stock && stock.store === name) || (!stock && store && store.name === name) ? " selected" : "";
        return "<option" + selected + ">" + esc(name) + "</option>";
      }).join("") + "</select></label>" + chips(STOCK_MARKS, stock && stock.mark, "data-stock") +
      '<p class="fine">' + (stock ? esc(stock.mark + " · " + (stock.store || "") + " · " + String(stock.time || "").slice(0, 16).replace("T", " ")) : "You mark On shelf, Not here, or Sold out. No count is fetched.") + "</p></section>" +
      '<section class="tool"><p class="kicker">Check</p>' + allCheckLinks(item.name, store) +
      '<p class="fine">These open a search. This app cannot see a shelf.</p></section>' +
      '<div class="actions">' +
      (owned ? '<button class="ghost" type="button" data-inv="' + esc(owned.id) + '">In the book</button>' : '<button class="solid" type="button" data-action="add-inv">Add to inventory</button>') +
      '<button class="ghost" type="button" data-action="estimate">Estimate profit</button>' +
      '<button class="ghost" type="button" data-action="copy-notes">Copy notes</button></div>';
  }

  function invForCatalog(item) {
    return Inv.visible(invState).filter(function (row) { return row.catalogId === item.id; })[0] || null;
  }

  function renderDrops() {
    var featured = [];
    var rest = [];
    drops.forEach(function (row) {
      if (Rules.dropVerdict(row.id).verdict === "Buy") featured.push(row);
      else rest.push(row);
    });
    function block(row) {
      var rule = Rules.dropVerdict(row.id);
      var status = D.releaseState(row.iso);
      var photo = row.photoMatched && row.photo ? pegPhoto(row, true) : "";
      if (rule.verdict === "Buy") {
        return '<article class="peg"><button class="peg-open is-stack" type="button" data-drop="' + esc(row.id) + '">' +
          photo +
          '<span class="peg-copy"><span class="peg-name">' + esc(row.name) + "</span></span>" +
          decisionBar("Buy") +
          '<span class="peg-foot"><span class="peg-tell">' + esc(row.dateLabel) + " · " + esc(status) + "</span>" +
          '<span class="peg-meta">' + esc(rule.tells) + "</span></span></button></article>";
      }
      return '<article class="peg"><button class="peg-open no-photo" type="button" data-drop="' + esc(row.id) + '">' +
        '<span class="peg-copy"><span class="peg-name">' + esc(row.name) + "</span>" +
        '<span class="peg-tell">' + esc(row.dateLabel) + " · " + esc(status) + "</span>" +
        '<span class="peg-meta">' + esc(rule.tells) + "</span></span></button></article>";
    }
    return "<h1>Drops</h1>" + offlineBanner() +
      '<p class="digest">The dates that change a hunt. Other releases stay folded. Buy marks the dates that matter.</p>' +
      restockNote() +
      '<p class="kicker">On the buy list</p><div class="list">' + featured.map(block).join("") + "</div>" +
      '<details class="leave"><summary>Other dates</summary><div class="list">' + rest.map(block).join("") + "</div></details>";
  }

  function renderDrop() {
    var item = findDrop(state.dropId);
    if (!item) return stateCard("error", "Missing drop", "That release is not on the calendar.");
    var status = D.releaseState(item.iso);
    var rule = Rules.dropVerdict(item.id);
    var photo = item.photoMatched && item.photo
      ? heroPhoto(item)
      : '<div class="photo-needed" role="img" aria-label="Photo needed"><img src="assets/calendar/release.svg" alt=""><strong>Photo needed</strong><p>' + esc(item.photoSource || item.photoNote || "No exact photo is bundled for this release.") + "</p></div>";
    return '<button class="back" type="button" data-back>Drops</button>' + photo +
      "<h1>" + esc(item.name) + "</h1>" +
      '<section class="call call-' + (rule.verdict === "Buy" ? "buy" : "pass") + '"><strong>' + esc(rule.verdict) + "</strong><p>" + esc(rule.tells) + "</p></section>" +
      "<p>" + esc(item.dateLabel) + " · " + esc(status) + "</p>" +
      "<p>Format · " + esc(item.format) + "</p>" +
      "<p>Printed · " + esc(item.printed || "unknown") + "</p>" +
      "<p>No sold data</p>" +
      "<section class=\"tool\"><p class=\"kicker\">Check</p>" + allCheckLinks(item.name) + "</section>";
  }

  function inventoryRows() {
    var q = state.invQuery.trim().toLowerCase();
    return S.sortInventory(Inv.visible(invState)).filter(function (item) {
      if (state.invFilter === "sell" && sellBucket(item) !== "sell") return false;
      if (state.invFilter === "verify" && item.tag !== "verify-sth") return false;
      if (!q) return true;
      return (item.name + " " + (item.notes || "") + " " + (item.status || "") + " " + (item.tag || "")).toLowerCase().indexOf(q) !== -1;
    });
  }

  function inventoryListHtml() {
    var rows = inventoryRows();
    if (!rows.length) return stateCard("empty", "Nothing in this filter", "The book is still saved.");
    var grouped = !state.invQuery.trim() && state.invFilter === "all";
    if (!grouped) return '<div class="list">' + rows.map(invRow).join("") + "</div>";
    var buckets = { sell: [], verify: [], duplicate: [], hand: [] };
    rows.forEach(function (item) { buckets[sellBucket(item)].push(item); });
    return '<p class="kicker">Sell first</p><div class="list">' + buckets.sell.map(invRow).join("") + "</div>" +
      '<p class="kicker">Verify the card</p><div class="list">' + buckets.verify.map(invRow).join("") + "</div>" +
      '<details class="leave"><summary>Duplicates (' + buckets.duplicate.length + ')</summary><div class="list">' + buckets.duplicate.map(invRow).join("") + "</div></details>" +
      '<details class="leave"><summary>Rest of the book (' + buckets.hand.length + ')</summary><div class="list">' + buckets.hand.map(invRow).join("") + "</div></details>";
  }

  function renderInventory() {
    if (bootError) return stateCard("error", "Inventory needs a reset", bootError);
    var summary = Inv.portfolio(invState, seedFile);
    var filters = [
      ["all", "All"],
      ["sell", "Sell first"],
      ["verify", "Verify"],
    ];
    return "<h1>Inventory</h1>" +
      '<p class="bookline" id="inventory-summary"><strong>' + esc(String(summary.packages)) + " packages</strong> · Invested " + esc(summary.investedLabel) + " · Book target " + esc(summary.targetLabel) + "</p>" +
      '<p class="fine">' + esc(String(summary.verifiedSupers)) + " confirmed Super · " + esc(String(summary.toVerify)) + " still to verify. Book targets are not live solds.</p>" +
      '<div class="filter-row">' + filters.map(function (pair) {
        return '<button class="chip' + (state.invFilter === pair[0] ? " is-on" : "") + '" type="button" data-filter="' + pair[0] + '">' + pair[1] + "</button>";
      }).join("") + "</div>" +
      '<label class="search"><span>Search the book</span><input id="inv-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Lotus, Subaru, Mix H" value="' + esc(state.invQuery) + '"></label>' +
      '<div class="actions"><button class="solid" type="button" data-action="add-purchase">Add</button><button class="ghost" type="button" data-action="export-json">Export JSON</button><button class="ghost" type="button" data-action="export-csv">Export CSV</button><button class="ghost" type="button" data-action="import-json">Import JSON</button></div>' +
      '<div class="list" id="inventory-list">' + inventoryListHtml() + "</div>";
  }

  function renderInvDetail() {
    var item = findInv(state.invId);
    if (!item) return stateCard("error", "Missing package", "That package is not in inventory.");
    var hint = sellHint(item);
    var shot = photoFor(item);
    return '<button class="back" type="button" data-back>Inventory</button>' +
      heroPhoto(item) +
      "<h1>" + esc(item.name) + "</h1>" +
      "<p>" + invBadge(item) + "</p>" +
      (hint ? '<p class="digest">' + esc(hint) + "</p>" : "") +
      '<section class="tool"><p>Cost · ' + money(item.cost) + "</p>" +
      "<p>" + esc(bookTarget(item)) + ". This is your book, not a sold comp.</p>" +
      "<p>No sold data</p>" +
      "<p>Notes · " + esc(item.notes || "None") + "</p>" +
      "<p>Status · " + esc(item.status || "On hand") + ". STH and Verify are statuses, not a buy button.</p>" +
      "<p>Grade · " + esc(item.grade || "Not set") + "</p>" +
      "<p>Photo · " + (shot ? "Package photo from the buy list." : "Photo needed") + "</p></section>" +
      "<section class=\"tool\"><p class=\"kicker\">Check</p>" + allCheckLinks(item.name) + '<p class="fine">Search only. Not a shelf count.</p></section>' +
      '<div class="actions"><button class="solid" type="button" data-action="keep">Keep</button><button class="solid" type="button" data-action="sold">Sold</button><button class="ghost" type="button" data-action="estimate">Estimate</button><button class="ghost" type="button" data-action="edit-inv">Edit</button><button class="danger" type="button" data-action="remove-inv">Remove</button></div>';
  }

  function invForm(item) {
    item = item || { category: "Cars", status: "On hand", tag: "mainline", store: "Walmart" };
    var cats = ["Cars", "Sports", "Sneakers", "Tech", "Streetwear", "Golf", "Pokémon"];
    return '<button class="back" type="button" data-back>Back</button><h1>' + (item.id ? "Edit" : "Add purchase") + "</h1>" +
      '<form id="inv-form" class="tool">' +
      field("Name", "inv-name", "text", item.name || "") +
      field("Cost", "inv-cost", "number", item.cost != null ? item.cost : "") +
      field("Book target low", "inv-low", "number", item.resaleLow != null ? item.resaleLow : "") +
      field("Book target high", "inv-high", "number", item.resaleHigh != null ? item.resaleHigh : "") +
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
    var map = { Cars: "cars", Sports: "sports", Sneakers: "sneakers", Tech: "tech", Streetwear: "streetwear", Golf: "golf", "Pokémon": "pokemon" };
    return map[name] || "cars";
  }

  function renderGolfDetail() {
    return '<button class="back" type="button" data-back>Back</button>' +
      heroPhoto({ photoSource: golf.note }) +
      "<h1>" + esc(state.itemId) + "</h1>" +
      '<section class="call call-buy"><strong>Buy</strong><p>Name-brand club only. No sold data, so do not invent a price.</p></section>' +
      '<p class="digest">' + esc(golf.note || "") + "</p>" +
      "<p>No sold data</p>" +
      '<section class="tool"><p class="kicker">Check</p>' + allCheckLinks(state.itemId + " golf") + "</section>";
  }

  function renderProfit() {
    var options = '<optgroup label="Buy list">' + allCatalog().map(function (item) {
      return '<option value="c:' + esc(item.id) + '">' + esc(item.name) + "</option>";
    }).join("") + '</optgroup><optgroup label="Inventory">' + Inv.visible(invState).map(function (item) {
      return '<option value="i:' + esc(item.id) + '">' + esc(item.name) + "</option>";
    }).join("") + "</optgroup>";
    return "<h1>Profit</h1>" +
      '<p class="digest">Fees are 13%. Shipping is what you pay. A blank sold stays No sold data.</p>' +
      '<form id="profit-form" class="tool">' +
      '<label class="field"><span>Item</span><select id="profit-item">' + options + "</select></label>" +
      field("Shelf or cost", "profit-cost", "number", "") +
      '<p id="profit-tracked"></p><p id="profit-target"></p>' +
      field("Your sold", "profit-sold", "number", "") +
      field("Shipping", "profit-ship", "number", shipping()) +
      field("Tax, optional", "profit-tax", "number", tax()) +
      '<div class="result"><p class="kicker" id="profit-result-label">Result</p><p id="profit-gate"></p><p id="profit-fees"></p><p id="profit-net"></p><p id="profit-roi"></p><p id="profit-even"></p></div>' +
      '<button class="ghost" type="button" data-action="sources">Sources</button>' +
      "</form>";
  }

  function screenHtml() {
    if (bootError && state.tab !== "inventory") {
      return stateCard("error", "Reseller hit a problem", bootError) + '<button class="solid" type="button" data-action="retry">Try again</button>';
    }
    if (state.view === "lanes") return renderLanes();
    if (state.view === "lane") return renderLane();
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
    return renderHunt();
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
    var checkedLine = document.getElementById("checked-line");
    if (checkedLine) checkedLine.textContent = checked ? "Last refresh · " + formatWhen(checked) : "";
    var live = document.getElementById("status-live");
    if (live) live.textContent = state.note || "";
    if (state.tab === "profit" && state.view === "root") bindProfit();
    var hunt = document.getElementById("hunt-q");
    if (hunt && document.activeElement && document.activeElement.id === "hunt-q") {
      var pos = state.query.length;
      hunt.focus();
      hunt.setSelectionRange(pos, pos);
    }
    var invQ = document.getElementById("inv-q");
    if (invQ && document.activeElement && document.activeElement.id === "inv-q") {
      invQ.focus();
      var iq = state.invQuery.length;
      invQ.setSelectionRange(iq, iq);
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
      lane: state.lane,
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
    if (state.profitId) itemEl.value = state.profitId;
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
      var comp = item && picked.kind === "catalog" ? Rules.compOf(item) : null;
      var targetLine = "Book target · none";
      if (item && picked.kind === "inventory") targetLine = bookTarget(item) + " · not a sold comp";
      document.getElementById("profit-target").textContent = targetLine;
      document.getElementById("profit-tracked").textContent = comp
        ? "Sourced comp · " + comp.label + " · " + comp.source + ". Not used until you type Your sold."
        : "No sold data";
      var feeEl = document.getElementById("profit-fees");
      var netEl = document.getElementById("profit-net");
      var roiEl = document.getElementById("profit-roi");
      var evenEl = document.getElementById("profit-even");
      var gate = document.getElementById("profit-gate");
      var label = document.getElementById("profit-result-label");
      if (typed == null || !Number.isFinite(typed)) {
        label.textContent = "Result";
        gate.textContent = "Enter Your sold to see an estimate. A blank field is not a return.";
        feeEl.textContent = "";
        netEl.textContent = "";
        roiEl.textContent = "";
        evenEl.textContent = "";
        return;
      }
      label.textContent = "Estimate";
      gate.textContent = "You typed this sold. Estimate only. Not a realized return.";
      var low = typed;
      var high = typed;
      var source = "You entered this";
      var feeLow = C.feeAmount(Math.min(low, high), 0.13);
      var feeHigh = C.feeAmount(Math.max(low, high), 0.13);
      var netLow = C.netProfit({ sold: Math.min(low, high), cost: cost || 0, shipping: ship, tax: taxVal });
      var netHigh = C.netProfit({ sold: Math.max(low, high), cost: cost || 0, shipping: ship, tax: taxVal });
      var roiLow = C.roi(netLow, cost);
      var roiHigh = C.roi(netHigh, cost);
      var even = C.breakEven({ cost: cost || 0, shipping: ship, tax: taxVal });
      feeEl.textContent = "Fees · " + spanMoney(feeLow, feeHigh) + " · " + source;
      netEl.textContent = "Net profit · " + spanMoney(netLow, netHigh);
      roiEl.textContent = "Estimate ROI · " + (roiLow == null ? "Unknown" : spanPct(roiLow, roiHigh));
      evenEl.textContent = "Break-even · " + money(even) + " · estimate, not a return.";
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
      notes: Rules.tellsFor(item),
      cost: retailNum(item) || 0,
      resaleLow: null,
      resaleHigh: null,
      resaleLabel: "",
      tag: "mainline",
      store: "",
      date: new Date().toISOString().slice(0, 10),
      status: "On hand",
      category: (Rules.laneMeta(Rules.laneFor(item)) || {}).title || "Cars",
      grade: gradeOfCatalog(item),
      catalogId: item.id,
    });
    Inv.write(localStorage, invState);
    push({ tab: "inventory", view: "inv", invId: row.id });
  }

  async function refreshAll() {
    state.refreshing = true;
    state.note = "Checking what this page is allowed to reach…";
    render();
    var results = [];
    for (var i = 0; i < R.PROVIDERS.length; i++) {
      var plan = R.refreshPlan(R.PROVIDERS[i]);
      if (plan.status === "attempt") results.push(await attemptDollarTree());
      else results.push(plan);
    }
    results.forEach(function (result) { R.applyRefreshResult(null, result); });
    var when = new Date().toISOString();
    localStorage.setItem("reseller-checked-at", when);
    writeJson("reseller-provider-log", { at: when, results: results });
    state.refreshing = false;
    state.note = "No prices changed. Store sites stay blocked from this page.";
    render();
  }

  function attemptDollarTree() {
    var url = R.CHECK.dollartreeJson + encodeURIComponent("hot wheels");
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 2500) : null;
    return fetch(url, { mode: "cors", credentials: "omit", signal: controller ? controller.signal : undefined }).then(function (res) {
      return { id: "dollar-tree", status: "blocked", updatesPrice: false, message: res.ok ? "Dollar Tree answered. No price was saved." : "Dollar Tree refused the fetch. No price was saved." };
    }).catch(function () {
      return { id: "dollar-tree", status: "blocked", updatesPrice: false, message: "Dollar Tree blocked the fetch. No price was invented." };
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

  function openZoom(src, alt) {
    var img = document.getElementById("zoom-img");
    img.src = src;
    img.alt = alt || "";
    if (!zoom.open) zoom.showModal();
  }

  function closeZoom() {
    if (zoom.open) zoom.close();
    document.getElementById("zoom-img").removeAttribute("src");
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
      return '<section class="tool"><p class="kicker">' + esc(provider.name) + "</p><p>" + esc(status) + "</p><p>" + esc((logged && logged.message) || provider.detail) + "</p></section>";
    }).join("");
    return "<h2>Sources</h2><p>No settled sale is shown without a source URL. Older guide notes stay in the file and stay off the card.</p>" + body +
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
    var text = [item.name, Rules.tellsFor(item), "Shelf: " + shelfLabel(item), "Sold: " + Rules.priceLine(item)].join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
    state.note = "Notes copied.";
  }

  document.addEventListener("click", function (event) {
    var zoomBtn = event.target.closest("[data-zoom]");
    if (zoomBtn) {
      openZoom(zoomBtn.getAttribute("data-zoom"), zoomBtn.getAttribute("data-alt"));
      return;
    }
    var tab = event.target.closest("[data-tab]");
    if (tab && tab.closest(".tabbar")) { setTab(tab.getAttribute("data-tab")); return; }
    var backBtn = event.target.closest("[data-back]");
    if (backBtn) { back(); return; }
    var storeBtn = event.target.closest("[data-store]");
    if (storeBtn) {
      var storeId = storeBtn.getAttribute("data-store");
      if (state.tab === "stores") push({ view: "store", storeId: storeId });
      else push({ tab: "hunt", view: "lanes", storeId: storeId });
      return;
    }
    var laneBtn = event.target.closest("[data-lane]");
    if (laneBtn) { push({ view: "lane", lane: laneBtn.getAttribute("data-lane") }); return; }
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
    var filterBtn = event.target.closest("[data-filter]");
    if (filterBtn) {
      state.invFilter = filterBtn.getAttribute("data-filter");
      render();
      return;
    }
    var gradeBtn = event.target.closest("[data-grade]");
    if (gradeBtn && state.itemId && state.view === "catalog") {
      var grades = gradeMap();
      grades[state.itemId] = gradeBtn.getAttribute("data-grade");
      writeJson("reseller-grade", grades);
      render();
      return;
    }
    var stockBtn = event.target.closest("[data-stock]");
    if (stockBtn && state.itemId && state.view === "catalog") {
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
    var actionBtn = event.target.closest("[data-action]");
    if (!actionBtn) return;
    var actionName = actionBtn.getAttribute("data-action");
    if (actionName === "refresh") { refreshAll(); return; }
    if (actionName === "sources") { openSheet(sourcesHtml()); return; }
    if (actionName === "close-sheet") { closeSheet(); return; }
    if (actionName === "close-zoom") { closeZoom(); return; }
    if (actionName === "retry") { boot(); return; }
    if (actionName === "scan") { openScan(); return; }
    if (actionName === "add-purchase") {
      state.invId = "";
      push({ tab: "inventory", view: "inv-form", invId: "" });
      return;
    }
    if (actionName === "add-inv") { var current = findCatalog(state.itemId); if (current) addCatalog(current); return; }
    if (actionName === "estimate") {
      if (state.view === "catalog" && state.itemId) state.profitId = "c:" + state.itemId;
      if ((state.view === "inv" || state.tab === "inventory") && state.invId) state.profitId = "i:" + state.invId;
      setTab("profit");
      return;
    }
    if (actionName === "copy-notes") {
      var noted = findCatalog(state.itemId);
      if (noted) copyNotes(noted);
      render();
      return;
    }
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
      openSheet("<h2>Remove this package?</h2><p>It leaves the list. The 78-package import will not put it back.</p><button class=\"danger full\" type=\"button\" data-action=\"confirm-remove\">Remove</button>");
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
      openSheet('<h2>Import JSON</h2><p>Rows merge by id. The 78-package book stays unless you removed a row.</p><label class="field"><span>File</span><input id="import-file" type="file" accept="application/json,.json"></label><button class="solid full" type="button" data-action="run-import">Import</button><p id="import-error" class="fine"></p>');
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
      state.stack = [];
      render();
    }
  });

  document.addEventListener("input", function (event) {
    if (event.target.id === "hunt-q") {
      state.query = event.target.value;
      var box = document.getElementById("hunt-body");
      if (box) {
        box.innerHTML = state.query.trim() ? huntResults() : '<div class="store-list">' + stores.map(storeButton).join("") + '</div><button class="ghost" type="button" data-action="scan">Scan a code</button>';
      }
      return;
    }
    if (event.target.id === "inv-q") {
      state.invQuery = event.target.value;
      var list = document.getElementById("inventory-list");
      if (list) list.innerHTML = inventoryListHtml();
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
  if (zoom) {
    zoom.addEventListener("click", function (event) {
      if (event.target === zoom) closeZoom();
    });
  }

  function openScan() {
    var canScan = !!(navigator.mediaDevices && window.BarcodeDetector);
    var camera = canScan
      ? '<video id="scan-video" playsinline muted></video><p id="scan-msg" class="fine"></p>'
      : '<p id="scan-msg" class="fine">No barcode detector in this browser. Type the name. The code is not the tell. Read the card.</p>';
    openSheet('<h2>Scan a code</h2><p>Supers share a UPC with the regular, so the code is not the tell. Read the card.</p>' + camera + '<label class="field"><span>Or type the name</span><input id="scan-q" type="text" autocomplete="off"></label><button class="solid full" type="button" data-action="run-scan-text">Search the list</button>');
    if (!canScan) return;
    var msg = document.getElementById("scan-msg");
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
            state.stack = [];
            render();
          }).catch(function () {});
        }, 500);
      });
    }).catch(function () {
      var video = document.getElementById("scan-video");
      if (video) video.remove();
      msg.textContent = "Camera is unavailable. Type the name. Read the card.";
    });
  }

  function openSold() {
    openSheet('<h2>Mark sold</h2><p>Leave the price blank if you do not want to store one. Blank is not a guess.</p><label class="field"><span>Sold price, optional</span><input id="sold-price" type="number" inputmode="decimal" step="0.01"></label><button class="solid full" type="button" data-action="confirm-sold">Save sold</button>');
  }

  function boot() {
    bootError = "";
    screen.innerHTML = stateCard("loading", "Loading", "Opening the hunt.");
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
        bootError = "Saved inventory could not be read. It was not replaced. Clear site data only if you have a backup.";
        invState = { version: 2, items: [], tombstones: [], migratedBought: true };
        render();
        return;
      }
      invState = loaded.state;
      if (seedFile && seedFile.count && Inv.visible(invState).length === 0) {
        bootError = "The 78-package book did not load.";
      }
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
