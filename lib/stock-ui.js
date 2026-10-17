/* Hunt Inventory tracker + Show Mode screens. Talks to the data layer (HuntStockData) through a Store,
 * and to the app shell through window.HuntApp (go, render, scanFor, data, bookItems). */
(function () {
  var D = window.HuntStockData;
  var P = window.HuntShowPricing;
  if (!D || !P) return;

  var adapter = D.idbAdapter() || D.localAdapter(window.localStorage);
  var store = D.createStore(adapter);
  var comps = [];
  var compIndex = {};
  var compsReady = false;
  var loading = null;
  var ui = {
    lane: "all",
    status: "active",
    q: "",
    showQ: "",
    pay: readPref("hunt-show-pay", "cash"),
    draft: null,
    draftFor: "",
    pickQ: "",
    flash: "",
    flashKind: "",
    customFor: "",
    lastSale: null,
    res: null,
  };

  function readPref(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch (err) { return fallback; }
  }
  function writePref(key, value) {
    try { localStorage.setItem(key, value); } catch (err) {}
  }

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function money(n, plain) {
    var v = Number(n);
    if (n == null || !Number.isFinite(v)) return "—";
    var s = Math.abs(v) >= 1000 ? Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : Math.abs(v).toFixed(2).replace(/\.00$/, plain ? "" : ".00");
    return (v < 0 ? "-$" : "$") + s;
  }

  function app() { return window.HuntApp || {}; }
  function rerender() { if (app().render) app().render(); }
  function go(seg, sub) { if (app().go) app().go({ tab: "stuff", view: "root", stuffSegment: seg, stockSub: sub || "" }); }

  function flash(text, kind) {
    ui.flash = text;
    ui.flashKind = kind || "ok";
  }

  /* ---------- loading ---------- */
  function ensure() {
    if (loading) return loading;
    loading = Promise.all([
      store.load().catch(function () { return []; }),
      loadComps(),
    ]).then(function () { rerender(); });
    return loading;
  }

  function loadComps() {
    var data = app().data ? app().data() : null;
    var live = data && data.market && (data.market.sections || []).length ? P.buildComps(data) : null;
    if (live && live.length) {
      setComps(live);
      store.setMeta("comps", { at: new Date().toISOString(), rows: live }).catch(function () {});
      return Promise.resolve();
    }
    return store.getMeta("comps").then(function (saved) {
      if (saved && saved.rows) setComps(saved.rows);
    }).catch(function () {});
  }

  function setComps(rows) {
    comps = rows || [];
    compIndex = {};
    comps.forEach(function (c) { compIndex[c.id] = c; });
    compsReady = comps.length > 0;
  }

  function refreshComps() {
    var data = app().data ? app().data() : null;
    if (data && data.market && (data.market.sections || []).length) {
      var live = P.buildComps(data);
      if (live.length && live.length !== comps.length) {
        setComps(live);
        store.setMeta("comps", { at: new Date().toISOString(), rows: live }).catch(function () {});
      }
    }
  }

  /* ---------- value ---------- */
  function compFor(item) {
    return item && item.compId ? compIndex[item.compId] || null : null;
  }

  function valueOf(item) {
    var c = compFor(item);
    if (c && c.value != null) return { value: c.value, kind: "comp" };
    if (item.myEstimate != null) return { value: item.myEstimate, kind: "mine" };
    return null;
  }

  function pricingFor(item) {
    var c = compFor(item);
    var basis = c && c.value != null ? c : item.myEstimate != null ? { value: item.myEstimate, source: "Your own estimate, not a comp", date: "", url: "" } : null;
    var s = P.suggest(basis, D.unitCost(item), { lane: item.lane, variant: item.variant });
    s.mine = !(c && c.value != null) && item.myEstimate != null;
    if (s.mine) s.hasComp = false;
    return s;
  }

  function photoSrc(item) {
    if (item.photo) return item.photo;
    if (item.imageLocal) return item.imageLocal;
    if (item.imageUrl) return item.imageUrl;
    var c = compFor(item);
    return c && c.photo ? c.photo : "";
  }

  function thumb(item, size) {
    var src = photoSrc(item);
    var lane = item.lane || "other";
    if (src) return '<span class="stk-thumb' + (size ? " is-" + size : "") + '"><img src="' + esc(src) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>';
    return '<span class="stk-thumb is-empty' + (size ? " is-" + size : "") + '" data-lane="' + esc(lane) + '"><b>' + esc(D.label(D.LANES, lane).slice(0, 2).toUpperCase()) + "</b></span>";
  }

  function variantText(item) {
    var v = item.variant ? D.label(D.VARIANTS, item.variant) : "";
    if (item.variant === "graded" && item.grade) v += " " + item.grade;
    return v;
  }

  function statusPill(item) {
    return '<span class="stk-pill is-' + esc(item.status) + '">' + esc(D.label(D.STATUSES, item.status)) + "</span>";
  }

  function crumbs(parts) {
    return '<nav class="crumbs" aria-label="Breadcrumb">' + parts.map(function (part, i) {
      var last = i === parts.length - 1;
      var node = part.href && !last ? '<a href="' + esc(part.href) + '">' + esc(part.label) + "</a>" : "<span>" + esc(part.label) + "</span>";
      return (i ? '<span class="crumb-sep" aria-hidden="true">/</span>' : "") + node;
    }).join("") + "</nav>";
  }

  function flashHtml() {
    if (!ui.flash) return "";
    var html = '<p class="stk-flash is-' + esc(ui.flashKind) + '" role="status">' + esc(ui.flash) + (ui.lastSale && ui.flashKind === "sale" ? ' <button type="button" class="stk-link" data-stk="undo-sale">Undo</button>' : "") + "</p>";
    ui.flash = "";
    return html;
  }

  function loadingHtml(title) {
    ensure();
    return "<h1>" + esc(title) + '</h1><div class="skeleton-list" aria-busy="true"><div class="skeleton-card"></div><div class="skeleton-card"></div></div>';
  }

  /* ---------- Tracker list ---------- */
  function filtered() {
    var q = P.fold(ui.q);
    return store.all().filter(function (item) {
      if (ui.lane !== "all" && item.lane !== ui.lane) return false;
      if (ui.status === "active" && item.status === "sold") return false;
      if (ui.status !== "active" && ui.status !== "all" && item.status !== ui.status) return false;
      if (!q) return true;
      return P.fold([item.name, item.bin, item.code, item.store, item.notes, variantText(item)].join(" ")).indexOf(q) !== -1;
    });
  }

  function itemCard(item) {
    var v = valueOf(item);
    var uc = D.unitCost(item);
    var meta = [variantText(item), item.condition, item.bin ? "Bin " + item.bin : ""].filter(Boolean).join(" · ");
    return '<article class="stk-card"><button class="stk-open" type="button" data-stk="open" data-id="' + esc(item.id) + '">' +
      thumb(item) +
      '<span class="stk-copy"><span class="stk-top"><span class="peg-name">' + esc(item.name) + "</span>" + statusPill(item) + "</span>" +
      (meta ? '<span class="peg-meta">' + esc(meta) + "</span>" : "") +
      '<span class="stk-nums"><span><em>Qty</em><b>' + esc(String(item.qty)) + "</b></span>" +
      "<span><em>Cost ea</em><b>" + money(uc) + "</b></span>" +
      "<span><em>" + (v && v.kind === "mine" ? "Your est" : "Comp") + "</em><b>" + (v ? money(v.value) : "None") + "</b></span></span>" +
      "</span></button></article>";
  }

  function listHtml() {
    var rows = filtered();
    if (!store.all().length) {
      return '<div class="state-card"><img src="assets/states/scene-empty.svg" alt=""><strong>No stock yet</strong><p>Add your first item by scan, catalog pick, or by hand. Everything saves on this phone, offline too.</p></div>';
    }
    if (!rows.length) return '<div class="state-card"><img src="assets/states/scene-no-results.svg" alt=""><strong>Nothing in this filter</strong><p>Your stock is still saved.</p></div>';
    return rows.map(itemCard).join("");
  }

  function totalsHtml() {
    var t = D.totals(store.all(), valueOf);
    return '<div class="stk-stats" id="stk-totals">' +
      stat("Units on hand", String(t.units), t.skus + " items") +
      stat("Cost basis", money(t.costBasis), t.costUnknown ? t.costUnknown + " with no cost" : "Incl. sales tax") +
      stat("Est. value", money(t.estValue), t.unvalued ? t.unvalued + " units with no comp" : "All units valued") +
      stat("Realized profit", money(t.realized), t.salesCount + " sold · " + money(t.gross) + " gross") +
      "</div>";
  }

  function stat(label, value, note) {
    return '<div class="stk-stat"><span>' + esc(label) + "</span><b>" + esc(value) + "</b><em>" + esc(note) + "</em></div>";
  }

  function renderTracker() {
    if (!store.loaded()) return loadingHtml("Inventory tracker");
    refreshComps();
    var sub = (app().stockSub ? app().stockSub() : "") || "";
    var parts = sub.split("/");
    if (parts[0] === "add") return formHtml(null);
    if (parts[0] === "edit" && parts[1]) return formHtml(store.get(parts[1]));
    if (parts[0] === "item" && parts[1]) return detailHtml(store.get(parts[1]));
    var lanes = [["all", "All"]].concat(D.LANES);
    var statuses = [["active", "Active"]].concat(D.STATUSES).concat([["all", "All"]]);
    return "<h1>Inventory tracker</h1>" + flashHtml() +
      '<p class="fine">Qty, cost with ' + esc(String(D.DEFAULT_TAX)) + "% St. Louis tax, bins, and every sale. Saved on this phone; works offline.</p>" +
      totalsHtml() +
      '<div class="stk-actions">' +
      '<button class="solid" type="button" data-stk="add">Add item</button>' +
      '<button class="solid" type="button" data-stk="scan-add">Scan to add</button>' +
      '<button class="ghost" type="button" data-stk="go-show">Show Mode</button>' +
      "</div>" +
      '<div class="chips category-row" role="group" aria-label="Lane">' + lanes.map(function (p) {
        return '<button class="chip' + (ui.lane === p[0] ? " is-on" : "") + '" type="button" data-stk="lane" data-v="' + esc(p[0]) + '">' + esc(p[1]) + "</button>";
      }).join("") + "</div>" +
      '<div class="chips category-row" role="group" aria-label="Status">' + statuses.map(function (p) {
        return '<button class="chip' + (ui.status === p[0] ? " is-on" : "") + '" type="button" data-stk="status" data-v="' + esc(p[0]) + '">' + esc(p[1]) + "</button>";
      }).join("") + "</div>" +
      '<label class="search"><span>Search stock</span><input id="stk-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Name, bin, code" value="' + esc(ui.q) + '"></label>' +
      '<div class="stk-list" id="stk-list">' + listHtml() + "</div>" +
      '<details class="leave stk-data"><summary>Import, export, Shopify</summary><div class="stk-actions">' +
      '<button class="ghost" type="button" data-stk="export-csv">Export CSV</button>' +
      '<button class="ghost" type="button" data-stk="import-csv">Import CSV</button>' +
      '<button class="ghost" type="button" data-stk="export-shopify">Shopify product CSV</button>' +
      '<button class="ghost" type="button" data-stk="import-book">Copy in my Hunt book</button>' +
      '</div><p class="fine">The Shopify file uses Shopify\'s product CSV columns (Handle, Title, Vendor, Product Type, Tags, Variant SKU, Variant Price, Variant Inventory Qty, Cost per item, Image Src) and imports as drafts. Nothing is sent to Shopify from here. Price is your list price, else the verified comp, else blank.</p>' +
      '<input type="file" id="stk-csv-file" accept=".csv,text/csv" hidden></details>';
  }

  /* ---------- Detail ---------- */
  function priceGrid(s) {
    var head = s.hasComp
      ? '<p class="stk-src">Market ' + money(s.market) + " · " + esc(s.source || "Source on file") + (s.date ? " · " + esc(s.date) : "") + (s.url ? ' · <a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">source</a>' : "") + "</p>"
      : '<p class="stk-src is-none">No verified comp' + (s.mine ? " · using your estimate " + money(s.market) : "") + "</p>";
    var cells = [
      ["Show ticket", s.ticket != null ? money(s.ticket, true) : "—", "is-hot"],
      ["Floor", s.floor != null ? money(s.floor, true) : "—", ""],
      ["eBay net", s.ebayNet != null ? money(s.ebayNet) : "—", ""],
      ["Lot", s.lot ? s.lot.qty + " for " + money(s.lot.price, true) : "—", ""],
    ];
    return head + '<div class="stk-price">' + cells.map(function (c) {
      return '<span class="' + c[2] + '"><em>' + esc(c[0]) + "</em><b>" + esc(c[1]) + "</b></span>";
    }).join("") + "</div>" +
      (s.lot && s.lot.basis === "house" ? '<p class="fine">Lot is the commons-bin house rule, not a comp.</p>' : "") +
      s.notes.filter(function (n) { return !/^No verified comp/.test(n); }).map(function (n) { return '<p class="fine">' + esc(n) + "</p>"; }).join("");
  }

  function detailHtml(item) {
    if (!item) return '<div class="state-card"><img src="assets/states/scene-error.svg" alt=""><strong>Missing item</strong><p>That item is not in your stock.</p></div>';
    var s = pricingFor(item);
    var uc = D.unitCost(item);
    var facts = [
      ["Lane", D.label(D.LANES, item.lane)],
      ["Variant", variantText(item) || "Regular"],
      ["Qty", String(item.qty)],
      ["Cost paid", money(item.cost) + " + " + item.taxPct + "% tax = " + money(uc) + " each"],
      ["Bought", [item.purchaseDate, item.store].filter(Boolean).join(" · ") || "—"],
      ["Condition", item.condition || "—"],
      ["Bin", item.bin || "—"],
      ["Code", item.code || "—"],
      ["Brand", item.brand || "—"],
      ["MSRP", item.msrp != null ? money(item.msrp) : "—"],
      ["Details from", item.lookupSource ? item.lookupSource + (item.lookupUrl ? " · " + item.lookupUrl : "") : "—"],
      ["Description", item.description || "—"],
      ["List price", item.listPrice != null ? money(item.listPrice) : "—"],
      ["Notes", item.notes || "—"],
    ];
    var sales = item.sales.slice().reverse().map(function (sale) {
      var p = D.saleProfit(sale);
      return '<li><span>' + esc(sale.date) + " · " + esc(D.label(D.CHANNELS, sale.channel)) + (sale.pay ? " · " + esc(sale.pay) : "") + "</span><b>" + esc(sale.qty + " × " + money(sale.price)) + "</b><em>" + (p == null ? "Profit unknown" : "Profit " + money(p)) + '</em><button type="button" class="stk-link" data-stk="undo-this" data-id="' + esc(item.id) + '" data-sale="' + esc(sale.id) + '">Undo</button></li>';
    }).join("");
    return crumbs([{ label: "My Stuff", href: "#/stuff/tracker" }, { label: "Inventory tracker", href: "#/stuff/tracker" }, { label: item.name }]) +
      flashHtml() +
      '<div class="stk-hero">' + thumb(item, "hero") + '<div class="stk-hero-copy"><h1>' + esc(item.name) + "</h1><p>" + statusPill(item) + (variantText(item) ? ' <span class="stk-pill">' + esc(variantText(item)) + "</span>" : "") + "</p></div></div>" +
      '<section class="tool"><p class="kicker">Show pricing</p>' + priceGrid(s) + "</section>" +
      '<section class="tool stk-sell"><p class="kicker">Record a sale</p>' +
      (item.qty > 0
        ? '<form id="stk-sale-form" data-id="' + esc(item.id) + '" class="stk-sale-grid">' +
          '<label class="field"><span>Price each</span><input id="stk-sale-price" type="number" inputmode="decimal" step="0.01" min="0" value="' + esc(s.ticket != null ? s.ticket : "") + '" required></label>' +
          '<label class="field"><span>Qty</span><input id="stk-sale-qty" type="number" inputmode="numeric" min="1" max="' + esc(item.qty) + '" value="1"></label>' +
          '<label class="field"><span>Channel</span><select id="stk-sale-channel">' + D.CHANNELS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === (item.status === "at-show" ? "show" : "ebay") ? " selected" : "") + ">" + esc(c[1]) + "</option>"; }).join("") + "</select></label>" +
          '<label class="field"><span>Paid by</span><select id="stk-sale-pay"><option value="cash">Cash</option><option value="card">Card</option><option value="">Other</option></select></label>' +
          '<label class="field"><span>Date</span><input id="stk-sale-date" type="date" value="' + esc(D.today()) + '"></label>' +
          '<button class="solid full" type="submit">Save sale</button><p class="fine">eBay sales book at sold × 0.87 − $5. Show and local sales book at full price.</p></form>'
        : '<p class="fine">None left. Undo a sale below to put one back.</p>') +
      "</section>" +
      '<section class="tool"><p class="kicker">Details</p><dl class="stk-facts">' + facts.map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("") + "</dl></section>" +
      (sales ? '<section class="tool"><p class="kicker">Sales</p><ul class="stk-sales">' + sales + "</ul></section>" : "") +
      '<div class="stk-actions"><button class="solid" type="button" data-stk="edit" data-id="' + esc(item.id) + '">Edit</button>' +
      '<button class="ghost" type="button" data-stk="set-status" data-id="' + esc(item.id) + '" data-v="at-show">Take to show</button>' +
      '<button class="ghost" type="button" data-stk="set-status" data-id="' + esc(item.id) + '" data-v="listed">Mark listed</button>' +
      '<button class="ghost" type="button" data-stk="set-status" data-id="' + esc(item.id) + '" data-v="held-grading">Hold for grading</button>' +
      '<button class="danger" type="button" data-stk="delete" data-id="' + esc(item.id) + '">Delete</button></div>';
  }

  /* ---------- Form ---------- */
  function draftFor(item) {
    var key = item ? item.id : "new";
    if (ui.draft && ui.draftFor === key) return ui.draft;
    ui.draftFor = key;
    ui.pickQ = "";
    ui.draft = item ? JSON.parse(JSON.stringify(item)) : D.normalize({ purchaseDate: D.today(), qty: 1, status: "in-stock" });
    if (!item) ui.draft.id = "";
    return ui.draft;
  }

  function opt(list, current) {
    return list.map(function (p) { return '<option value="' + esc(p[0]) + '"' + (p[0] === current ? " selected" : "") + ">" + esc(p[1]) + "</option>"; }).join("");
  }

  function input(label, id, value, type, extra) {
    return '<label class="field"><span>' + esc(label) + '</span><input id="' + id + '" type="' + (type || "text") + '"' + (extra || "") + ' value="' + esc(value == null ? "" : value) + '"></label>';
  }

  function formHtml(item) {
    var d = draftFor(item);
    var c = compFor(d);
    var title = item ? "Edit item" : "Add item";
    return crumbs([{ label: "My Stuff", href: "#/stuff/tracker" }, { label: "Inventory tracker", href: "#/stuff/tracker" }, { label: title }]) +
      "<h1>" + title + "</h1>" + flashHtml() +
      '<section class="tool stk-pick"><p class="kicker">Fill from Hunt</p>' +
      '<div class="stk-actions"><button class="solid" type="button" data-stk="scan-fill">Scan barcode or Mattel code</button>' +
      (d.code && !(ui.res && ui.res.ctx === "form") ? '<button class="ghost" type="button" data-stk="lookup-code">Look up ' + esc(d.code) + "</button>" : "") + "</div>" +
      (ui.res && ui.res.ctx === "form" ? '<div id="stk-res" class="upc-res">' + resHtml(ui.res) + "</div>" : "") +
      '<label class="search"><span>Or pick from the catalog</span><input id="stk-pick-q" type="search" autocomplete="off" placeholder="Ram 1500, 30th Celebration ETB" value="' + esc(ui.pickQ) + '"></label>' +
      '<div id="stk-pick-hits" class="stk-pick-hits">' + pickHits() + "</div>" +
      (c ? '<p class="fine">Linked comp: ' + esc(c.name) + (c.value != null ? " · " + money(c.value) + " · " + esc(c.source) + (c.date ? " · " + esc(c.date) : "") : " · No verified comp") + ' <button type="button" class="stk-link" data-stk="unlink">Unlink</button></p>' : "") +
      "</section>" +
      '<form id="stk-form" class="tool stk-form" novalidate>' +
      '<div class="stk-photo-row">' + thumb(d, "form") + '<label class="ghost stk-file">Add photo<input id="stk-photo" type="file" accept="image/*"></label>' + (d.photo ? '<button class="stk-link" type="button" data-stk="clear-photo">Remove photo</button>' : "") + "</div>" +
      input("Name", "stk-name", d.name, "text", ' required autocomplete="off"') +
      '<div class="stk-grid2">' +
      '<label class="field"><span>Lane</span><select id="stk-lane">' + opt(D.LANES, d.lane) + "</select></label>" +
      '<label class="field"><span>Variant</span><select id="stk-variant">' + opt(D.VARIANTS, d.variant) + "</select></label>" +
      input("Grade (graded only)", "stk-grade", d.grade, "text", ' placeholder="PSA 10"') +
      input("Qty", "stk-qty", d.qty, "number", ' inputmode="numeric" min="0" step="1"') +
      input("Cost paid each", "stk-cost", d.cost, "number", ' inputmode="decimal" step="0.01" min="0"') +
      input("Sales tax %", "stk-tax", d.taxPct, "number", ' inputmode="decimal" step="0.01" min="0"') +
      input("Purchase date", "stk-date", d.purchaseDate, "date") +
      input("Store", "stk-store", d.store, "text", ' list="stk-stores" placeholder="Target, Walmart"') +
      '<label class="field"><span>Condition</span><select id="stk-condition"><option value=""></option>' + D.CONDITIONS.map(function (x) { return "<option" + (x === d.condition ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select></label>" +
      input("Location / bin", "stk-bin", d.bin, "text", ' placeholder="A3"') +
      '<label class="field"><span>Status</span><select id="stk-status">' + opt(D.STATUSES, d.status) + "</select></label>" +
      input("Barcode / code", "stk-code", d.code, "text", ' autocapitalize="characters"') +
      input("Your list price", "stk-list", d.listPrice, "number", ' inputmode="decimal" step="0.01" min="0"') +
      input("Your estimate (not a comp)", "stk-est", d.myEstimate, "number", ' inputmode="decimal" step="0.01" min="0"') +
      "</div>" +
      '<datalist id="stk-stores"><option>Target</option><option>Walmart</option><option>Walgreens</option><option>Dollar General</option><option>Kroger</option><option>Goodwill</option><option>Card show</option><option>Mattel Creations</option></datalist>' +
      '<label class="field"><span>Notes</span><textarea id="stk-notes">' + esc(d.notes) + "</textarea></label>" +
      '<button class="solid full" type="submit">' + (item ? "Save" : "Add to stock") + "</button>" +
      '<button class="ghost full" type="button" data-stk="cancel">Cancel</button></form>';
  }

  function pickHits() {
    if (!ui.pickQ.trim()) return "";
    if (!compsReady) return '<p class="fine">Prices are still loading.</p>';
    var hits = P.search(comps, ui.pickQ, 8);
    if (!hits.length) return '<p class="fine">No catalog match. Type it in by hand below.</p>';
    return hits.map(function (c) {
      return '<button type="button" class="stk-hit" data-stk="pick" data-comp="' + esc(c.id) + '"><b>' + esc(c.name) + "</b><span>" + esc(c.section || "") + " · " + (c.value != null ? money(c.value) + " " + esc(c.kind === "guide" ? "guide" : "sold") : "No verified comp") + "</span></button>";
    }).join("");
  }

  function readForm() {
    var d = ui.draft || {};
    function v(id) { var el = document.getElementById(id); return el ? el.value : undefined; }
    var map = { name: "stk-name", lane: "stk-lane", variant: "stk-variant", grade: "stk-grade", qty: "stk-qty", cost: "stk-cost", taxPct: "stk-tax", purchaseDate: "stk-date", store: "stk-store", condition: "stk-condition", bin: "stk-bin", status: "stk-status", code: "stk-code", listPrice: "stk-list", myEstimate: "stk-est", notes: "stk-notes" };
    Object.keys(map).forEach(function (k) { var val = v(map[k]); if (val !== undefined) d[k] = val; });
    ui.draft = d;
    return d;
  }

  function applyComp(c) {
    var d = readForm();
    d.compId = c.id;
    if (!d.name) d.name = c.name;
    if (!d.lane || d.lane === "other") d.lane = c.lane || "other";
    if (!d.photo && c.photo) d.photo = c.photo;
    if (!d.code && c.codes && c.codes.length) d.code = c.codes[0];
    if (/super|sth/i.test(c.name) && !d.variant) d.variant = "sth";
    else if (/chase/i.test(c.name) && !d.variant) d.variant = "chase";
    else if (/\bTH\b|treasure hunt/i.test(c.name) && !d.variant) d.variant = "th";
    ui.pickQ = "";
  }

  function saveForm() {
    var d = readForm();
    if (!String(d.name || "").trim()) {
      flash("Give the item a name.", "error");
      rerender();
      return;
    }
    var isNew = !d.id;
    store.save(d).then(function (saved) {
      learnFrom(saved);
      ui.draft = null;
      ui.draftFor = "";
      ui.res = null;
      flash(isNew ? "Added to stock." : "Saved.");
      go("tracker", "item/" + saved.id);
    }).catch(function () {
      flash("Could not save on this phone. Storage may be full.", "error");
      rerender();
    });
  }

  function downscale(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function () {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          var max = 720;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Show Mode ---------- */
  function showStock() {
    var q = P.fold(ui.showQ);
    var code = String(ui.showQ || "").toUpperCase().replace(/[\s-]/g, "");
    var rows = store.all().filter(function (item) {
      if (item.qty <= 0) return false;
      if (!q) return item.status === "at-show" || item.status === "in-stock";
      return (code && item.code && item.code.toUpperCase() === code) || P.fold([item.name, item.bin, item.code, variantText(item)].join(" ")).indexOf(q) !== -1;
    });
    rows.sort(function (a, b) {
      var sa = a.status === "at-show" ? 0 : 1;
      var sb = b.status === "at-show" ? 0 : 1;
      return sa - sb || a.name.localeCompare(b.name);
    });
    return rows.slice(0, 40);
  }

  function showCard(item) {
    var s = pricingFor(item);
    var custom = ui.customFor === item.id;
    var meta = [variantText(item), item.bin ? "Bin " + item.bin : "", "Qty " + item.qty, D.unitCost(item) != null ? "Cost " + money(D.unitCost(item)) : ""].filter(Boolean).join(" · ");
    return '<article class="stk-card stk-show-card" id="show-' + esc(item.id) + '">' +
      '<div class="stk-show-head">' + thumb(item) + '<div class="stk-copy"><span class="peg-name">' + esc(item.name) + '</span><span class="peg-meta">' + esc(meta) + "</span></div></div>" +
      '<div class="stk-show-body">' + priceGrid(s) +
      '<div class="stk-sell-row">' +
      (s.ticket != null ? '<button class="solid" type="button" data-stk="sell" data-id="' + esc(item.id) + '" data-price="' + esc(s.ticket) + '">Sold ' + money(s.ticket, true) + "</button>" : "") +
      (s.floor != null && s.floor !== s.ticket ? '<button class="ghost" type="button" data-stk="sell" data-id="' + esc(item.id) + '" data-price="' + esc(s.floor) + '">Sold ' + money(s.floor, true) + " floor</button>" : "") +
      (s.lot && item.qty >= s.lot.qty ? '<button class="ghost" type="button" data-stk="sell-lot" data-id="' + esc(item.id) + '" data-qty="' + s.lot.qty + '" data-price="' + esc(s.lot.price) + '">Sold ' + s.lot.qty + " for " + money(s.lot.price, true) + "</button>" : "") +
      '<button class="ghost" type="button" data-stk="custom" data-id="' + esc(item.id) + '">Other price</button>' +
      "</div>" +
      (custom ? '<form class="stk-custom" data-id="' + esc(item.id) + '"><label class="field"><span>Sold for</span><input id="stk-custom-price" type="number" inputmode="decimal" step="0.01" min="0" autofocus></label><button class="solid" type="submit">Save</button></form>' : "") +
      "</div></article>";
  }

  function compCard(c) {
    var s = P.suggest(c.value != null ? c : null, null, { lane: c.lane });
    return '<article class="stk-card stk-show-card is-comp"><div class="stk-show-head">' +
      (c.photo ? '<span class="stk-thumb"><img src="' + esc(c.photo) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></span>' : '<span class="stk-thumb is-empty"><b>' + esc((c.section || "?").slice(0, 2).toUpperCase()) + "</b></span>") +
      '<div class="stk-copy"><span class="peg-name">' + esc(c.name) + '</span><span class="peg-meta">' + esc(c.section || "") + " · not in your stock</span></div></div>" +
      '<div class="stk-show-body">' + priceGrid(s) +
      '<div class="stk-sell-row"><button class="ghost" type="button" data-stk="add-from-comp" data-comp="' + esc(c.id) + '">Add to stock</button></div></div></article>';
  }

  function summaryHtml(day, label) {
    var sum = D.dailySummary(store.all(), day, "show");
    return '<div class="stk-stats is-show">' +
      stat(label || "Today at the show", money(sum.gross), sum.count + " sold") +
      stat("Cash", money(sum.cash), "") +
      stat("Card", money(sum.card), "") +
      stat("Profit", money(sum.profit), sum.profitUnknown ? sum.profitUnknown + " sales with no cost" : "After cost + tax") +
      "</div>";
  }

  function showResultsHtml() {
    var stock = showStock();
    var html = "";
    html += '<p class="kicker">' + (ui.showQ ? "Your stock" : "On your table") + "</p>";
    html += stock.length ? stock.map(showCard).join("") : '<p class="fine">' + (ui.showQ ? "Not in your stock." : 'Nothing marked "At show" or in stock yet. Add stock in the tracker.') + "</p>";
    if (ui.res && ui.res.ctx === "show" && codeEq(ui.res.code, ui.showQ)) {
      html += '<div id="stk-res" class="upc-res">' + resHtml(ui.res) + "</div>";
    }
    if (ui.showQ.trim()) {
      var ids = {};
      stock.forEach(function (i) { if (i.compId) ids[i.compId] = true; });
      var hits = P.search(comps, ui.showQ, 8).filter(function (c) { return !ids[c.id]; });
      html += '<p class="kicker">Price check</p>';
      html += hits.length ? hits.map(compCard).join("") : '<p class="fine">No verified comp in Hunt for “' + esc(ui.showQ) + '”. Check a live sold search before you name a price.</p>';
    }
    return html;
  }

  function renderShow() {
    if (!store.loaded()) return loadingHtml("Show Mode");
    refreshComps();
    var days = D.showDays(store.all()).filter(function (d) { return d !== D.today(); }).slice(0, 8);
    return '<div class="stk-show"><h1>Show Mode</h1>' + flashHtml() +
      summaryHtml(D.today()) +
      '<div class="stk-pay" role="group" aria-label="Paid by"><span>Paid by</span>' +
      ["cash", "card"].map(function (p) { return '<button type="button" class="chip' + (ui.pay === p ? " is-on" : "") + '" data-stk="pay" data-v="' + p + '" aria-pressed="' + (ui.pay === p) + '">' + (p === "cash" ? "Cash" : "Card") + "</button>"; }).join("") +
      (ui.lastSale ? '<button type="button" class="stk-link" data-stk="undo-sale">Undo last sale</button>' : "") +
      "</div>" +
      '<div class="stk-show-search"><label class="search"><span>Search or type a code</span><input id="stk-show-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Name, bin, UPC" value="' + esc(ui.showQ) + '"></label>' +
      '<button class="solid" type="button" data-stk="scan-show" aria-label="Scan a barcode">Scan</button></div>' +
      (compsReady ? "" : '<p class="fine">Comps are not cached on this phone yet. Open Show Mode once online.</p>') +
      '<div class="stk-list" id="stk-show-results">' + showResultsHtml() + "</div>" +
      '<p class="fine">Ticket is about 12% under market (no fees at a table), rounded. Floor never drops below your cost + 15% or the eBay net (sold × 0.87 − $5). Prices are Hunt\'s comps only.</p>' +
      (days.length ? '<details class="leave"><summary>Past shows (' + days.length + ")</summary>" + days.map(function (d) { return summaryHtml(d, d); }).join("") + "</details>" : "") +
      '<div class="stk-actions"><button class="ghost" type="button" data-stk="go-tracker">Inventory tracker</button></div></div>';
  }

  function sell(id, price, qty) {
    var item = store.get(id);
    if (!item) return;
    var res = D.recordSale(item, { price: price, qty: qty || 1, channel: "show", pay: ui.pay, date: D.today() });
    if (!res.ok) { flash(res.error, "error"); rerender(); return; }
    ui.lastSale = { itemId: item.id, saleId: res.sale.id };
    ui.customFor = "";
    store.save(item).then(function () {
      flash("Sold " + (qty > 1 ? qty + " for " + money(price * qty, true) : money(price)) + " · " + ui.pay + ". " + item.qty + " left.", "sale");
      rerender();
    });
  }

  function undo(itemId, saleId) {
    var item = store.get(itemId);
    if (!item || !D.undoSale(item, saleId)) return;
    if (ui.lastSale && ui.lastSale.saleId === saleId) ui.lastSale = null;
    store.save(item).then(function () { flash("Sale undone."); rerender(); });
  }

  /* ---------- files ---------- */
  function download(name, text) {
    var blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function shopifyPrice(item) {
    var c = compFor(item);
    return c && c.value != null ? P.niceDown(c.value) : null;
  }

  function importBook() {
    var book = app().bookItems ? app().bookItems() : [];
    var have = {};
    store.all().forEach(function (i) { have[i.id] = true; });
    var laneMap = { Cars: "hot-wheels", "Pokémon": "pokemon", Sneakers: "sneakers" };
    var rows = [];
    book.forEach(function (b) {
      var id = "book-" + b.id;
      if (have[id] || !b.name) return;
      var sold = b.status === "Sold";
      var hist = Array.isArray(b.soldHistory) ? b.soldHistory : [];
      var sales = sold ? hist.filter(function (h) { return h && h.price != null; }).map(function (h) { return { price: h.price, channel: "other", date: String(h.date || "").slice(0, 10) || D.today(), unitCost: b.cost }; }) : [];
      rows.push({
        id: id,
        name: b.name,
        lane: laneMap[b.category] || (/matchbox/i.test(b.name) ? "matchbox" : "other"),
        variant: b.tag === "sth" ? "sth" : b.tag === "th" ? "th" : b.tag === "chase" ? "chase" : "",
        grade: "",
        qty: sold ? 0 : 1,
        cost: b.cost,
        taxPct: 0,
        purchaseDate: b.date || "",
        store: b.store || "",
        condition: b.grade || "",
        status: sold ? "sold" : "in-stock",
        code: b.barcode || "",
        compId: b.catalogId ? "c:" + b.catalogId : "",
        notes: [b.notes, b.tag === "verify-sth" ? "Verify the Super on the card." : ""].filter(Boolean).join(" "),
        sales: sales,
      });
    });
    if (!rows.length) { flash("Your Hunt book is already in the tracker."); rerender(); return; }
    store.saveAll(rows).then(function () { flash("Copied " + rows.length + " items from your Hunt book. The book itself is unchanged."); rerender(); });
  }

  /* ---------- scan ---------- */
  function scanThen(done) {
    if (!app().scanFor) { flash("Scanner is not ready. Type the code.", "error"); rerender(); return; }
    app().scanFor(function (parsed) { done(parsed && parsed.key ? parsed.key : ""); });
  }

  function onScanAdd(code) {
    if (!code) return;
    var owned = store.all().filter(function (i) { return i.code && i.code.toUpperCase() === code.toUpperCase(); })[0];
    if (owned) {
      flash("Already in stock. Bump the qty or record a sale.");
      go("tracker", "item/" + owned.id);
      return;
    }
    ui.draft = D.normalize({ purchaseDate: D.today(), qty: 1, code: code });
    ui.draft.id = "";
    ui.draftFor = "new";
    var hits = P.byCode(comps, code);
    if (hits.length === 1) { applyComp(hits[0]); ui.draft.code = code; flash("Matched " + hits[0].name + ". Read the card before you save."); }
    else if (hits.length > 1) { ui.pickQ = ""; flash(hits.length + " items share this code. Pick the right one below."); ui.pickQ = hits[0].name; }
    else flash("Code " + code + " is not in Hunt's price list. Checking Hunt's catalog and the web…");
    if (hits.length !== 1) startLookup(code, "form");
    else ui.res = null;
    go("tracker", "add");
  }


  /* ---------- barcode / UPC lookup: Hunt first, then the web ---------- */
  var upc = { lib: null, cache: null, index: null, assort: null, assortJson: null, loading: null };

  function upcReady() {
    if (upc.lib) return Promise.resolve(upc.lib);
    if (upc.loading) return upc.loading;
    var load = window.HuntUpc ? Promise.resolve(window.HuntUpc) : app().loadUpc ? app().loadUpc() : Promise.reject(new Error("upc"));
    upc.loading = load.then(function (lib) {
      if (!lib) throw new Error("upc");
      upc.lib = lib;
      upc.cache = lib.idbCache();
      var getJson = function (path) {
        return fetch(path, { credentials: "omit" }).then(function (res) {
          if (!res.ok) throw new Error(path);
          return res.json();
        });
      };
      upc.index = lib.codeIndex(getJson);
      if (lib.assortIndex) {
        upc.assort = lib.assortIndex(getJson);
        upc.assort.load().then(function (json) { upc.assortJson = json; }).catch(function () {});
      }
      return lib;
    }).catch(function (err) {
      upc.loading = null;
      throw err;
    });
    return upc.loading;
  }

  function codeKey(raw) {
    var s = String(raw == null ? "" : raw).trim().toUpperCase().replace(/[\s-]/g, "");
    if (/^\d{13,14}$/.test(s)) s = s.replace(/^0+(?=\d{12}$)/, "");
    return s;
  }

  function codeEq(a, b) {
    var x = codeKey(a);
    var y = codeKey(b);
    if (!x || !y) return false;
    if (x === y) return true;
    var mx = /^([A-Z]{3}\d{2})[A-Z0-9]{4,6}$/.exec(x);
    var my = /^([A-Z]{3}\d{2})[A-Z0-9]{4,6}$/.exec(y);
    return (mx ? mx[1] : x) === (my ? my[1] : y) && (!!mx || !!my);
  }

  function looksLikeCode(raw) {
    var s = String(raw || "").trim().replace(/[\s-]/g, "");
    if (/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(s)) return !upc.lib || upc.lib.isRetailCode(s);
    return /^[A-Za-z]{3}\d{2}([A-Za-z0-9]{4,6})?$/.test(s);
  }

  function compsByCode(code) {
    var out = [];
    var keys = [codeKey(code)];
    var mk = /^([A-Z]{3}\d{2})[A-Z0-9]{4,6}$/.exec(keys[0]);
    if (mk) keys.push(mk[1]);
    if (/^\d{12}$/.test(keys[0])) keys.push("0" + keys[0]);
    keys.forEach(function (k) {
      P.byCode(comps, k).forEach(function (c) { if (out.indexOf(c) === -1) out.push(c); });
    });
    return out;
  }

  function absUrl(src) {
    var s = String(src || "");
    if (!s) return "";
    if (/^https:\/\//i.test(s)) return s;
    if (/^(data:|blob:|http:)/i.test(s)) return "";
    try { return new URL(s, document.baseURI).href; } catch (err) { return ""; }
  }

  function closeAppSheet() {
    if (app().closeSheet) app().closeSheet();
  }

  function paintRes() {
    var res = ui.res;
    if (!res) return;
    if (res.ctx === "sheet") {
      var el = document.getElementById("scan-lookup");
      if (el) el.innerHTML = resHtml(res);
      var msg = document.getElementById("scan-msg");
      if (res.photo) {
        if (msg) {
          msg.textContent = res.photo.step ? "Reading your photo…" : res.photo.chosen ? "Check the card below, then add it." : res.photo.cands.length ? "Hunt found possible matches. Tap the one you have." : res.photo.error ? "The photo could not be read." : "No match yet. Search the web with what Hunt read.";
          msg.classList.remove("is-error");
          msg.setAttribute("role", "status");
        }
        return;
      }
      var found = res.stock.length || res.comps.length || res.webComps.length || allIndexRows(res).length || res.learned || (res.web && res.web.result) || res.assort || res.assortPick;
      if (msg && (found || res.status !== "done")) {
        msg.textContent = res.assortPick ? "Hunt found the exact item. Check the card below." : res.assort ? "This barcode covers a whole case. Pick the one you have, or type its item code." : found ? "Not on your buy list or in your book, but Hunt found it. Check the card below." : "Not on your buy list or in your book. Checking the rest of Hunt and the web…";
        msg.classList.remove("is-error");
        msg.setAttribute("role", "status");
      } else if (msg) {
        msg.textContent = "No catalog, inventory, or web match for this code.";
      }
      return;
    }
    var box = document.getElementById("stk-res");
    if (box) { box.innerHTML = resHtml(res); return; }
    if (res.ctx === "form" || res.ctx === "show") {
      if (res.ctx === "form") readForm();
      rerender();
    }
  }

  function scrollRes() {
    var card = document.querySelector(".upc-picked");
    if (card && card.scrollIntoView) card.scrollIntoView({ block: "nearest" });
  }

  /* ctx: "sheet" (Scan tab / scan sheet), "form" (tracker add/edit), "show" (Show Mode price check) */
  function startLookup(code, ctx, el, force) {
    var key = String(code || "").trim();
    if (!key) return Promise.resolve(null);
    var res = { code: key, ctx: ctx, status: "local", stock: [], comps: [], index: [], learned: null, web: null, webIndex: [], webComps: [], pick: 0, chosen: "", prefix: null, error: "", assort: null, assortItems: null, assortQ: "", assortPick: null, assortAll: false, assortMsg: "" };
    ui.res = res;
    res.stock = store.loaded() ? store.all().filter(function (i) { return codeEq(i.code, key); }) : [];
    res.comps = compsByCode(key);
    paintRes();
    return upcReady().then(function (U) {
      res.prefix = U.prefixInfo(key);
      var g = U.gtin14(key);
      return Promise.all([
        upc.index.find(key).catch(function () { return []; }),
        upc.cache.learned(g || learnedCodeKey(key)).catch(function () { return null; }),
        upc.assort ? upc.assort.match(key).catch(function () { return null; }) : Promise.resolve(null),
        upc.assort && !g ? upc.assort.itemByCode(key).catch(function () { return null; }) : Promise.resolve(null),
      ]).then(function (got) {
        if (ui.res !== res) return res;
        res.index = got[0] || [];
        res.learned = got[1] || null;
        if (got[3]) {
          /* a card-back item code (JDP89) names the exact item */
          res.assortPick = got[3];
          return (upc.assort.match(got[3].assortment).catch(function () { return null; })).then(function (a) {
            res.assort = a;
            res.status = "done";
            if (ui.res === res) paintRes();
            return res;
          });
        }
        if (got[2]) return openAssort(res, got[2]).then(function () {
          if (!g || ui.res !== res) { res.status = "done"; if (ui.res === res) paintRes(); return res; }
          return webStep(res, U, key, force);
        });
        if (!g) { res.status = "done"; paintRes(); return res; }
        return webStep(res, U, key, force);
      });
    }).catch(function () {
      res.status = "done";
      res.error = "The lookup helper did not load. Check the connection, or add it by hand.";
      if (ui.res === res) paintRes();
      return res;
    });
  }

  /* One barcode for a whole Mattel case: list the case, newest year first. */
  function openAssort(res, a) {
    res.assort = a;
    res.learned = null;
    paintRes();
    return upc.assort.items(a.key).then(function (list) {
      res.assortItems = upc.lib.sortAssort(list);
      if (ui.res === res) paintRes();
    }).catch(function () { res.assortItems = []; });
  }

  function webStep(res, U, key, force) {
    res.status = "web";
    paintRes();
    return U.lookup(key, { cache: upc.cache, proxy: U.proxyUrl(window.localStorage), force: !!force }).then(function (out) {
      res.web = out;
      if (!res.assort && upc.assort && out.result) {
        return upc.assort.match(key, out.result).catch(function () { return null; }).then(function (a) {
          if (a) return openAssort(res, a).then(function () { res.status = "done"; if (ui.res === res) paintRes(); return res; });
          return webCodes(res, out);
        });
      }
      if (res.assort) { res.status = "done"; if (ui.res === res) paintRes(); return res; }
      return webCodes(res, out);
    });
  }

  function webCodes(res, out) {
    var codes = out.result && out.result.mattelCodes ? out.result.mattelCodes.slice(0, 4) : [];
    return Promise.all(codes.map(function (mc) { return upc.index.find(mc).catch(function () { return []; }); })).then(function (lists) {
      var seen = {};
      res.index.forEach(function (r) { seen[r.id] = true; });
      lists.forEach(function (list) { list.forEach(function (r) { if (!seen[r.id]) { seen[r.id] = true; res.webIndex.push(r); } }); });
      codes.forEach(function (mc) { compsByCode(mc).forEach(function (c) { if (res.comps.indexOf(c) === -1 && res.webComps.indexOf(c) === -1) res.webComps.push(c); }); });
      res.status = "done";
      if (ui.res === res) paintRes();
      return res;
    });
  }

  function lookupInto(el, code) {
    if (!el) return Promise.resolve(null);
    el.id = "scan-lookup";
    var go2 = function () { return startLookup(code, "sheet", el); };
    return store.loaded() ? go2() : store.load().catch(function () { return []; }).then(go2);
  }

  function allIndexRows(res) {
    return res.index.concat(res.webIndex);
  }

  function indexRowById(res, id) {
    return allIndexRows(res).filter(function (r) { return r.id === id; })[0] || null;
  }

  function resImages(res) {
    var w = res.web && res.web.result;
    var list = w && w.images ? w.images.slice() : [];
    if (res.learned && res.learned.imageUrl && list.indexOf(res.learned.imageUrl) === -1) list.unshift(res.learned.imageUrl);
    return list;
  }

  function linkedComp(res) {
    if (res.comps.length === 1) return res.comps[0];
    if (!res.comps.length && res.webComps.length === 1) return res.webComps[0];
    var row = res.chosen ? indexRowById(res, res.chosen) : null;
    if (row && /^(c|m):/.test(row.id) && compIndex[row.id]) return compIndex[row.id];
    return null;
  }

  function chosenRow(res) {
    if (res.chosen) return indexRowById(res, res.chosen);
    var rows = allIndexRows(res);
    return rows.length === 1 ? rows[0] : null;
  }

  function rowLabel(r) {
    return [r.year, r.line ? String(r.line).replace(/-/g, " ") : ""].filter(Boolean).join(" · ");
  }

  function rowLane(r) {
    return r.lane || (r.source === "hw" ? "hot-wheels" : "other");
  }

  function linkList(links) {
    return '<p class="upc-links"><span>Search the web</span>' + (links || []).map(function (l) {
      return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer' + (l.id === "amazon" ? " sponsored" : "") + '">' + esc(l.label) + "</a>";
    }).join("") + "</p>";
  }

  function resHtml(res) {
    var U = upc.lib;
    var html = "";
    var ctx = res.ctx;
    if (res.stock.length && ctx !== "show") {
      html += '<p class="kicker">In your tracker</p>' + res.stock.map(function (i) {
        return '<button type="button" class="stk-hit" data-stk="res-open" data-id="' + esc(i.id) + '"><b>' + esc(i.name) + "</b><span>Qty " + esc(i.qty) + " · " + esc(D.label(D.STATUSES, i.status)) + (i.bin ? " · Bin " + esc(i.bin) : "") + "</span></button>";
      }).join("");
    }
    if (res.photo) return photoHtml(res);
    if (res.assortPick) return html + pickedHtml(res) + (res.web && res.web.links ? linkList(res.web.links) : "");
    if (res.assort) return html + assortHtml(res) + (res.web && res.web.links ? linkList(res.web.links) : "");
    var compList = res.comps.concat(res.webComps);
    if (compList.length && ctx !== "show") {
      html += '<p class="kicker">On Hunt\'s price list</p>' + compList.map(function (c) {
        return '<button type="button" class="stk-hit" data-stk="' + (ctx === "form" ? "pick" : "add-from-comp") + '" data-comp="' + esc(c.id) + '"><b>' + esc(c.name) + "</b><span>" + esc(c.section || "") + " · " + (c.value != null ? money(c.value) + " " + esc(c.kind === "guide" ? "guide" : "sold") : "No verified comp") + "</span></button>";
      }).join("");
    }
    if (compList.length && ctx === "show") {
      html += '<p class="kicker">Price check from this code</p>' + compList.map(compCard).join("");
    }
    var rows = allIndexRows(res).filter(function (r) { return !/^(c|m):/.test(r.id) || !compIndex[r.id] || compList.indexOf(compIndex[r.id]) === -1; });
    if (rows.length) {
      var sel = chosenRow(res);
      html += '<p class="kicker">In Hunt\'s catalog' + (res.webIndex.length && !res.index.length ? " (Mattel code from the web match)" : "") + "</p>" + rows.slice(0, 8).map(function (r) {
        var on = sel && sel.id === r.id;
        return '<button type="button" class="stk-hit upc-row' + (on ? " is-on" : "") + '" data-stk="res-index" data-v="' + esc(r.id) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
          (r.thumb ? '<span class="stk-thumb"><img src="' + esc(r.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></span>' : "") +
          "<span><b>" + esc(r.name) + "</b><span>" + esc(rowLabel(r) || r.source) + (r.code ? " · " + esc(r.code) : "") + "</span></span></button>";
      }).join("") + (rows.length > 1 ? '<p class="fine">Several releases share this casting code. Tap the one on the card.</p>' : "");
    }
    if (res.learned && !(res.web && res.web.result)) html += learnedCardHtml(res.learned);
    if (res.status === "local") html += '<p class="fine upc-status" role="status">Checking Hunt…</p>';
    else if (res.status === "web") html += '<p class="fine upc-status" role="status">Searching the web for ' + esc(res.code) + "…</p>";
    if (res.error) html += '<p class="fine is-error" role="alert">' + esc(res.error) + "</p>";
    var w = res.web && res.web.result;
    if (w) html += webCardHtml(res, w);
    var haveLocal = !!(compList.length || rows.length || res.learned);
    if (res.status === "done" && !w) {
      var tried = res.web && res.web.tried ? res.web.tried : [];
      var webTried = tried.length && tried[0].source !== "web";
      var offline = webTried && tried.every(function (t) { return t.status === "offline" || t.status === "timeout"; });
      var limited = tried.some(function (t) { return t.status === "limited"; });
      html += '<section class="upc-card is-miss">';
      if (offline) html += "<p><b>Offline.</b> The web lookup runs when you have signal. Hunt's own catalog still works.</p>";
      else if (webTried && !res.learned) html += "<p><b>No public product database knows " + esc(res.code) + " yet.</b>" + (limited ? " One source was busy; try again in a minute." : "") + "</p>";
      else if (!haveLocal && !res.stock.length) html += "<p><b>" + esc(res.code) + " is not in Hunt's catalog.</b> Web databases only know retail UPC / EAN codes, so type the name.</p>";
      if (res.prefix && !haveLocal) html += '<p class="fine">The barcode prefix belongs to ' + esc(res.prefix.brand) + ". That names the maker, not the item.</p>";
      html += '<div class="stk-actions">';
      if (haveLocal) html += '<button class="solid" type="button" data-stk="res-add">' + (ctx === "form" ? "Use these details" : ctx === "show" ? "Add to stock (at show)" : "Add to tracker") + "</button>" + (ctx === "form" ? "" : '<button class="ghost" type="button" data-stk="res-edit">Edit, then add</button>');
      else if (ctx !== "form") html += '<button class="solid" type="button" data-stk="res-edit">Add to tracker by hand</button>';
      if (webTried) html += '<button class="ghost" type="button" data-stk="res-retry">Try the web again</button>';
      html += "</div>";
      if (res.web && res.web.links) html += linkList(res.web.links);
      html += "</section>";
    }
    if (U && res.web && res.web.result && res.web.links) html += linkList(res.web.links);
    return html;
  }

  function assortYear(it) {
    var ys = String(it.years || it.year || "").split(/\D+/).filter(Boolean).map(Number);
    return ys.length ? Math.max.apply(null, ys) : 0;
  }

  function assortListHtml(res) {
    var U = upc.lib;
    var all = res.assortItems || [];
    var list = U ? U.filterAssort(all, res.assortQ) : all;
    if (res.assortItems == null) return '<p class="fine upc-status" role="status">Loading the case list…</p>';
    if (!list.length) {
      var q = String(res.assortQ || "").trim();
      var mk = U && U.mattelKey(q);
      return '<p class="fine" role="status">' + (mk ? esc(mk) + " is not in Hunt's " + esc(res.assort.key) + " list yet." : "Nothing matches “" + esc(q) + "”.") + "</p>" +
        (mk ? '<div class="stk-actions"><button class="ghost" type="button" data-stk="assort-code-lookup" data-v="' + esc(mk) + '">Search Hunt and the web for ' + esc(mk) + "</button></div>" : "");
    }
    var limit = res.assortAll || res.assortQ ? list.length : 36;
    var html = "";
    var year = null;
    list.slice(0, limit).forEach(function (it) {
      var y = assortYear(it);
      if (y !== year) {
        if (year !== null) html += "</div>";
        year = y;
        html += '<p class="kicker upc-assort-year">' + esc(y || "Year unknown") + '</p><div class="upc-assort-grid">';
      }
      var idx = all.indexOf(it);
      html += '<button type="button" class="upc-assort-item" data-stk="assort-pick" data-v="' + idx + '">' +
        '<span class="upc-assort-img">' + (it.thumb ? '<img src="' + esc(it.thumb) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-upc-img="1">' : '<b>HW</b>') + "</span>" +
        "<b>" + esc(it.name) + "</b><span>" + esc([it.series, it.code || "code unknown"].filter(Boolean).join(" · ")) + "</span></button>";
    });
    if (year !== null) html += "</div>";
    if (list.length > limit) html += '<button class="ghost full" type="button" data-stk="assort-all">Show all ' + list.length + " in this case</button>";
    return html;
  }

  function assortHtml(res) {
    var a = res.assort;
    var w = res.web && res.web.result;
    var ex = a.example || "JDP89";
    return '<section class="upc-card upc-assort" aria-label="Which one is it?">' +
      '<p class="kicker">One barcode, many items · Asst. ' + esc(a.key) + "</p>" +
      '<div class="upc-head">' + (a.image ? '<span class="upc-img"><img src="' + esc(a.image) + '" alt="' + esc(a.name) + '" loading="lazy" referrerpolicy="no-referrer" data-upc-img="1"></span>' : "") +
      '<div class="upc-copy"><h3>Which one is it?</h3><p class="fine">' + esc(a.name) + ". " + esc(a.note || "Every item in the case shares this barcode, so the barcode can't tell them apart.") + "</p></div></div>" +
      '<label class="upc-code-label" for="upc-item-code">Type the item code from the back of the card (e.g. ' + esc(ex) + ")</label>" +
      '<input id="upc-item-code" class="upc-code-input" type="text" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="' + esc(ex) + ' or a name" value="' + esc(res.assortQ || "") + '">' +
      '<p class="fine">It sits near the barcode, like ' + esc(ex) + "-0910. Only the first five characters matter. Or tap the one you have:</p>" +
      '<div id="upc-assort-list">' + assortListHtml(res) + "</div>" +
      (w ? '<p class="fine">The web only names the case: ' + esc(w.title) + " (" + esc(w.sourceName || "web") + ").</p>" : "") +
      (res.status === "web" ? '<p class="fine upc-status" role="status">Checking the web too…</p>' : "") +
      "</section>";
  }

  function pickedHtml(res) {
    var it = res.assortPick;
    var a = res.assort || { key: it.assortment, name: "", image: "" };
    var ctx = res.ctx;
    var primary = ctx === "form" ? "Use these details" : ctx === "show" ? "Add to stock (at show)" : "Add to tracker";
    var img = it.thumb || a.image || "";
    var facts = [
      ["Line", a.name],
      ["Series", it.series],
      ["Year", it.years || it.year],
      ["Item code", it.code || "Unknown"],
      ["Assortment", a.key],
      ["Barcode", /^\d{12,14}$/.test(String(res.code).replace(/\D/g, "")) && String(res.code).replace(/\D/g, "").length >= 12 ? res.code : ""],
    ].filter(function (f) { return f[1]; });
    return '<section class="upc-card upc-picked" aria-label="Exact item">' +
      '<p class="kicker">Exact item' + (a.key ? " · Asst. " + esc(a.key) : "") + "</p>" +
      '<div class="upc-head">' + (img ? '<span class="upc-img"><img src="' + esc(img) + '" alt="' + esc(it.name) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-upc-img="1" data-alts="' + esc(a.image && a.image !== img ? a.image : "") + '"></span>' : "") +
      '<div class="upc-copy"><h3>' + esc(it.name) + "</h3>" +
      '<dl class="upc-facts">' + facts.map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("") + "</dl></div></div>" +
      '<div class="stk-actions"><button class="solid" type="button" data-stk="res-add">' + esc(primary) + "</button>" +
      (ctx === "form" ? "" : '<button class="ghost" type="button" data-stk="res-edit">Edit, then add</button>') +
      (res.assortItems ? '<button class="ghost" type="button" data-stk="assort-back">Not this one</button>' : "") + "</div>" +
      '<p class="fine">Item code and photo: Hot Wheels Wiki (CC BY-SA). Treasure Hunts carry their own item code, so read the card.</p>' +
      "</section>";
  }

  function webCardHtml(res, w) {
    var imgs = resImages(res);
    var pick = Math.min(res.pick || 0, Math.max(0, imgs.length - 1));
    var main = imgs[pick] || "";
    var ctx = res.ctx;
    var srcName = w.sourceName || "the web";
    var facts = [
      ["Brand", w.brand],
      ["Lane", D.label(D.LANES, w.lane)],
      ["Category", w.category],
      ["Model", w.model],
      ["Mattel code", (w.mattelCodes || []).join(", ")],
      ["MSRP", w.msrp != null ? money(w.msrp) : ""],
      ["Code", res.code],
    ].filter(function (f) { return f[1]; });
    var primary = ctx === "form" ? "Use these details" : ctx === "show" ? "Add to stock (at show)" : "Add to tracker";
    return '<section class="upc-card" aria-label="Web match">' +
      '<p class="kicker">Found on the web · ' + esc(srcName) + (res.web.cached ? " · saved on this phone" : "") + "</p>" +
      '<div class="upc-head">' +
      (main ? '<span class="upc-img"><img src="' + esc(main) + '" alt="' + esc(w.title) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-upc-img="1" data-alts="' + esc(imgs.slice(pick + 1).join(" ")) + '"></span>' : '<span class="upc-img is-empty"><b>' + esc(D.label(D.LANES, w.lane).slice(0, 2).toUpperCase()) + "</b></span>") +
      '<div class="upc-copy"><h3>' + esc(w.title) + "</h3>" +
      '<dl class="upc-facts">' + facts.map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("") + "</dl></div></div>" +
      (imgs.length > 1 ? '<div class="upc-thumbs" role="group" aria-label="Pick a photo">' + imgs.map(function (u, i) {
        return '<button type="button" class="upc-thumb' + (i === pick ? " is-on" : "") + '" data-stk="res-img" data-v="' + i + '" aria-label="Photo ' + (i + 1) + '" aria-pressed="' + (i === pick ? "true" : "false") + '"><img src="' + esc(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-upc-img="1"></button>';
      }).join("") + "</div>" : "") +
      (w.description ? '<p class="upc-desc">' + esc(w.description) + "</p>" : "") +
      '<div class="stk-actions"><button class="solid" type="button" data-stk="res-add">' + esc(primary) + "</button>" +
      (ctx === "form" ? "" : '<button class="ghost" type="button" data-stk="res-edit">Edit, then add</button>') + "</div>" +
      '<p class="fine">Source: <a href="' + esc(w.sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(srcName) + "</a>. A barcode names the product, not the variant. Read the card for STH, TH, or chase before you price it.</p>" +
      shareLinkHtml({ name: w.title, upc: /^\d{8,14}$/.test(String(res.code).replace(/\D/g, "")) && String(res.code).replace(/\D/g, "").length >= 12 ? String(res.code).replace(/\D/g, "") : "", codes: (w.mattelCodes || []).slice(0, 3), brand: w.brand || "", lane: w.lane || "", line: w.category || "", imageUrl: resImages(res)[res.pick || 0] || "", sourceUrl: w.sourceUrl || "", source: srcName }) +
      "</section>";
  }

  function resDraft(res, base) {
    var d = base || D.normalize({ purchaseDate: D.today(), qty: 1, status: res.ctx === "show" ? "at-show" : "in-stock" });
    if (!base) d.id = "";
    if (res.photo && res.photo.chosen) return candidateDraft(res.photo.chosen, d);
    if (res.assortPick) return pickedDraft(res, d);
    var w = res.web && res.web.result;
    var L = res.learned;
    var row = chosenRow(res);
    var comp = linkedComp(res);
    if (!d.code) d.code = res.code;
    if (comp && !d.compId) {
      d.compId = comp.id;
      if (!d.name) d.name = comp.name;
      if (!d.lane || d.lane === "other") d.lane = comp.lane || "other";
      if (!d.photo && !d.imageUrl && comp.photo) d.imageUrl = absUrl(comp.photo);
    }
    if (!d.name && L && L.name) d.name = L.name;
    if (!d.name && row) d.name = row.name + (row.year ? " (" + row.year + ")" : "");
    if (!d.name && w) d.name = w.title;
    if ((!d.lane || d.lane === "other") && L && L.lane) d.lane = L.lane;
    if ((!d.lane || d.lane === "other") && row) d.lane = rowLane(row);
    if ((!d.lane || d.lane === "other") && w) d.lane = w.lane;
    if ((!d.lane || d.lane === "other") && res.prefix) d.lane = res.prefix.lane;
    var imgs = resImages(res);
    var img = imgs[Math.min(res.pick || 0, Math.max(0, imgs.length - 1))] || "";
    if (!d.imageUrl && img) d.imageUrl = img;
    if (!d.imageUrl && row && row.thumb) d.imageUrl = absUrl(row.thumb);
    if (!d.imageUrl && L && L.imageUrl) d.imageUrl = L.imageUrl;
    if (!d.brand) d.brand = (w && w.brand) || (L && L.brand) || (row && row.source === "hw" ? "Hot Wheels" : "") || (res.prefix ? res.prefix.brand : "");
    if (!d.description && w && w.description) d.description = w.description;
    if (d.msrp == null && w && w.msrp != null) d.msrp = w.msrp;
    if (w && !d.lookupSource) { d.lookupSource = w.sourceName; d.lookupUrl = w.sourceUrl || ""; }
    else if (!w && row && !d.lookupSource) d.lookupSource = "Hunt catalog";
    if (!d.condition && (d.lane === "pokemon" || d.lane === "funko" || d.lane === "lego" || d.lane === "hot-wheels" || d.lane === "matchbox")) d.condition = "New / sealed";
    if (!d.variant && d.lane === "pokemon" && /elite trainer|booster|box|tin|collection/i.test(d.name)) d.variant = "sealed";
    return D.normalize(d);
  }

  function pickedDraft(res, d) {
    var it = res.assortPick;
    var a = res.assort || { key: it.assortment, name: "", image: "" };
    var first = String(it.year || "").replace(/\D/g, "");
    if (!d.code) d.code = res.code;
    if (!d.name) d.name = (a.key === "FYJ44" ? "Hot Wheels Monster Trucks " : "Hot Wheels ") + it.name + (first ? " (" + first + ")" : "");
    if (!d.lane || d.lane === "other") d.lane = "hot-wheels";
    if (!d.brand) d.brand = a.brand || "Hot Wheels";
    if (!d.imageUrl && !d.photo) d.imageUrl = absUrl(it.thumb) || absUrl(a.image);
    if (!d.description) d.description = [a.name, it.series ? "Series: " + it.series : "", it.years ? "Years: " + it.years : ""].filter(Boolean).join(". ") + ".";
    var tag = [it.code ? "Item code " + it.code : "Item code unknown", a.key ? "Asst. " + a.key : ""].filter(Boolean).join(" · ");
    if (!d.notes) d.notes = tag;
    else if (d.notes.indexOf(tag) === -1) d.notes = d.notes + " · " + tag;
    if (!d.lookupSource) { d.lookupSource = "Hunt catalog (Hot Wheels Wiki)"; d.lookupUrl = a.sourceUrl || ""; }
    if (!d.condition) d.condition = "New / sealed";
    return D.normalize(d);
  }

  function localCopy(url) {
    return new Promise(function (resolve) {
      if (!url || !/^https:\/\//i.test(url)) { resolve(""); return; }
      var img = new Image();
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; resolve(""); } }, 5000);
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      img.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          var max = 480;
          var scale = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
          canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        } catch (err) {
          resolve("");
        }
      };
      img.onerror = function () { if (!done) { done = true; clearTimeout(timer); resolve(""); } };
      img.src = url;
    });
  }

  function keepLocalCopy(item) {
    if (!item || item.photo || item.imageLocal || !item.imageUrl) return;
    if (item.imageUrl.indexOf(location.origin) === 0) return;
    localCopy(item.imageUrl).then(function (data) {
      if (!data) return;
      var fresh = store.get(item.id);
      if (!fresh || fresh.imageLocal) return;
      fresh.imageLocal = data;
      store.save(fresh).catch(function () {});
    });
  }

  /* "code:<CODE>" key for non-UPC codes: Mattel item codes reduce to the toy number, card numbers keep "158/128" */
  function learnedCodeKey(raw) {
    var s = String(raw == null ? "" : raw).trim().toUpperCase().replace(/\s+/g, " ");
    if (!s) return "code:";
    var mk = upc.lib && upc.lib.mattelKey ? upc.lib.mattelKey(s.replace(/ /g, "")) : null;
    return "code:" + (mk || s);
  }

  /* Keys a saved item teaches the learned catalog. A shared assortment UPC never learns one item's name. */
  function learnKeys(U, item) {
    var keys = [];
    var code = String(item.code || "").trim();
    var g = code ? U.gtin14(code) : null;
    var shared = g && upc.assortJson && U.assortKeyOf && U.assortKeyOf(upc.assortJson, code);
    if (g && !shared) keys.push(g);
    if (code && !g) keys.push(learnedCodeKey(code));
    var m = /Item code ([A-Z]{3}\d{2})/.exec(String(item.notes || ""));
    if (m) keys.push("code:" + m[1]);
    return keys.filter(function (k, i) { return k && k !== "code:" && keys.indexOf(k) === i; });
  }

  function learnFrom(item) {
    if (!item) return;
    upcReady().then(function (U) {
      var keys = learnKeys(U, item);
      if (!keys.length) return;
      var code = String(item.code || "").trim();
      var entry = {
        name: item.name, lane: item.lane, brand: item.brand || "", imageUrl: item.imageUrl || "", compId: item.compId || "",
        upc: U.gtin14(code) ? U.shortForm(code) : "",
        codes: keys.filter(function (k) { return k.indexOf("code:") === 0; }).map(function (k) { return k.slice(5); }),
        line: item.description ? String(item.description).split(". ")[0].slice(0, 80) : "",
        year: (/\((\d{4})\)\s*$/.exec(item.name || "") || [])[1] || "",
        sourceUrl: item.lookupUrl || "", source: item.lookupSource || "", at: Date.now(),
      };
      keys.forEach(function (k) { upc.cache.learn(k, entry).catch(function () {}); });
    }).catch(function () {});
    keepLocalCopy(item);
  }

  /* ---------- learned catalog: search, open, share ---------- */
  var SHARE_REPO = "barronstrikesgold-cyber/barronstrikesgold-cyber.github.io";

  function learnedList() {
    return upcReady().then(function () { return upc.cache.learnedAll ? upc.cache.learnedAll() : []; }).then(function (rows) {
      var seen = {};
      return (rows || []).filter(function (r) {
        var k = String(r.name || "").toUpperCase() + "|" + (r.upc || "") + "|" + (r.codes || []).join(",");
        if (!r.name || seen[k]) return false;
        seen[k] = true;
        return true;
      });
    }).catch(function () { return []; });
  }

  function learnedSearch(q) {
    var words = String(q || "").toUpperCase().split(/[^A-Z0-9/]+/).filter(function (w) { return w.length >= 2; });
    if (!words.length) return Promise.resolve([]);
    return learnedList().then(function (rows) {
      return rows.filter(function (r) {
        var hay = [r.name, r.brand, r.upc, (r.codes || []).join(" "), r.line].join(" ").toUpperCase();
        return words.every(function (w) { return hay.indexOf(w) !== -1; });
      }).slice(0, 20);
    });
  }

  function openLearned(key) {
    return learnedList().then(function (rows) {
      var r = rows.filter(function (x) { return x.key === key; })[0];
      if (!r) return;
      var d = D.normalize({ purchaseDate: D.today(), qty: 1, status: "in-stock", name: r.name, lane: r.lane || "other", brand: r.brand || "", imageUrl: r.imageUrl || "", code: r.upc || (r.codes || [])[0] || "", lookupSource: r.source || "Learned catalog", lookupUrl: r.sourceUrl || "" });
      d.id = "";
      ui.draft = d;
      ui.draftFor = "new";
      closeAppSheet();
      flash("Filled from your learned catalog. Edit anything, then add.");
      go("tracker", "add");
    });
  }

  /* The shared catalog intake: a prefilled GitHub issue (label catalog-add). Nothing is sent until the owner submits it on GitHub. */
  function shareUrl(entry) {
    var e = entry || {};
    var clean = {
      name: String(e.name || "").slice(0, 140), upc: String(e.upc || ""), codes: (e.codes || []).slice(0, 4), brand: String(e.brand || ""),
      lane: String(e.lane || ""), line: String(e.line || "").slice(0, 80), year: String(e.year || ""),
      imageUrl: /^https:\/\//.test(e.imageUrl || "") ? e.imageUrl : "", sourceUrl: /^https:\/\//.test(e.sourceUrl || "") ? e.sourceUrl : "", source: String(e.source || ""),
    };
    var body = "Hunt found this on the web and I confirmed it. The catalog-intake Action re-checks it and adds it only if the source and photo verify.\n\n```json\n" + JSON.stringify(clean, null, 2) + "\n```\n";
    return "https://github.com/" + SHARE_REPO + "/issues/new?labels=catalog-add&title=" + encodeURIComponent("catalog-add: " + clean.name) + "&body=" + encodeURIComponent(body);
  }

  function shareLinkHtml(entry) {
    if (!entry || !entry.name || !/^https:\/\//.test(entry.sourceUrl || "")) return "";
    return '<p class="fine upc-share"><a href="' + esc(shareUrl(entry)) + '" target="_blank" rel="noopener noreferrer" data-share="catalog-add">Suggest for the shared Hunt catalog</a> (opens a prefilled GitHub issue; a nightly check adds it only if the source and photo verify).</p>';
  }

  function learnedCardHtml(L) {
    return '<section class="upc-card upc-learned" aria-label="Learned catalog">' +
      '<p class="kicker">In your learned catalog</p>' +
      '<div class="upc-head">' + (L.imageUrl ? '<span class="upc-img"><img src="' + esc(L.imageUrl) + '" alt="' + esc(L.name || "") + '" loading="lazy" referrerpolicy="no-referrer" data-upc-img="1"></span>' : "") +
      '<div class="upc-copy"><h3>' + esc(L.name || "") + "</h3>" +
      '<dl class="upc-facts">' + [["Brand", L.brand], ["Lane", L.lane ? D.label(D.LANES, L.lane) : ""], ["Code", [L.upc].concat(L.codes || []).filter(Boolean).join(", ")], ["Source", L.source]].filter(function (f) { return f[1]; }).map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("") + "</dl></div></div>" +
      '<p class="fine">You confirmed this before, so it is saved on this phone.</p>' + shareLinkHtml(L) +
      "</section>";
  }

  /* ---------- identify from a photo ---------- */
  function photoReady() {
    if (window.HuntPhoto) return Promise.resolve(window.HuntPhoto);
    return app().loadPhoto ? app().loadPhoto() : Promise.reject(new Error("photo"));
  }

  function fileToCanvas(file, max) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * scale));
        c.height = Math.max(1, Math.round(img.naturalHeight * scale));
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("image")); };
      img.src = url;
    });
  }

  /* grayscale + contrast stretch helps Tesseract on glossy card backs */
  function ocrCanvas(src) {
    var c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    var ctx = c.getContext("2d");
    ctx.drawImage(src, 0, 0);
    try {
      var data = ctx.getImageData(0, 0, c.width, c.height);
      var px = data.data;
      var lo = 255;
      var hi = 0;
      var i;
      for (i = 0; i < px.length; i += 4) {
        var g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        px[i] = g;
        if (g < lo) lo = g;
        if (g > hi) hi = g;
      }
      var span = Math.max(1, hi - lo);
      for (i = 0; i < px.length; i += 4) {
        var v = ((px[i] - lo) * 255) / span;
        px[i] = px[i + 1] = px[i + 2] = v;
      }
      ctx.putImageData(data, 0, 0);
    } catch (err) { /* keep color */ }
    return c;
  }

  function photoPool(U) {
    var pool = [];
    try { refreshComps(); } catch (err) { /* keep cached comps */ }
    comps.forEach(function (c) { pool.push({ name: c.name, lane: c.lane || "other", brand: "", thumb: c.photo ? absUrl(c.photo) : "", line: c.section || "", code: (c.codes || [])[0] || "", source: "Hunt price list", compId: c.id }); });
    if (store.loaded()) store.all().forEach(function (i) { pool.push({ name: i.name, lane: i.lane, brand: i.brand || "", thumb: i.photo || i.imageLocal || i.imageUrl || "", line: "In your tracker", code: i.code || "", source: "Your tracker", stockId: i.id }); });
    var mt = fetch("data/hw/monster-trucks.json", { credentials: "omit" }).then(function (r) { return r.ok ? r.json() : { items: [] }; }).catch(function () { return { items: [] }; });
    return Promise.all([mt, learnedList()]).then(function (got) {
      (got[0].items || []).forEach(function (it) { pool.push({ name: it.name, lane: "hot-wheels", brand: "Hot Wheels", thumb: it.i || "", line: "Monster Trucks 1:64" + (it.series ? " · " + it.series : ""), year: it.year, code: it.code || "", source: "Hunt catalog (Hot Wheels Wiki)", mt: true }); });
      got[1].forEach(function (r) { pool.push({ name: r.name, lane: r.lane, brand: r.brand || "", thumb: r.imageUrl || "", line: "Learned catalog", code: r.upc || (r.codes || [])[0] || "", source: r.source || "Learned catalog", sourceUrl: r.sourceUrl || "" }); });
      return pool;
    });
  }

  function webTextSearch(P, ext) {
    var url = P.pokemonQuery(ext);
    var looksPokemon = /\bHP\s?\d{2,3}\b|\bPOK[EÉ]MON\b|\b(EX|GX|VMAX|VSTAR)\b/i.test(ext.text);
    if (!url && looksPokemon && ext.words.length) {
      var name = ext.words.filter(function (w) { return !/^(HP|EX|GX|VMAX|VSTAR|BASIC|STAGE|POKEMON|POKÉMON|TRAINER|WEAKNESS|RESISTANCE|RETREAT)$/.test(w); })[0];
      if (name) url = "https://api.pokemontcg.io/v2/cards?q=" + encodeURIComponent('name:"' + name.toLowerCase() + '*"') + "&pageSize=10&orderBy=-set.releaseDate&select=id,name,number,rarity,set,images,tcgplayer";
    }
    if (!url) return Promise.resolve([]);
    /* the keyless Pokémon TCG API is sometimes slow or busy: 12 s per try, one retry */
    function once() {
      var ctl = typeof AbortController === "function" ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, 12000) : null;
      return fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", signal: ctl ? ctl.signal : undefined })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .finally(function () { if (timer) clearTimeout(timer); });
    }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function getJson(u) {
      var ctl = typeof AbortController === "function" ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, 10000) : null;
      return fetch(u, { credentials: "omit", referrerPolicy: "no-referrer", signal: ctl ? ctl.signal : undefined })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .finally(function () { if (timer) clearTimeout(timer); });
    }
    /* TCGdex fallback: card list, then details of the best 3 names for the set total */
    function tcgdex() {
      var tu = P.tcgdexQuery(ext);
      if (!tu) return Promise.resolve([]);
      return getJson(tu).then(function (list) {
        var top = (list || []).map(function (c) { return { c: c, s: P.scoreName(c.name, ext.words) }; })
          .sort(function (a, b) { return b.s - a.s; }).slice(0, 3).map(function (x) { return x.c; });
        return Promise.all(top.map(function (c) { return getJson(P.TCGDEX + "/" + encodeURIComponent(c.id)).catch(function () { return null; }); }))
          .then(function (ds) {
            var map = {};
            ds.forEach(function (d) { if (d && d.id) map[d.id] = d; });
            return P.parseTcgdex(top, map, ext).slice(0, 5);
          });
      }).catch(function () { return []; });
    }
    return once().catch(function () { return wait(700).then(once); }).catch(function () { return wait(1500).then(once); })
      .then(function (json) { var c = P.parsePokemon(json, ext).slice(0, 5); return c.length ? c : tcgdex(); })
      .catch(function () { return tcgdex(); });
  }

  /* opts: { presentScan(code), loadScript(src) } ; el: the Scan results box */
  function photoInto(el, file, opts) {
    var o = opts || {};
    if (!el || !file) return Promise.resolve(null);
    el.innerHTML = '<div id="scan-lookup" class="upc-res" aria-live="polite"></div>';
    var res = { code: "", ctx: "sheet", status: "done", stock: [], comps: [], index: [], learned: null, web: null, webIndex: [], webComps: [], pick: 0, chosen: "", prefix: null, error: "", assort: null, assortItems: null, assortQ: "", assortPick: null, assortAll: false, assortMsg: "",
      photo: { step: "Loading the photo reader…", progress: 0, ext: null, cands: [], chosen: null, links: [], vision: false } };
    ui.res = res;
    paintRes();
    var step = function (text, pct) {
      if (ui.res !== res) return;
      res.photo.step = text;
      if (pct != null) res.photo.progress = pct;
      var st = document.getElementById("photo-step");
      if (st) st.textContent = text + (res.photo.progress ? " " + Math.round(res.photo.progress * 100) + "%" : "");
      else paintRes();
    };
    var P;
    var U;
    var small = "";
    return Promise.all([upcReady(), photoReady(), fileToCanvas(file, 1600)]).then(function (got) {
      U = got[0];
      P = got[1];
      var canvas = got[2];
      try {
        var s = document.createElement("canvas");
        var k = Math.min(1, 768 / Math.max(canvas.width, canvas.height));
        s.width = Math.round(canvas.width * k);
        s.height = Math.round(canvas.height * k);
        s.getContext("2d").drawImage(canvas, 0, 0, s.width, s.height);
        small = s.toDataURL("image/jpeg", 0.8);
        res.photo.preview = small;
      } catch (err) { small = ""; }
      step("Reading the text on the photo (on this phone)…", 0);
      return P.ocr(ocrCanvas(canvas), o.loadScript, function (status, pct) {
        step(/recogniz/i.test(status) ? "Reading the text on the photo (on this phone)…" : "Getting the photo reader ready (first time only)…", pct);
      });
    }).then(function (read) {
      if (ui.res !== res) return null;
      var assort = upc.assortJson ? Object.keys(upc.assortJson.assortments || {}).concat(Object.keys(upc.assortJson.aliases || {})) : ["FYJ44", "C4982"];
      var ext = P.extract(read.text, { assort: assort });
      res.photo.ext = ext;
      res.photo.confidence = read.confidence;
      res.photo.links = P.searchLinks(ext, U.AMAZON_TAG);
      /* a case-box label or a card code with the case letter: show the whole case */
      var caseQ = o.findCase ? o.findCase(read.text) : null;
      if (caseQ && o.presentCase) {
        ui.res = null;
        o.presentCase(caseQ);
        return { caseQ: caseQ, ext: ext };
      }
      step("Checking Hunt for the codes and words…", null);
      return resolveCode(U, ext).then(function (code) {
        if (code && o.presentScan) {
          /* a code on the photo goes through the normal scan path (buy list, catalog, assortment picker, web UPC) */
          ui.res = null;
          o.presentScan(code, ext);
          return { code: code, ext: ext };
        }
        var vurl = P.visionUrl(window.localStorage);
        res.photo.vision = !!vurl;
        return Promise.all([
          photoPool(U),
          webTextSearch(P, ext),
          vurl ? P.askVision(vurl, small, ext.text) : Promise.resolve([]),
        ]).then(function (parts) {
          if (ui.res !== res) return null;
          var local = P.rank(parts[0], ext.words, 5, 0.5).map(function (r) { return Object.assign({}, r.item, { score: r.score }); });
          var cands = parts[2].concat(parts[1], local);
          cands.sort(function (a, b) { return b.score - a.score; });
          res.photo.cands = cands.slice(0, 5);
          res.photo.step = "";
          paintRes();
          return { ext: ext, cands: res.photo.cands };
        });
      });
    }).catch(function (err) {
      if (ui.res !== res) return null;
      res.photo.step = "";
      res.photo.error = "The photo reader did not load or could not read this photo. Check the connection, or type the code.";
      paintRes();
      return null;
    });
  }

  /* first code on the photo that Hunt or the web can resolve: item code, then UPC, then assortment */
  function resolveCode(U, ext) {
    var tries = ext.mattel.map(function (c) {
      return Promise.all([
        upc.assort ? upc.assort.itemByCode(c).catch(function () { return null; }) : null,
        upc.index.find(c).catch(function () { return []; }),
        upc.cache.learned("code:" + c).catch(function () { return null; }),
      ]).then(function (got) { return got[0] || (got[1] && got[1].length) || got[2] ? c : null; });
    });
    return Promise.all(tries).then(function (hits) {
      var mk = hits.filter(Boolean)[0];
      if (mk) return mk;
      if (ext.upcs.length) return ext.upcs[0];
      if (ext.assort.length) return ext.assort[0];
      if (ext.mattel.length === 1 && !ext.words.length) return ext.mattel[0];
      return null;
    });
  }

  function photoHtml(res) {
    var ph = res.photo;
    var html = "";
    if (ph.chosen) return candidateHtml(res, ph.chosen);
    if (ph.step) html += '<p class="fine upc-status" role="status"><span id="photo-step">' + esc(ph.step) + (ph.progress ? " " + Math.round(ph.progress * 100) + "%" : "") + "</span></p>" +
      '<p class="fine">The photo stays on this phone. The first read downloads the free text reader (about 7 MB) from jsDelivr.</p>';
    if (ph.error) html += '<p class="fine is-error" role="alert">' + esc(ph.error) + "</p>";
    if (!ph.step && ph.ext) {
      if (ph.cands.length) {
        html += '<section class="upc-card photo-cands" aria-label="Best matches"><p class="kicker">Best matches from the photo</p>' +
          ph.cands.map(function (c, i) {
            return '<button type="button" class="stk-hit upc-row photo-cand" data-stk="photo-pick" data-v="' + i + '">' +
              '<span class="stk-thumb">' + (c.thumb ? '<img src="' + esc(c.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-upc-img="1">' : "<b>" + esc(D.label(D.LANES, c.lane || "other").slice(0, 2).toUpperCase()) + "</b>") + "</span>" +
              "<span><b>" + esc(c.name) + "</b><span>" + esc([c.line, c.code, c.source].filter(Boolean).join(" · ")) + "</span>" +
              '<span class="photo-conf">' + Math.round((c.score || 0) * 100) + "% match</span></span></button>";
          }).join("") + '<p class="fine">Tap the one in your hand. A photo match is a guess until you check the card.</p></section>';
      } else {
        html += '<section class="upc-card is-miss"><p><b>Hunt could not match this photo.</b> Search the web with the words it read, or try Google Lens with the same photo.</p></section>';
      }
      html += readTextHtml(ph) + linkList(ph.links);
      if (!ph.vision) html += '<p class="fine">Optional: an AI photo match can be turned on with your own vision proxy (off by default). See Scan settings below.</p>';
    }
    return html;
  }

  function readTextHtml(ph) {
    var e = ph.ext;
    var found = [].concat(e.mattel.map(function (c) { return "Item code " + c; }), e.assort.map(function (c) { return "Asst. " + c; }), e.upcs.map(function (c) { return "UPC " + c; }), e.sets.map(function (c) { return "Card " + c.raw; }), e.lego.map(function (c) { return "Set " + c; }));
    return '<details class="photo-read"><summary>What Hunt read on the photo</summary>' +
      (found.length ? '<p class="fine">' + esc(found.join(" · ")) + "</p>" : "") +
      "<pre>" + esc((e.text || "(no text found)").slice(0, 800)) + "</pre></details>";
  }

  function candidateHtml(res, c) {
    var ctx = res.ctx;
    var primary = ctx === "show" ? "Add to stock (at show)" : "Add to tracker";
    var img = c.image || c.thumb || "";
    var facts = [["Brand", c.brand], ["Lane", c.lane ? D.label(D.LANES, c.lane) : ""], ["Line", c.line], ["Year", c.year], ["Code", c.code], ["Market", c.marketPrice != null ? money(c.marketPrice) + " (TCGplayer market)" : ""], ["Match", Math.round((c.score || 0) * 100) + "%"]].filter(function (f) { return f[1]; });
    var web = /^https:\/\//.test(c.sourceUrl || "") && !/Hunt|tracker|Learned/i.test(c.source || "");
    return '<section class="upc-card upc-picked" aria-label="Photo match">' +
      '<p class="kicker">From your photo · ' + esc(c.source || "") + "</p>" +
      '<div class="upc-head">' + (img ? '<span class="upc-img"><img src="' + esc(img) + '" alt="' + esc(c.name) + '" loading="lazy" referrerpolicy="no-referrer" data-upc-img="1"></span>' : "") +
      '<div class="upc-copy"><h3>' + esc(c.cardName || c.name) + "</h3>" +
      '<dl class="upc-facts">' + facts.map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("") + "</dl></div></div>" +
      '<div class="stk-actions"><button class="solid" type="button" data-stk="res-add">' + esc(primary) + "</button>" +
      '<button class="ghost" type="button" data-stk="res-edit">Edit, then add</button>' +
      '<button class="ghost" type="button" data-stk="photo-back">Not this one</button></div>' +
      (web ? shareLinkHtml({ name: c.name, upc: "", codes: c.code ? [c.code.replace(/^\S+\s(?=\d+\/\d+$)/, "")] : [], brand: c.brand, lane: c.lane, line: c.line, year: c.year, imageUrl: c.image || c.thumb, sourceUrl: c.sourceUrl, source: c.source }) : "") +
      "</section>" + readTextHtml(res.photo);
  }

  function candidateDraft(c, d) {
    if (!d.name) d.name = c.mt ? "Hot Wheels Monster Trucks " + c.name + (c.year ? " (" + c.year + ")" : "") : c.name;
    if (!d.code) d.code = c.code ? String(c.code).replace(/^\S+\s(?=\d+\/\d+$)/, "") : "";
    if (!d.lane || d.lane === "other") d.lane = c.lane || "other";
    if (!d.brand) d.brand = c.brand || "";
    if (!d.imageUrl && !d.photo) d.imageUrl = absUrl(c.image || c.thumb || "");
    if (!d.description && c.line) d.description = c.line;
    if (c.compId && !d.compId) d.compId = c.compId;
    if (!d.lookupSource) { d.lookupSource = (c.source || "Photo match"); d.lookupUrl = /^https:\/\//.test(c.sourceUrl || "") ? c.sourceUrl : ""; }
    if (!d.notes) d.notes = "Identified from a photo (" + Math.round((c.score || 0) * 100) + "% match). Check the card.";
    if (!d.condition && /pokemon|funko|lego|hot-wheels|matchbox/.test(d.lane)) d.condition = d.lane === "pokemon" ? "" : "New / sealed";
    return D.normalize(d);
  }

  /* save=true: one tap. Saves straight to the tracker (form context: merges with what you typed). */
  function resToDraft(save) {
    var res = ui.res;
    if (!res) return;
    if (res.ctx === "form") {
      var cur = readForm();
      var merged = resDraft(res, cur);
      merged.id = cur.id || "";
      ui.draft = merged;
      flash(save ? "Details filled from " + ((res.web && res.web.result && res.web.result.sourceName) || "Hunt") + ". Check the card, then save." : "Details filled.");
      ui.res = null;
      rerender();
      return;
    }
    var d = resDraft(res, null);
    if (!save) {
      ui.draft = d;
      ui.draftFor = "new";
      ui.res = null;
      closeAppSheet();
      flash("Filled from " + ((res.web && res.web.result && res.web.result.sourceName) || "Hunt") + ". Edit anything, then add.");
      go("tracker", "add");
      return;
    }
    if (!d.name) { ui.draft = d; ui.draftFor = "new"; ui.res = null; closeAppSheet(); flash("Give the item a name.", "error"); go("tracker", "add"); return; }
    store.save(d).then(function (saved) {
      learnFrom(saved);
      ui.res = null;
      closeAppSheet();
      if (res.ctx === "show") {
        flash("Added " + saved.name + " to your table. Add your cost in the tracker.");
        rerender();
        return;
      }
      flash("Added " + saved.name + " to stock. Add your cost below.");
      go("tracker", "item/" + saved.id);
    }).catch(function () {
      flash("Could not save on this phone. Storage may be full.", "error");
      rerender();
    });
  }

  /* Web photos can 404 or block hotlinks. Try the next photo, then the Hunt placeholder. */
  document.addEventListener("error", function (event) {
    var img = event.target;
    if (!img || img.tagName !== "IMG" || !img.getAttribute("data-upc-img")) return;
    event.stopImmediatePropagation();
    var alts = String(img.getAttribute("data-alts") || "").split(" ").filter(Boolean);
    if (alts.length) {
      img.setAttribute("data-alts", alts.slice(1).join(" "));
      img.src = alts[0];
      return;
    }
    var thumbBtn = img.closest && img.closest(".upc-thumb");
    if (thumbBtn) { thumbBtn.hidden = true; return; }
    img.removeAttribute("data-upc-img");
    img.setAttribute("data-fallback", "1");
    img.src = "assets/states/photo-needed.svg";
  }, true);

  /* ---------- events ---------- */
  document.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-stk]");
    if (!btn) return;
    var act = btn.getAttribute("data-stk");
    var id = btn.getAttribute("data-id");
    var v = btn.getAttribute("data-v");
    if (act === "add") { ui.draft = null; ui.draftFor = ""; go("tracker", "add"); return; }
    if (act === "open") { go("tracker", "item/" + id); return; }
    if (act === "edit") { ui.draft = null; ui.draftFor = ""; go("tracker", "edit/" + id); return; }
    if (act === "cancel") { ui.draft = null; ui.draftFor = ""; history.length > 1 ? history.back() : go("tracker", ""); return; }
    if (act === "go-show") { go("show", ""); return; }
    if (act === "go-tracker") { go("tracker", ""); return; }
    if (act === "lane") { ui.lane = v; rerender(); return; }
    if (act === "status") { ui.status = v; rerender(); return; }
    if (act === "pay") { ui.pay = v; writePref("hunt-show-pay", v); rerender(); return; }
    if (act === "scan-add") { scanThen(onScanAdd); return; }
    if (act === "scan-fill") {
      readForm();
      scanThen(function (code) {
        if (!code) return;
        var d = ui.draft;
        d.code = code;
        var hits = P.byCode(comps, code);
        if (hits.length === 1) { applyComp(hits[0]); ui.draft.code = code; flash("Matched " + hits[0].name + "."); }
        else if (hits.length > 1) { ui.pickQ = hits[0].name; flash(hits.length + " items share this code. Pick one."); }
        else flash("Code saved. Checking Hunt's catalog and the web…");
        if (hits.length !== 1) startLookup(code, "form");
        rerender();
      });
      return;
    }
    if (act === "scan-show") {
      scanThen(function (code) { if (!code) return; ui.showQ = code; startLookup(code, "show"); rerender(); });
      return;
    }
    if (act === "pick") { var c = compIndex[btn.getAttribute("data-comp")]; if (c) { applyComp(c); rerender(); } return; }
    if (act === "lookup-code") { readForm(); if (ui.draft && ui.draft.code) { startLookup(ui.draft.code, "form"); rerender(); } return; }
    if (act === "res-img") { if (ui.res) { ui.res.pick = Number(v) || 0; paintRes(); } return; }
    if (act === "photo-pick") {
      if (ui.res && ui.res.photo) { ui.res.photo.chosen = ui.res.photo.cands[parseInt(v, 10)] || null; paintRes(); scrollRes(); }
      return;
    }
    if (act === "photo-back") { if (ui.res && ui.res.photo) { ui.res.photo.chosen = null; paintRes(); } return; }
    if (act === "learned-open") { openLearned(v); return; }
    if (act === "assort-pick") {
      if (ui.res && ui.res.assortItems) {
        var pickIt = ui.res.assortItems[parseInt(v, 10)];
        if (pickIt) { ui.res.assortPick = pickIt; paintRes(); scrollRes(); }
      }
      return;
    }
    if (act === "assort-back") { if (ui.res) { ui.res.assortPick = null; paintRes(); } return; }
    if (act === "assort-all") { if (ui.res) { ui.res.assortAll = true; paintRes(); } return; }
    if (act === "assort-code-lookup") { if (ui.res && v) startLookup(v, ui.res.ctx, ui.res.el); return; }
    if (act === "res-index") { if (ui.res) { ui.res.chosen = ui.res.chosen === v ? "" : v; paintRes(); } return; }
    if (act === "res-open") { closeAppSheet(); ui.res = null; go("tracker", "item/" + id); return; }
    if (act === "res-edit") { resToDraft(false); return; }
    if (act === "res-add") { resToDraft(true); return; }
    if (act === "res-retry") { if (ui.res) startLookup(ui.res.code, ui.res.ctx, ui.res.el, true); return; }
    if (act === "unlink") { readForm(); ui.draft.compId = ""; rerender(); return; }
    if (act === "clear-photo") { readForm(); ui.draft.photo = ""; rerender(); return; }
    if (act === "add-from-comp") {
      var comp = compIndex[btn.getAttribute("data-comp")];
      var fromSheet = !!(ui.res && ui.res.ctx === "sheet");
      if (fromSheet) closeAppSheet();
      ui.draft = D.normalize({ purchaseDate: D.today(), qty: 1, status: fromSheet ? "in-stock" : "at-show", code: fromSheet ? ui.res.code : "" });
      ui.res = null;
      ui.draft.id = "";
      ui.draftFor = "new";
      if (comp) applyComp(comp);
      go("tracker", "add");
      return;
    }
    if (act === "sell") { sell(id, Number(btn.getAttribute("data-price")), 1); return; }
    if (act === "sell-lot") {
      var lq = Number(btn.getAttribute("data-qty"));
      sell(id, Number(btn.getAttribute("data-price")) / lq, lq);
      return;
    }
    if (act === "custom") { ui.customFor = ui.customFor === id ? "" : id; rerender(); var f = document.getElementById("stk-custom-price"); if (f) f.focus(); return; }
    if (act === "undo-sale") { if (ui.lastSale) undo(ui.lastSale.itemId, ui.lastSale.saleId); return; }
    if (act === "undo-this") { undo(id, btn.getAttribute("data-sale")); return; }
    if (act === "set-status") {
      var it = store.get(id);
      if (!it) return;
      it.status = v;
      store.save(it).then(function () { flash("Status: " + D.label(D.STATUSES, v) + "."); rerender(); });
      return;
    }
    if (act === "delete") {
      var gone = store.get(id);
      if (!gone || !window.confirm("Delete " + gone.name + " and its sales from this phone?")) return;
      store.remove(id).then(function () { flash("Deleted."); go("tracker", ""); });
      return;
    }
    if (act === "export-csv") { download("hunt-inventory-" + D.today() + ".csv", D.toCsv(store.all())); return; }
    if (act === "export-shopify") { download("hunt-shopify-products-" + D.today() + ".csv", D.toShopifyCsv(store.all(), shopifyPrice)); return; }
    if (act === "import-csv") { var fi = document.getElementById("stk-csv-file"); if (fi) fi.click(); return; }
    if (act === "import-book") { importBook(); return; }
  });

  document.addEventListener("input", function (event) {
    var t = event.target;
    if (t.id === "stk-q") {
      ui.q = t.value;
      var list = document.getElementById("stk-list");
      if (list) list.innerHTML = listHtml();
      return;
    }
    if (t.id === "stk-show-q") {
      ui.showQ = t.value;
      ui.customFor = "";
      if (looksLikeCode(t.value) && !(ui.res && codeEq(ui.res.code, t.value))) startLookup(t.value.trim(), "show");
      var box = document.getElementById("stk-show-results");
      if (box) box.innerHTML = showResultsHtml();
      return;
    }
    if (t.id === "upc-item-code" && ui.res && ui.res.assort) {
      ui.res.assortQ = t.value;
      var mkey = upc.lib && upc.lib.mattelKey(t.value.replace(/\s+/g, ""));
      var exact = mkey && (ui.res.assortItems || []).filter(function (it) { return it.code === mkey; });
      if (exact && exact.length === 1) { ui.res.assortPick = exact[0]; paintRes(); scrollRes(); return; }
      var lst = document.getElementById("upc-assort-list");
      if (lst) lst.innerHTML = assortListHtml(ui.res);
      return;
    }
    if (t.id === "stk-pick-q") {
      ui.pickQ = t.value;
      var hits = document.getElementById("stk-pick-hits");
      if (hits) hits.innerHTML = pickHits();
      return;
    }
    if (t.closest && t.closest("#stk-form")) readForm();
  });

  document.addEventListener("change", function (event) {
    var t = event.target;
    if (t.id === "stk-photo" && t.files && t.files[0]) {
      readForm();
      downscale(t.files[0]).then(function (url) { ui.draft.photo = url; rerender(); }).catch(function () { flash("That photo could not be read.", "error"); rerender(); });
      return;
    }
    if (t.id === "stk-csv-file" && t.files && t.files[0]) {
      var reader = new FileReader();
      reader.onload = function () {
        var res = D.fromCsv(reader.result);
        if (!res.ok || !res.items.length) { flash(res.error || "No rows found.", "error"); rerender(); return; }
        store.saveAll(res.items).then(function () { flash("Imported " + res.items.length + " rows."); rerender(); });
      };
      reader.readAsText(t.files[0]);
      t.value = "";
      return;
    }
    if (t.closest && t.closest("#stk-form")) readForm();
  });

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (form.id === "stk-form") { event.preventDefault(); saveForm(); return; }
    if (form.id === "stk-sale-form") {
      event.preventDefault();
      var item = store.get(form.getAttribute("data-id"));
      if (!item) return;
      var res = D.recordSale(item, {
        price: document.getElementById("stk-sale-price").value,
        qty: document.getElementById("stk-sale-qty").value,
        channel: document.getElementById("stk-sale-channel").value,
        pay: document.getElementById("stk-sale-pay").value,
        date: document.getElementById("stk-sale-date").value || D.today(),
      });
      if (!res.ok) { flash(res.error, "error"); rerender(); return; }
      ui.lastSale = { itemId: item.id, saleId: res.sale.id };
      store.save(item).then(function () { flash("Sale saved. " + item.qty + " left.", "sale"); rerender(); });
      return;
    }
    if (form.classList && form.classList.contains("stk-custom")) {
      event.preventDefault();
      var price = Number(document.getElementById("stk-custom-price").value);
      if (!(price >= 0) || document.getElementById("stk-custom-price").value === "") return;
      sell(form.getAttribute("data-id"), price, 1);
    }
  });

  window.HuntStock = {
    renderTracker: renderTracker,
    renderShow: renderShow,
    ensure: ensure,
    busy: function () {
      var sub = (app().stockSub ? app().stockSub() : "") || "";
      return /^(add|edit)/.test(sub) || !!ui.customFor;
    },
    store: store,
    lookupInto: lookupInto,
    lookup: startLookup,
    photoInto: photoInto,
    learnedSearch: learnedSearch,
    learnedList: learnedList,
    openLearned: openLearned,
    shareUrl: shareUrl,
    wipe: function () {
      ui.lastSale = null;
      ui.draft = null;
      setComps([]);
      ui.res = null;
      var clearUpc = upc.cache ? upc.cache.clear() : new Promise(function (resolve) {
        try {
          var req = window.indexedDB ? window.indexedDB.deleteDatabase("hunt-upc") : null;
          if (!req) { resolve(); return; }
          req.onsuccess = req.onerror = req.onblocked = function () { resolve(); };
        } catch (err) { resolve(); }
      });
      return Promise.all([store.clear().catch(function () {}), clearUpc.catch(function () {})]);
    },
    _ui: ui,
  };
})();
