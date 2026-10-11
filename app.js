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
  var market = { sections: [], generatedAt: "", formula: "" };
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
    dataPhase: "",
    stack: [],
    moveFocus: false,
    profitId: "c:cuda",
    archiveQuery: "",
    archiveYear: "",
    archiveLine: "all",
    archiveWorth: false,
    archiveLimit: 36,
    marketBrand: "latest",
    marketLimit: 24,
    marketId: "",
  };

  var hwBook = { manifest: null, index: null, years: {}, error: "", flight: null };
  var HW_PREMIUM = { premium: 1, boulevard: 1, "car-culture": 1, "pop-culture": 1, rlc: 1, elite: 1, "team-transport": 1, ff: 1 };
  var HW_LINE = {
    mainline: "Mainline",
    th: "Treasure Hunt",
    sth: "Super TH",
    redline: "Red Line",
    premium: "Premium",
    boulevard: "Boulevard",
    "car-culture": "Car Culture",
    "pop-culture": "Pop Culture",
    rlc: "RLC",
    elite: "Elite 64",
    "team-transport": "Team Transport",
    ff: "Fast & Furious",
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
    if (shot) {
      var w = item && Number(item.photoWidth);
      var h = item && Number(item.photoHeight);
      var dims = w && h ? ' width="' + w + '" height="' + h + '" style="aspect-ratio:' + w + " / " + h + '"' : "";
      return '<span class="peg-photo' + (large ? " is-hero" : "") + '"><img src="' + esc(shot.src) + '" alt=""' + dims + ' loading="lazy" decoding="async"></span>';
    }
    if (!large) return "";
    return '<span class="peg-photo is-empty is-hero"><em>Photo needed</em></span>';
  }

  function decisionBar(verdict, resaleVerdict) {
    if (resaleVerdict === "BUY") return '<span class="decision decision-buy"><span class="verdict verdict-buy">BUY</span><span>If the card matches</span></span>';
    if (resaleVerdict === "CHECK") return '<span class="decision decision-check"><span class="verdict verdict-check">CHECK</span><span>Confirm solds before multiples</span></span>';
    if (resaleVerdict === "LOT ONLY") return '<span class="decision decision-lot"><span class="verdict verdict-lot">LOT ONLY</span><span>Bundle it</span></span>';
    if (resaleVerdict === "PASS") return '<span class="decision decision-pass"><span class="verdict verdict-pass">PASS</span><span>Loses at this retail</span></span>';
    var buy = verdict === "Buy";
    return '<span class="decision decision-' + (buy ? "buy" : "pass") + '"><strong>' + (buy ? "Buy" : "Pass") + "</strong><span>" + (buy ? "If the card matches" : "Leave it") + "</span></span>";
  }

  function restockNote() {
    return '<p class="fine">Restocks, confirm with the store: Walmart often Monday, Tuesday, or midweek. Target often Sunday night or Monday. Dollar Tree follows freight. Kroger is a vendor stop, not a store tab. A case code is freight, not a national day.</p>';
  }

  function resaleOf(item) {
    if (item && item.resale && item.resale.verdict) return item.resale;
    var rule = item && Rules.cardRule(item.id);
    if (!rule || !rule.resaleVerdict) return null;
    return {
      id: rule.resaleId || "",
      verdict: rule.resaleVerdict,
      howToSpot: rule.tells || "",
      soldSource: rule.soldSource || "",
      soldUrl: rule.soldUrl || "",
      series: rule.series || "",
      toyNo: rule.toyNo || "",
    };
  }

  function pegMoney(item) {
    var pay = Rules.payFor(item) || shelfLabel(item) || "Shelf price on the tag";
    var line = Rules.priceLine(item);
    var resale = resaleOf(item);
    var source = resale && resale.soldSource ? resale.soldSource : "";
    if (line === "No sold data") return esc(pay) + " · No sold data" + (source ? " · " + esc(source) : "");
    return esc(pay) + " · " + esc(line) + (source ? " · " + esc(source) : "");
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
    if (money) {
      var link = money.url && Rules.isSourceUrl(money.url)
        ? ' <a class="text-link" href="' + esc(money.url) + '" target="_blank" rel="noopener noreferrer">Sold source</a>'
        : "";
      return '<p class="fine">' + esc(money.note) + " Re-check solds before listing. Net is sold × 0.87 − $5." + link + "</p>";
    }
    var resale = resaleOf(item);
    if (resale && resale.soldSource) return '<p class="fine">' + esc(resale.soldSource) + "</p>";
    return '<p class="fine">No source URL and no sheet sold. Do not invent a sold.</p>';
  }

  function seriesLine(item, resale) {
    var series = (resale && resale.series) || "";
    var toy = (resale && resale.toyNo) || "";
    if (!series) return "";
    var text = series + (toy && toy !== "—" ? " · " + toy : "");
    return '<span class="peg-meta">' + esc(text) + "</span>";
  }

  function sourceLink(resale) {
    var url = resale && resale.soldUrl;
    if (!url || !Rules.isSourceUrl(url)) return "";
    return '<div class="link-row"><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Sold source</a></div>';
  }

  function pegCard(item, opts) {
    opts = opts || {};
    var verdict = Rules.verdictFor(item);
    var resale = resaleOf(item);
    var idAttr = item.kind === "golf" ? ' data-golf="' + esc(item.name) + '"' : ' data-item="' + esc(item.id) + '"';
    if (resale && resale.id) idAttr += ' data-resale="' + esc(resale.id) + '"';
    var links = opts.links || "";
    var photo = pegPhoto(item, true);
    var spot = resale && resale.howToSpot ? resale.howToSpot : Rules.tellsFor(item);
    return '<article class="peg"><button class="peg-open is-stack" type="button"' + idAttr + ">" +
      photo +
      '<span class="peg-copy"><span class="peg-name">' + esc(item.name) + "</span>" +
      seriesLine(item, resale) +
      "</span>" +
      decisionBar(verdict, resale && resale.verdict) +
      '<span class="peg-foot"><span class="peg-tell">' + esc(spot) + "</span>" +
      '<span class="peg-meta">' + pegMoney(item) + "</span></span></button>" +
      sourceLink(resale) +
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

  var HUNT_LANES = ["sth", "cc", "ff", "mbsc", "exclusive", "premium", "multipack", "hw-main", "leave", "selective", "pokemon"];

  function isListed(item) {
    var verdict = Rules.verdictFor(item);
    return verdict === "Buy" || verdict === "Check" || verdict === "Lot";
  }

  function aisleSection(laneId, linkStore) {
    var meta = Rules.laneMeta(laneId);
    var items = laneItems(laneId);
    if (!meta || !items.length) return "";
    var store = linkStore ? findStore(linkStore) : null;
    return '<section class="aisle" id="aisle-' + esc(laneId) + '">' +
      '<p class="kicker">' + esc(meta.kicker) + "</p>" +
      "<h2>" + esc(meta.title) + "</h2>" +
      '<p class="digest">' + esc(meta.rule) + "</p>" +
      '<div class="list">' + items.map(function (item) {
        return pegCard(item, store ? { links: storeLinks(item.name, store) } : {});
      }).join("") + "</div></section>";
  }

  function aisleJump() {
    return '<nav class="aisle-jump" aria-label="Peg lines">' + HUNT_LANES.map(function (id) {
      var meta = Rules.laneMeta(id);
      if (!meta) return "";
      return '<a href="#aisle-' + esc(id) + '">' + esc(meta.title) + "</a>";
    }).join("") + "</nav>";
  }

  function renderDropsStrip() {
    var picked = window.ResellerHuntDrops.pickHuntDrops(drops, D.APP_TODAY, function (row) {
      return Rules.dropVerdict(row.id).verdict;
    });
    function line(label, row) {
      if (!row) return "<p><b>" + label + "</b> Nothing dated</p>";
      return "<p><b>" + label + "</b> " + esc(row.name) + " · " + esc(D.releaseState(row.iso)) + "</p>";
    }
    return '<button class="drops-strip" type="button" data-action="open-drops">' +
      '<span class="kicker">Drops</span>' +
      line("Next", picked.next) +
      line("New", picked.fresh) +
      '<span class="chev" aria-hidden="true">›</span></button>';
  }

  function renderHunt() {
    var body = state.query.trim() ? huntResults() : '<div class="store-row">' + stores.map(function (store) {
      return '<button class="store-chip" type="button" data-store="' + esc(store.id) + '">' + esc(store.name) + "</button>";
    }).join("") + "</div>" +
      '<button class="ghost" type="button" data-action="scan">Scan a code</button>' +
      aisleJump() +
      HUNT_LANES.map(function (id) { return aisleSection(id); }).join("");
    return offlineBanner() +
      renderDropsStrip() +
      "<h1>Where are you?</h1>" +
      '<p class="digest">Every peg line is on this screen. Pick a store when you want that store’s copy of the same list.</p>' +
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
        var buys = laneItems(id).filter(isListed).length;
        var count = buys ? buys + " on the list" : "Pass lane";
        return '<button class="lane-card" type="button" data-lane="' + esc(id) + '"><span class="mono">' + esc(meta.title.slice(0, 2).toUpperCase()) + '</span><span><b>' + esc(meta.title) + "</b><span>" + esc(meta.blurb) + " · " + esc(count) + "</span></span><span class=\"chev\" aria-hidden=\"true\">›</span></button>";
      }).join("") + "</div>";
  }

  function renderLane() {
    var meta = Rules.laneMeta(state.lane);
    var store = findStore(state.storeId);
    if (!meta) return stateCard("error", "Missing aisle", "That category is not on the hunt.");
    var items = laneItems(state.lane);
    var buys = items.filter(isListed);
    var passes = items.filter(function (item) { return !isListed(item); });
    var buyHtml = buys.length
      ? buys.map(function (item) { return pegCard(item); }).join("")
      : '<p class="fine">Nothing in this aisle is a blind buy.</p>';
    var passHtml = passes.length
      ? '<details class="leave"' + (buys.length ? "" : " open") + '><summary>Leave on peg (' + passes.length + ")</summary><div class=\"list\">" + passes.map(function (item) { return pegCard(item); }).join("") + "</div></details>"
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
    var body = storeLanes(store).map(function (lane) {
      return aisleSection(lane, store.id);
    }).join("");
    if (!body) body = stateCard("empty", "No buy list here", store.look);
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
    var resale = resaleOf(item);
    var badge = resale && resale.verdict ? resale.verdict : verdict;
    var callClass = badge === "BUY" || badge === "Buy" ? "buy" : badge === "CHECK" ? "check" : badge === "LOT ONLY" ? "lot" : "pass";
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
      '<section class="call call-' + callClass + '"><strong>' + esc(badge) + "</strong><p>" + esc(Rules.tellsFor(item)) + "</p></section>" +
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

  function marketMoneyText(value) {
    return "$" + Number(value).toFixed(2);
  }

  function marketPhoto(item) {
    if (!item || !item.photo) return '<span class="market-photo"><em>Photo needed</em></span>';
    return '<span class="market-photo"><img src="' + esc(item.photo) + '" alt="" width="640" height="480" loading="lazy" decoding="async"></span>';
  }

  function marketFoot(item) {
    var retail = item.retailLabel || "MSRP not on the source";
    var sold = item.sold == null ? "No sold data" : "Sold " + marketMoneyText(item.sold);
    var net = item.net == null ? "Net · no sold" : "Net " + marketMoneyText(item.net);
    return "Retail · " + retail + " · " + sold + " · " + net;
  }

  function findMarket(id) {
    var found = null;
    (market.sections || []).forEach(function (section) {
      (section.items || []).forEach(function (item) {
        if (item.id === id) found = item;
      });
    });
    return found;
  }

  function marketPool() {
    var sections = market.sections || [];
    if (state.marketBrand === "latest") {
      var all = [];
      sections.forEach(function (section) {
        (section.items || []).forEach(function (item) { all.push(item); });
      });
      var today = "";
      try { today = new Date().toISOString().slice(0, 10); } catch (err) { today = D.APP_TODAY; }
      return window.ResellerMarket ? window.ResellerMarket.latestFeed(all, today) : [];
    }
    var section = sections.filter(function (row) { return row.id === state.marketBrand; })[0];
    return section && section.items ? section.items : [];
  }

  function marketCard(item) {
    var when = item.releaseLabel || "";
    return '<article class="peg"><button class="peg-open is-stack" type="button" data-market="' + esc(item.id) + '">' +
      marketPhoto(item) +
      '<span class="peg-copy"><span class="peg-name">' + esc(item.name) + "</span>" +
      (when ? '<span class="peg-meta">' + esc(when) + "</span>" : "") +
      "</span>" +
      decisionBar("", item.verdict) +
      '<span class="peg-foot"><span class="peg-tell">' + esc(item.spot || "") + "</span>" +
      '<span class="peg-meta">' + esc(marketFoot(item)) + "</span></span></button></article>";
  }

  function renderMarketList() {
    var sections = market.sections || [];
    var chips = '<div class="hw-lines" role="group" aria-label="Brands">' +
      '<button type="button" data-market-brand="latest"' + (state.marketBrand === "latest" ? ' class="is-on" aria-pressed="true"' : ' aria-pressed="false"') + ">Latest</button>" +
      sections.map(function (section) {
        var on = state.marketBrand === section.id;
        return '<button type="button" data-market-brand="' + esc(section.id) + '"' + (on ? ' class="is-on" aria-pressed="true"' : ' aria-pressed="false"') + ">" + esc(section.title) + "</button>";
      }).join("") + "</div>";
    var current = sections.filter(function (row) { return row.id === state.marketBrand; })[0];
    var kicker = state.marketBrand === "latest" ? "Latest drops" : (current ? current.title : "Drops");
    var note = state.marketBrand === "latest"
      ? "Soonest release or restock from today forward. BUY needs a liquid sold whose net beats retail × 1.09 by $15. PASS loses at retail. CHECK is everything else."
      : ((current && current.note) || "");
    var items = marketPool();
    var page = items.slice(0, state.marketLimit);
    var body = page.length
      ? '<div class="list">' + page.map(marketCard).join("") + "</div>"
      : '<p class="market-note">No products on this feed. Nothing was invented.</p>';
    var more = items.length > page.length
      ? '<button class="ghost hw-more" type="button" data-market-more>Show more</button>'
      : "";
    var checked = market.generatedAt ? '<p class="fine">Market file · ' + esc(formatWhen(market.generatedAt)) + "</p>" : "";
    return '<p class="kicker">' + esc(kicker) + "</p>" +
      '<p class="digest">Photo, how to spot, retail, verified sold, and net. Net is sold × 0.87 − $5. BUY, PASS, or CHECK.</p>' +
      chips +
      (note ? '<p class="fine">' + esc(note) + "</p>" : "") +
      checked +
      body + more;
  }

  function renderMarketDetail() {
    var item = findMarket(state.marketId);
    if (!item) return stateCard("error", "Missing drop", "That product is not on the market list.");
    var callClass = item.verdict === "BUY" ? "buy" : item.verdict === "PASS" ? "pass" : item.verdict === "LOT ONLY" ? "lot" : "check";
    var soldBlock = item.sold == null
      ? "<p>No sold data</p>" + (item.soldSource ? '<p class="fine">' + esc(item.soldSource) + "</p>" : "")
      : "<p>Sold " + esc(marketMoneyText(item.sold)) + (item.soldDate ? " · " + esc(item.soldDate) : "") + "</p>" +
        (item.soldSource ? "<p>" + esc(item.soldSource) + "</p>" : "") +
        (item.soldUrl ? '<div class="link-row"><a href="' + esc(item.soldUrl) + '" target="_blank" rel="noopener noreferrer">Sold source</a></div>' : "");
    var netLine = item.net == null ? "Net · no sold" : "Net " + marketMoneyText(item.net);
    var retailLink = item.retailUrl
      ? '<div class="link-row"><a href="' + esc(item.retailUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(item.retailSource || "Retail source") + "</a></div>"
      : "";
    var photoCredit = item.photoPage
      ? '<p class="fine"><a class="text-link" href="' + esc(item.photoPage) + '" target="_blank" rel="noopener noreferrer">' + esc(item.photoCredit || "Photo source") + "</a></p>"
      : "";
    return '<button class="back" type="button" data-back>Drops</button>' +
      marketPhoto(item) +
      "<h1>" + esc(item.name) + "</h1>" +
      '<section class="call call-' + callClass + '"><strong>' + esc(item.verdict || "CHECK") + "</strong><p>" + esc(item.spot || "Read the package.") + "</p></section>" +
      '<section class="tool"><p class="kicker">Retail</p><p>' + esc(item.retailLabel || "MSRP not on the source") + "</p>" + retailLink + "</section>" +
      (item.releaseLabel ? '<section class="tool"><p class="kicker">Release</p><p>' + esc(item.releaseLabel) + "</p></section>" : "") +
      '<section class="tool"><p class="kicker">Sold</p>' + soldBlock + "</section>" +
      '<section class="tool"><p class="kicker">Net</p><p>' + esc(netLine) + '</p><p class="fine">Net is sold × 0.87 − $5.</p></section>' +
      '<section class="tool"><p class="kicker">Street</p><p>' + esc(item.streetNote || "No verified street price.") + "</p></section>" +
      photoCredit;
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
      renderMarketList() +
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

  function hwLineLabel(line) {
    return HW_LINE[line] || line || "Mainline";
  }

  function hwVerdict(code) {
    if (code === "BUY" || code === "Buy") return { label: "BUY", cls: "verdict verdict-buy" };
    if (code === "CHECK" || code === "Check") return { label: "CHECK", cls: "verdict verdict-check" };
    if (code === "LOT ONLY" || code === "Lot" || code === "LOT") return { label: "LOT ONLY", cls: "verdict verdict-lot" };
    return { label: "Worth reselling", cls: "verdict verdict-check" };
  }

  function loadHwBook() {
    if (hwBook.index) return Promise.resolve(hwBook);
    if (hwBook.flight) return hwBook.flight;
    hwBook.flight = Promise.all([
      fetchFreshJson("data/hw/manifest.json"),
      fetchFreshJson("data/hw/index.json"),
    ]).then(function (parts) {
      hwBook.manifest = parts[0].data;
      hwBook.index = parts[1].data;
      hwBook.error = "";
      if (!state.archiveYear) {
        var years = (hwBook.manifest.years || []).map(function (row) { return row.year; });
        state.archiveYear = years.length ? String(years[years.length - 1]) : "all";
      }
      if (state.tab === "archive" && state.view === "root" && canRepaint()) render();
    }).catch(function () {
      hwBook.error = navigator.onLine ? "The catalog did not load." : "Offline. The catalog is not on this phone yet.";
      hwBook.flight = null;
      if (state.tab === "archive" && state.view === "root") render();
    });
    return hwBook.flight;
  }

  function reloadHwBook() {
    hwBook.index = null;
    hwBook.manifest = null;
    hwBook.years = {};
    hwBook.error = "";
    hwBook.flight = null;
    return loadHwBook();
  }

  function loadHwYears(years) {
    return Promise.all(years.map(function (year) {
      if (hwBook.years[year]) return Promise.resolve();
      return fetchFreshJson("data/hw/" + year + ".json").then(function (part) {
        var map = {};
        (part.data.items || []).forEach(function (item) { map[item.id] = item; });
        hwBook.years[year] = map;
      });
    })).then(function () {
      var list = document.getElementById("archive-list");
      if (!list || state.tab !== "archive" || state.view !== "root") return;
      var hits = filterHw();
      list.innerHTML = hwCardsHtml(hits.slice(0, state.archiveLimit), hits.length);
    }).catch(function () {
      hwBook.error = "A year file did not load.";
    });
  }

  function filterHw() {
    var items = (hwBook.index && hwBook.index.items) || [];
    var q = state.archiveQuery.trim().toLowerCase();
    var parts = q ? q.split(/\s+/) : [];
    return items.filter(function (item) {
      if (state.archiveYear && state.archiveYear !== "all" && String(item.y) !== String(state.archiveYear)) return false;
      if (state.archiveLine === "mainline" && item.l !== "mainline") return false;
      if (state.archiveLine === "th" && item.l !== "th") return false;
      if (state.archiveLine === "sth" && item.l !== "sth") return false;
      if (state.archiveLine === "redline" && item.l !== "redline") return false;
      if (state.archiveLine === "premium" && !HW_PREMIUM[item.l]) return false;
      if (state.archiveWorth && !item.w) return false;
      if (!parts.length) return true;
      var blob = (item.n + " " + item.t + " " + item.s + " " + item.c).toLowerCase();
      return parts.every(function (part) { return blob.indexOf(part) !== -1; });
    });
  }

  function hwRecord(hit) {
    var yearMap = hwBook.years[hit.y];
    return (yearMap && yearMap[hit.id]) || null;
  }

  function catalogSrc(url) {
    var value = String(url || "");
    if (/^http:\/\//i.test(value)) value = "https://" + value.slice(7);
    if (/^https:\/\//.test(value)) return value;
    if (value.indexOf("assets/hw/thumbs/") === 0) return value;
    return "";
  }

  function hwCardsHtml(page, total) {
    if (!page.length) {
      return stateCard("no-results", "No matches", "Try another name, toy number, year, or line.");
    }
    var cards = page.map(function (hit) {
      var item = hwRecord(hit);
      var name = item ? item.name : hit.n;
      var image = item && item.image ? item.image : "";
      var photo = catalogSrc(image)
        ? '<button type="button" class="hw-photo" data-zoom="' + esc(catalogSrc(image)) + '" data-alt="' + esc(name) + '"><img alt="" width="144" height="108" decoding="async" referrerpolicy="no-referrer" src="' + esc(catalogSrc(image)) + '"></button>'
        : '<div class="hw-photo" aria-hidden="true"><img alt="" width="144" height="108" src="assets/states/photo-needed.svg"></div>';
      var bits = [String(hit.y), hwLineLabel(item ? item.line : hit.l)];
      if (item && item.series) bits.push(item.series);
      else if (hit.s) bits.push(hit.s);
      if (item && item.col) bits.push("#" + item.col);
      else if (hit.c) bits.push("#" + hit.c);
      if (item && item.toy) bits.push(item.toy);
      else if (hit.t) bits.push(hit.t);
      var extra = "";
      if (item && item.variation) extra += '<p class="hw-meta">' + esc(item.variation) + "</p>";
      if (item && item.mix) extra += '<p class="hw-meta">Series ' + esc(item.mix) + (item.caseCode ? " · Case " + esc(item.caseCode) : "") + "</p>";
      else if (item && item.caseCode) extra += '<p class="hw-meta">Case ' + esc(item.caseCode) + "</p>";
      var worth = item && item.worth ? item.worth : (hit.w ? { id: "", verdict: hit.v } : null);
      var flag = "";
      if (worth) {
        var badge = hwVerdict(worth.verdict);
        flag = '<p><span class="' + badge.cls + '">' + esc(badge.label) + "</span></p>";
        if (worth.id && findCatalog(worth.id)) {
          flag += '<button type="button" class="ghost" data-item="' + esc(worth.id) + '">Open hunt card</button>';
        }
      }
      var credit = "";
      if (item && item.image) {
        var creditHref = item.imagePage || item.wiki || "";
        var creditName = item.imageCredit || (item.imageSource === "mattel" ? "Mattel Creations" : "Hot Wheels Wiki");
        credit = '<p class="hw-credit">Photo · ' + (creditHref
          ? '<a href="' + esc(creditHref) + '" rel="noopener noreferrer">' + esc(creditName) + "</a>"
          : esc(creditName)) + "</p>";
      } else if (item && item.wiki) {
        credit = '<p class="hw-credit"><a href="' + esc(item.wiki) + '" rel="noopener noreferrer">Hot Wheels Wiki</a></p>';
      }
      return '<article class="hw-card">' + photo + '<div class="hw-copy"><h2>' + esc(name) + "</h2><p class=\"hw-meta\">" + esc(bits.join(" · ")) + "</p>" + extra + flag + credit + "</div></article>";
    }).join("");
    var more = total > page.length
      ? '<button type="button" class="ghost hw-more" data-archive-more>Show more · ' + page.length + " of " + total + "</button>"
      : "";
    return cards + more;
  }

  function renderArchive() {
    if (hwBook.error && !hwBook.index) {
      return "<h1>Catalog</h1>" + stateCard("error", "Could not open the catalog", hwBook.error) + '<button class="solid" type="button" data-action="archive-retry">Try again</button>';
    }
    if (!hwBook.index) {
      loadHwBook();
      return "<h1>Catalog</h1>" + stateCard("loading", "Loading", "Opening the Hot Wheels book.");
    }
    var manifest = hwBook.manifest || { totals: {}, years: [] };
    var hits = filterHw();
    var page = hits.slice(0, state.archiveLimit);
    var needed = [];
    page.forEach(function (hit) {
      if (!hwBook.years[hit.y] && needed.indexOf(hit.y) === -1) needed.push(hit.y);
    });
    if (needed.length) loadHwYears(needed);
    var years = manifest.years || [];
    var options = '<option value="all"' + (state.archiveYear === "all" ? " selected" : "") + ">All years</option>" + years.map(function (row) {
      return '<option value="' + row.year + '"' + (String(state.archiveYear) === String(row.year) ? " selected" : "") + ">" + row.year + " · " + row.count + "</option>";
    }).join("");
    var lines = [
      ["all", "All"],
      ["mainline", "Mainline"],
      ["th", "Treasure Hunt"],
      ["sth", "Super TH"],
      ["redline", "Red Line"],
      ["premium", "Premium"],
    ];
    var lineButtons = lines.map(function (pair) {
      var on = state.archiveLine === pair[0];
      return '<button type="button" data-archive-line="' + pair[0] + '"' + (on ? ' class="is-on" aria-pressed="true"' : ' aria-pressed="false"') + ">" + pair[1] + "</button>";
    }).join("");
    var totals = manifest.totals || {};
    var digest = (totals.count || 0).toLocaleString("en-US") + " releases";
    if (totals.photoPct != null) digest += " · " + totals.photoPct + "% with a photo";
    if (totals.mattelPct != null) digest += " · " + totals.mattelPct + "% official Mattel photos";
    digest += ". Lists from the Hot Wheels Wiki. Photos hotlink to Mattel Creations when the toy number matches, and to the wiki otherwise.";
    var countLabel = hits.length.toLocaleString("en-US") + (hits.length === 1 ? " car" : " cars");
    return "<h1>Catalog</h1>" +
      '<p class="digest">' + esc(digest) + "</p>" +
      '<div class="hw-tools">' +
      '<label class="field"><span>Search</span><input id="archive-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Name, toy #, or series" value="' + esc(state.archiveQuery) + '"></label>' +
      '<label class="field"><span>Year</span><select id="archive-year">' + options + "</select></label>" +
      '<div class="hw-lines" role="group" aria-label="Line">' + lineButtons + "</div>" +
      '<button type="button" class="hw-worth' + (state.archiveWorth ? " is-on" : "") + '" data-archive-worth aria-pressed="' + (state.archiveWorth ? "true" : "false") + '">Worth reselling</button>' +
      "</div>" +
      '<p class="hw-meta" id="archive-count">' + esc(countLabel) + "</p>" +
      '<div id="archive-list" class="hw-list">' + hwCardsHtml(page, hits.length) + "</div>";
  }

  function screenHtml() {
    if (bootError && state.tab !== "inventory" && state.tab !== "archive") {
      return stateCard("error", "Reseller hit a problem", bootError) + '<button class="solid" type="button" data-action="retry">Try again</button>';
    }
    if (state.view === "lanes") return renderLanes();
    if (state.view === "lane") return renderLane();
    if (state.view === "store") return renderStore();
    if (state.view === "catalog") return renderCatalogDetail();
    if (state.view === "market") return renderMarketDetail();
    if (state.view === "drop") return renderDrop();
    if (state.view === "inv") return renderInvDetail();
    if (state.view === "inv-form") return invForm(state.invId ? findInv(state.invId) : null);
    if (state.view === "golf") return renderGolfDetail();
    if (state.tab === "archive" && state.view === "root") return renderArchive();
    if (state.tab === "stores") return renderStores();
    if (state.tab === "drops") return renderDrops();
    if (state.tab === "inventory") return renderInventory();
    if (state.tab === "profit") return renderProfit();
    return renderHunt();
  }

  function paintDataStatus() {
    var live = document.getElementById("status-live");
    if (!live || !window.ResellerHuntDrops) return;
    live.textContent = window.ResellerHuntDrops.dataStatusLabel(state.dataPhase);
    live.classList.toggle("is-fresh", state.dataPhase === "fresh");
    live.classList.toggle("is-checking", state.dataPhase === "checking");
    live.classList.toggle("is-error", state.dataPhase === "error");
  }

  function render(opts) {
    opts = opts || {};
    var keepY = opts.keepScroll ? window.scrollY : null;
    screen.innerHTML = screenHtml();
    screen.setAttribute("aria-busy", state.refreshing ? "true" : "false");
    document.querySelectorAll(".tabbar [data-tab]").forEach(function (btn) {
      var on = btn.getAttribute("data-tab") === state.tab;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    var checked = localStorage.getItem("reseller-checked-at");
    var checkedLine = document.getElementById("checked-line");
    if (checkedLine) {
      var checkedParts = [];
      if (checked) checkedParts.push("Last refresh · " + formatWhen(checked));
      if (state.note) checkedParts.push(state.note);
      checkedLine.textContent = checkedParts.join(" · ");
    }
    paintDataStatus();
    if (keepY != null) window.scrollTo(0, keepY);
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
    var archiveQ = document.getElementById("archive-q");
    if (archiveQ && document.activeElement && document.activeElement.id === "archive-q") {
      archiveQ.focus();
      var aq = state.archiveQuery.length;
      archiveQ.setSelectionRange(aq, aq);
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
      marketId: state.marketId,
      marketBrand: state.marketBrand,
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
    render({ keepScroll: true });
    var dataPromise = loadHuntData(false);
    var bookPromise = hwBook.index ? reloadHwBook() : null;
    var results = [];
    for (var i = 0; i < R.PROVIDERS.length; i++) {
      var plan = R.refreshPlan(R.PROVIDERS[i]);
      if (plan.status === "attempt") results.push(await attemptDollarTree());
      else results.push(plan);
    }
    await dataPromise;
    if (bookPromise) await bookPromise;
    results.forEach(function (result) { R.applyRefreshResult(null, result); });
    var when = new Date().toISOString();
    localStorage.setItem("reseller-checked-at", when);
    writeJson("reseller-provider-log", { at: when, results: results });
    state.refreshing = false;
    state.note = "No prices changed. Store sites stay blocked from this page.";
    render({ keepScroll: true });
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
    img.referrerPolicy = "no-referrer";
    img.src = catalogSrc(src) || "assets/states/photo-needed.svg";
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

  document.addEventListener("error", function (event) {
    var img = event.target;
    if (!img || img.tagName !== "IMG" || img.getAttribute("data-fallback") === "1") return;
    var catalog = img.closest && img.closest(".hw-photo");
    if (!catalog && img.id !== "zoom-img") return;
    img.setAttribute("data-fallback", "1");
    img.removeAttribute("srcset");
    img.src = "assets/states/photo-needed.svg";
  }, true);

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
    var marketMore = event.target.closest("[data-market-more]");
    if (marketMore) {
      state.marketLimit += 24;
      render({ keepScroll: true });
      return;
    }
    var marketBrand = event.target.closest("[data-market-brand]");
    if (marketBrand) {
      state.marketBrand = marketBrand.getAttribute("data-market-brand");
      state.marketLimit = 24;
      render();
      return;
    }
    var marketBtn = event.target.closest("[data-market]");
    if (marketBtn) {
      push({ view: "market", marketId: marketBtn.getAttribute("data-market") });
      return;
    }
    var dropBtn = event.target.closest("[data-drop]");
    if (dropBtn) { push({ view: "drop", dropId: dropBtn.getAttribute("data-drop") }); return; }
    var golfBtn = event.target.closest("[data-golf]");
    if (golfBtn) { push({ view: "golf", itemId: golfBtn.getAttribute("data-golf") }); return; }
    var archiveLine = event.target.closest("[data-archive-line]");
    if (archiveLine) {
      state.archiveLine = archiveLine.getAttribute("data-archive-line");
      state.archiveLimit = 36;
      render();
      return;
    }
    if (event.target.closest("[data-archive-worth]")) {
      state.archiveWorth = !state.archiveWorth;
      state.archiveLimit = 36;
      render();
      return;
    }
    if (event.target.closest("[data-archive-more]")) {
      state.archiveLimit += 36;
      paintArchiveList();
      return;
    }
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
    if (actionName === "open-drops") { setTab("drops"); return; }
    if (actionName === "sources") { openSheet(sourcesHtml()); return; }
    if (actionName === "close-sheet") { closeSheet(); return; }
    if (actionName === "close-zoom") { closeZoom(); return; }
    if (actionName === "retry") { boot(); return; }
    if (actionName === "archive-retry") { reloadHwBook(); return; }
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
      return;
    }
    if (event.target.id === "archive-q") {
      state.archiveQuery = event.target.value;
      state.archiveLimit = 36;
      paintArchiveList();
    }
  });

  function paintArchiveList() {
    var list = document.getElementById("archive-list");
    var count = document.getElementById("archive-count");
    if (!list || !hwBook.index) return;
    var hits = filterHw();
    var page = hits.slice(0, state.archiveLimit);
    var needed = [];
    page.forEach(function (hit) {
      if (!hwBook.years[hit.y] && needed.indexOf(hit.y) === -1) needed.push(hit.y);
    });
    if (needed.length) loadHwYears(needed);
    if (count) count.textContent = hits.length.toLocaleString("en-US") + (hits.length === 1 ? " car" : " cars");
    list.innerHTML = hwCardsHtml(page, hits.length);
  }

  document.addEventListener("change", function (event) {
    if (event.target.id === "archive-year") {
      state.archiveYear = event.target.value;
      state.archiveLimit = 36;
      paintArchiveList();
      return;
    }
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

  var huntLoaded = false;
  var huntFlight = null;
  var quietUntil = 0;
  var returnsBound = false;

  function fetchFreshJson(url) {
    return fetch(url, { cache: "no-store", credentials: "omit" }).then(function (res) {
      if (!res.ok) throw new Error(url);
      var fromCache = res.headers.get("X-Reseller-From-Cache") === "1";
      return res.json().then(function (data) {
        return { data: data, fromCache: fromCache };
      });
    });
  }

  function screenIsQuiet() {
    if (sheet && sheet.open) return false;
    if (zoom && zoom.open) return false;
    var active = document.activeElement;
    if (!active) return true;
    var tag = active.tagName;
    return tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT";
  }

  function canRepaint() {
    if (!screenIsQuiet()) return false;
    if (state.tab === "profit") return false;
    if (state.view === "inv-form") return false;
    return true;
  }

  function applyHuntParts(parts) {
    catalog = parts[0].data;
    drops = parts[1].data;
    seedFile = parts[2].data;
    stores = parts[3].data;
    golf = parts[4].data;
    market = parts[5].data || { sections: [], generatedAt: "", formula: "" };
    var loaded = Inv.load(localStorage, seedFile);
    if (!loaded.ok) {
      bootError = "Saved inventory could not be read. It was not replaced. Clear site data only if you have a backup.";
      if (!invState) invState = { version: 2, items: [], tombstones: [], migratedBought: true };
      return;
    }
    bootError = "";
    invState = loaded.state;
    if (seedFile && seedFile.count && Inv.visible(invState).length === 0) {
      bootError = "The 78-package book did not load.";
    }
  }

  function loadHuntData(isBoot) {
    if (huntFlight) return huntFlight;
    state.dataPhase = "checking";
    if (isBoot) {
      paintDataStatus();
      screen.innerHTML = stateCard("loading", "Loading", "Opening the hunt.");
    } else {
      paintDataStatus();
    }
    huntFlight = Promise.all([
      "data/catalog.json",
      "data/drops.json",
      "data/inventory-seed.json",
      "data/stores.json",
      "data/golf.json",
      "data/market.json",
    ].map(fetchFreshJson)).then(function (parts) {
      applyHuntParts(parts);
      huntLoaded = true;
      state.dataPhase = parts.some(function (part) { return part.fromCache; }) ? "error" : "fresh";
      if (isBoot || canRepaint()) render({ keepScroll: !isBoot });
      else paintDataStatus();
    }).catch(function () {
      state.dataPhase = "error";
      if (!huntLoaded) {
        bootError = navigator.onLine
          ? "The app files did not load."
          : "Offline, and this phone does not have the app shell cached yet.";
        screen.innerHTML = stateCard(navigator.onLine ? "error" : "offline", navigator.onLine ? "Could not open" : "Offline", bootError);
        paintDataStatus();
        return;
      }
      if (canRepaint()) render({ keepScroll: true });
      else paintDataStatus();
    }).then(function () {
      huntFlight = null;
    });
    return huntFlight;
  }

  function onPageReturn() {
    if (!window.ResellerHuntDrops.shouldRefreshOnReturn(Date.now(), quietUntil, document.visibilityState)) return;
    quietUntil = Date.now() + 1200;
    loadHuntData(false);
  }

  function bindReturns() {
    if (returnsBound) return;
    returnsBound = true;
    document.addEventListener("visibilitychange", onPageReturn);
    window.addEventListener("pageshow", onPageReturn);
    window.addEventListener("focus", onPageReturn);
  }

  function watchShellUpdates() {
    if (!("serviceWorker" in navigator)) return;
    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });
    navigator.serviceWorker.register("./sw.js").then(function (reg) {
      function offer() {
        var banner = document.getElementById("update-banner");
        if (banner) banner.hidden = false;
      }
      if (reg.waiting && navigator.serviceWorker.controller) offer();
      reg.addEventListener("updatefound", function () {
        var worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", function () {
          if (worker.state === "installed" && navigator.serviceWorker.controller) offer();
        });
      });
      function poke() {
        if (document.visibilityState === "hidden") return;
        reg.update().catch(function () {});
      }
      document.addEventListener("visibilitychange", poke);
      window.addEventListener("pageshow", poke);
      window.addEventListener("focus", poke);
      var button = document.getElementById("apply-update");
      if (button) {
        button.addEventListener("click", function () {
          if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
          else window.location.reload();
        });
      }
    }).catch(function () {});
  }

  function boot() {
    bootError = "";
    quietUntil = Date.now() + 1200;
    bindReturns();
    loadHuntData(true);
  }

  watchShellUpdates();
  boot();
})();
