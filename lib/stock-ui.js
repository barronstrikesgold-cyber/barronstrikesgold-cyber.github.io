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
      '<div class="stk-actions"><button class="solid" type="button" data-stk="scan-fill">Scan barcode or Mattel code</button></div>' +
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
      ui.draft = null;
      ui.draftFor = "";
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
    else flash("Code " + code + " is not in Hunt's catalog. Type the name.");
    go("tracker", "add");
  }

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
        else flash("Code saved. It is not in Hunt's catalog.");
        rerender();
      });
      return;
    }
    if (act === "scan-show") {
      scanThen(function (code) { if (!code) return; ui.showQ = code; rerender(); });
      return;
    }
    if (act === "pick") { var c = compIndex[btn.getAttribute("data-comp")]; if (c) { applyComp(c); rerender(); } return; }
    if (act === "unlink") { readForm(); ui.draft.compId = ""; rerender(); return; }
    if (act === "clear-photo") { readForm(); ui.draft.photo = ""; rerender(); return; }
    if (act === "add-from-comp") {
      var comp = compIndex[btn.getAttribute("data-comp")];
      ui.draft = D.normalize({ purchaseDate: D.today(), qty: 1, status: "at-show" });
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
      var box = document.getElementById("stk-show-results");
      if (box) box.innerHTML = showResultsHtml();
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
    wipe: function () {
      ui.lastSale = null;
      ui.draft = null;
      setComps([]);
      return store.clear().catch(function () {});
    },
    _ui: ui,
  };
})();
