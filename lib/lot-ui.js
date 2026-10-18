/* Hunt Lot offer: price a table, pile, or lot from one photo.
 * On this phone: drag a box around each car (or tap it), Hunt reads the text in that box and matches it to its comps.
 * Optional: the owner's own AI vision proxy can find the cars automatically (off by default; costs in docs/valuation.md).
 * Offer per piece = (expected sold × 0.87 − $5) × (1 − margin), commons floor, STH/TH/chase flags, low confidence = verify.
 * Rows and settings save on this phone (localStorage "hunt-lot"). The photo itself is never saved or uploaded. */
(function () {
  var V = window.HuntValue;
  if (!V) return;
  var KEY = "hunt-lot";
  var state = load();
  var photo = { canvas: null, small: "", busy: false, drag: null };
  var queue = Promise.resolve();
  var pool = null;
  var chase = null;
  var msg = "";

  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (err) { d = null; }
    d = d && typeof d === "object" ? d : {};
    var margin = V.num(d.margin);
    var floor = V.num(d.floor);
    return {
      margin: margin != null && margin >= 0 && margin < 0.95 ? margin : 0.3,
      floor: floor != null && floor >= 0 && floor <= 5 ? floor : 0.25,
      rows: (Array.isArray(d.rows) ? d.rows : []).slice(0, 200).map(cleanRow).filter(Boolean),
    };
  }
  function cleanRow(r) {
    if (!r || typeof r !== "object") return null;
    var box = Array.isArray(r.box) && r.box.length === 4 && r.box.every(function (n) { return typeof n === "number" && n >= 0 && n <= 1; }) ? r.box : null;
    return {
      id: String(r.id || Math.random().toString(36).slice(2, 10)),
      name: String(r.name || "").slice(0, 140),
      lane: String(r.lane || "hot-wheels").slice(0, 30),
      qty: Math.max(1, Math.min(999, Math.floor(Number(r.qty) || 1))),
      sold: V.num(r.sold),
      source: String(r.source || "").slice(0, 160),
      url: /^https:\/\//.test(r.url || "") ? String(r.url) : "",
      date: String(r.date || "").slice(0, 20),
      compId: String(r.compId || "").slice(0, 80),
      score: V.num(r.score),
      flags: (Array.isArray(r.flags) ? r.flags : []).map(String).slice(0, 4),
      offer: V.num(r.offer),
      auto: r.auto !== false,
      basis: String(r.basis || ""),
      note: String(r.note || "").slice(0, 160),
      verify: !!r.verify,
      status: r.status === "reading" ? "" : String(r.status || ""),
      read: String(r.read || "").slice(0, 200),
      box: box,
    };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ margin: state.margin, floor: state.floor, rows: state.rows.map(function (r) { var c = Object.assign({}, r); delete c.thumb; delete c.cands; return c; }) })); } catch (err) { /* storage full or blocked */ }
  }

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { var v = Number(n); return n == null || !isFinite(v) ? "—" : (v < 0 ? "-$" : "$") + Math.abs(v).toFixed(2); }
  function app() { return window.HuntApp || {}; }
  function stock() { return window.HuntStock || {}; }
  function P() { return window.HuntShowPricing; }

  /* ---------- pricing ---------- */
  function price(r) {
    var o = V.offer(r.sold, { margin: state.margin, floor: state.floor, confidence: r.score });
    r.net = o.net;
    if (r.auto) { r.offer = o.offer; r.basis = o.basis; r.note = o.note; }
    r.verify = o.verify || !r.name;
    return r;
  }
  function chaseLists() {
    if (chase) return Promise.resolve(chase);
    return fetch("data/hw/cases-2026.json", { credentials: "omit" }).then(function (res) { return res.ok ? res.json() : {}; }).catch(function () { return {}; }).then(function (j) {
      chase = { sth: {}, th: {} };
      var f = P() ? P().fold : function (s) { return String(s).toLowerCase(); };
      Object.keys((j && j.cases) || {}).forEach(function (k) {
        (j.cases[k].sth || []).forEach(function (n) { chase.sth[f(n)] = true; });
        (j.cases[k].th || []).forEach(function (n) { chase.th[f(n)] = true; });
      });
      return chase;
    });
  }
  function flagsFor(r) {
    var out = V.flags(r.name, r.read, r.lane);
    if (chase && P() && r.name) {
      var k = P().fold(r.name);
      if (chase.th[k] && out.indexOf("TH") === -1) out.push("TH");
      if (chase.sth[k] && out.indexOf("STH") === -1) out.push("STH?");
    }
    return out;
  }
  function compById(id) {
    var list = stock().comps ? stock().comps() : [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function applyComp(r, c, score) {
    r.name = c.name;
    r.lane = c.lane || r.lane;
    r.compId = c.id;
    r.sold = c.value != null ? c.value : null;
    r.source = c.value != null ? c.source || "Hunt comp" : "";
    r.url = c.value != null ? c.url || "" : "";
    r.date = c.value != null ? c.date || "" : "";
    r.score = score;
  }
  /* name typed or picked: exact comp = sure; a search hit = verify; nothing = name only */
  function matchName(r, name) {
    r.name = String(name || "").trim().slice(0, 140);
    r.compId = ""; r.sold = null; r.source = ""; r.url = ""; r.date = "";
    var list = stock().comps ? stock().comps() : [];
    var hits = P() && r.name ? P().search(list, r.name, 3) : [];
    var exact = hits.filter(function (c) { return P().fold(c.name) === P().fold(r.name); })[0];
    if (exact) applyComp(r, exact, 1);
    else if (hits[0]) { applyComp(r, hits[0], 0.55); r.name = hits[0].name; }
    else r.score = r.name ? 0.5 : 0;
    r.flags = flagsFor(r);
    return price(r);
  }

  /* ---------- photo, boxes, reading ---------- */
  function loadPool() {
    if (pool) return Promise.resolve(pool);
    return (stock().photoPool ? stock().photoPool() : Promise.resolve([])).then(function (p) { pool = p || []; return pool; }).catch(function () { pool = []; return pool; });
  }
  function photoLib() { return window.HuntPhoto ? Promise.resolve(window.HuntPhoto) : app().loadPhoto ? app().loadPhoto() : Promise.reject(new Error("photo")); }

  function cropCanvas(box, minW) {
    var c = photo.canvas;
    var x = Math.round(box[0] * c.width), y = Math.round(box[1] * c.height), w = Math.max(4, Math.round(box[2] * c.width)), h = Math.max(4, Math.round(box[3] * c.height));
    var k = Math.max(1, (minW || 0) / w);
    var out = document.createElement("canvas");
    out.width = Math.round(w * k); out.height = Math.round(h * k);
    out.getContext("2d").drawImage(c, x, y, w, h, 0, 0, out.width, out.height);
    return out;
  }
  function thumbOf(box) {
    try { var t = cropCanvas(box, 0); var s = document.createElement("canvas"); var k = 96 / Math.max(t.width, t.height); s.width = Math.max(1, Math.round(t.width * k)); s.height = Math.max(1, Math.round(t.height * k)); s.getContext("2d").drawImage(t, 0, 0, s.width, s.height); return s.toDataURL("image/jpeg", 0.7); } catch (err) { return ""; }
  }

  function readBox(r) {
    r.status = "reading";
    paintRows();
    queue = queue.then(function () {
      return Promise.all([photoLib(), loadPool(), chaseLists()]).then(function (got) {
        var PH = got[0];
        var crop = cropCanvas(r.box, 700);
        var src = stock().ocrCanvas ? stock().ocrCanvas(crop) : crop;
        return PH.ocr(src, app().loadScript, function (st, pct) { setMsg((/recogniz/i.test(st) ? "Reading box " : "Getting the reader ready for box ") + (state.rows.indexOf(r) + 1) + "… " + Math.round((pct || 0) * 100) + "%"); }).then(function (read) {
          var ext = PH.extract(read.text, {});
          r.read = String(read.text || "").replace(/\s+/g, " ").trim().slice(0, 200);
          var hits = PH.rank(got[1], ext.words, 3, 0.5);
          r.cands = hits.map(function (h) { return { name: h.item.name, compId: h.item.compId || "", lane: h.item.lane, score: h.score }; });
          if (hits.length) {
            var top = hits[0];
            var c = top.item.compId ? compById(top.item.compId) : null;
            if (c) applyComp(r, c, top.score);
            else { r.name = top.item.name; r.lane = top.item.lane || r.lane; r.score = top.score; r.compId = ""; r.sold = null; }
            r.status = "";
          } else {
            r.status = "unread";
            r.score = 0;
          }
          r.flags = flagsFor(r);
          price(r);
        });
      }).catch(function () { r.status = "unread"; price(r); })
        .then(function () { save(); setMsg(""); paintRows(); });
    });
    return queue;
  }

  function addBox(box) {
    var r = cleanRow({ box: box, qty: 1, lane: "hot-wheels" });
    r.thumb = thumbOf(box);
    state.rows.push(price(r));
    save();
    paintCanvas();
    readBox(r);
  }

  function onPhoto(file) {
    if (!file || !stock().fileToCanvas) return;
    setMsg("Loading the photo…");
    stock().fileToCanvas(file, 2000).then(function (c) {
      photo.canvas = c;
      var s = document.createElement("canvas");
      var k = Math.min(1, 1024 / Math.max(c.width, c.height));
      s.width = Math.round(c.width * k); s.height = Math.round(c.height * k);
      s.getContext("2d").drawImage(c, 0, 0, s.width, s.height);
      photo.small = s.toDataURL("image/jpeg", 0.8);
      state.rows.forEach(function (r) { r.box = null; r.thumb = ""; });
      setMsg("Drag a box around each car, or tap a car to drop a box. Hunt reads each box on this phone.");
      paint();
    }).catch(function () { setMsg("That photo could not be read."); });
  }

  /* optional: owner's AI vision proxy finds the cars. POST {image, mode:"detect"} to <proxy>/detect -> {items:[{name, confidence, box:[x,y,w,h]}]} */
  function detect() {
    var PHurl = window.HuntPhoto && window.HuntPhoto.visionUrl ? window.HuntPhoto.visionUrl(window.localStorage) : "";
    if (!PHurl || !photo.small) return;
    setMsg("Asking your AI vision proxy to find the cars…");
    fetch(PHurl.replace(/\/+$/, "") + "/detect", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit", referrerPolicy: "no-referrer", body: JSON.stringify({ image: photo.small, mode: "detect" }) })
      .then(function (res) { return res.ok ? res.json() : { items: [] }; })
      .then(function (j) {
        return chaseLists().then(function () { return j; });
      })
      .then(function (j) {
        var items = (j && Array.isArray(j.items) ? j.items : []).slice(0, 60);
        var n = 0;
        items.forEach(function (it) {
          var b = Array.isArray(it.box) && it.box.length === 4 ? it.box.map(Number) : null;
          if (b && !b.every(function (v) { return isFinite(v) && v >= 0 && v <= 1; })) b = null;
          var r = cleanRow({ box: b, lane: String(it.lane || "hot-wheels") });
          matchName(r, String(it.name || ""));
          var conf = Math.max(0, Math.min(1, Number(it.confidence) || 0.5));
          r.score = Math.min(r.score == null ? conf : r.score, conf);
          r.status = "ai";
          if (b) r.thumb = thumbOf(b);
          state.rows.push(price(r));
          n++;
        });
        save();
        setMsg(n ? "Your proxy found " + n + ". Check each one; AI guesses are marked verify when unsure." : "Your proxy found no cars. Box them by hand.");
        paint();
      }).catch(function () { setMsg("Your AI proxy did not answer. Box the cars by hand."); });
  }

  /* ---------- painting ---------- */
  function setMsg(t) { msg = t; var el = document.getElementById("lot-msg"); if (el) el.textContent = t; }

  function paintCanvas() {
    var cv = document.getElementById("lot-canvas");
    if (!cv || !photo.canvas) return;
    var c = photo.canvas;
    var k = Math.min(1, 1200 / Math.max(c.width, c.height));
    cv.width = Math.round(c.width * k); cv.height = Math.round(c.height * k);
    var ctx = cv.getContext("2d");
    ctx.drawImage(c, 0, 0, cv.width, cv.height);
    var lw = Math.max(2, Math.round(cv.width / 300));
    var all = state.rows.map(function (r, i) { return { b: r.box, n: i + 1, v: r.verify }; });
    if (photo.drag) all.push({ b: photo.drag.box, n: "", v: false });
    all.forEach(function (o) {
      if (!o.b) return;
      var x = o.b[0] * cv.width, y = o.b[1] * cv.height, w = o.b[2] * cv.width, h = o.b[3] * cv.height;
      ctx.lineWidth = lw;
      ctx.strokeStyle = o.v ? "#f5c518" : "#ff5a1f";
      ctx.strokeRect(x, y, w, h);
      if (o.n !== "") {
        var fs = Math.max(14, Math.round(cv.width / 28));
        ctx.font = "700 " + fs + "px system-ui, sans-serif";
        ctx.fillStyle = o.v ? "#f5c518" : "#ff5a1f";
        ctx.fillRect(x, y, fs * 1.4, fs * 1.3);
        ctx.fillStyle = "#111";
        ctx.fillText(String(o.n), x + fs * 0.3, y + fs * 1.0);
      }
    });
  }

  function rowHtml(r, i) {
    var flags = (r.flags || []).map(function (f) { return '<span class="lot-flag">' + esc(f) + "</span>"; }).join("");
    var status = r.status === "reading" ? '<span class="lot-status">Reading…</span>' : r.status === "unread" ? '<span class="lot-status is-warn">No text found. Type the name.</span>' : r.status === "ai" ? '<span class="lot-status">AI guess</span>' : "";
    var cands = (r.cands || []).length > 1 ? '<select class="lot-cand" data-lot-cand="' + esc(r.id) + '" aria-label="Other matches for ' + (i + 1) + '"><option value="">Other matches</option>' + r.cands.slice(1).map(function (c, k) { return '<option value="' + (k + 1) + '">' + esc(c.name) + " (" + Math.round(c.score * 100) + "%)</option>"; }).join("") + "</select>" : "";
    return '<li class="lot-row' + (r.verify ? " is-verify" : "") + '" data-row="' + esc(r.id) + '">' +
      '<span class="lot-n">' + (i + 1) + "</span>" +
      (r.thumb ? '<img class="lot-thumb" src="' + esc(r.thumb) + '" alt="">' : "") +
      '<div class="lot-main">' +
      '<label class="field lot-name"><span>Item ' + (i + 1) + '</span><input data-lot-f="name" data-id="' + esc(r.id) + '" value="' + esc(r.name) + '" placeholder="Type the car name" autocomplete="off" list="lot-names"></label>' +
      '<p class="lot-meta">' + flags + status +
      (r.score != null && r.name ? '<span>' + Math.round(r.score * 100) + "% match</span>" : "") +
      (r.verify ? '<span class="lot-verify">Verify</span>' : "") +
      "</p>" + cands +
      '<p class="fine">' + (r.sold != null ? "Expected sold " + money(r.sold) + " · " + esc(r.source || "") + (r.date ? " · " + esc(r.date) : "") + (r.url ? ' · <a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">source</a>' : "") + " · net " + money(V.net(r.sold)) : "No sold comp: commons floor. Type a sold price if you know one.") + "</p>" +
      '<p class="fine">' + esc(r.note || "") + (r.auto ? "" : " · You set this offer.") + "</p>" +
      "</div>" +
      '<div class="lot-nums">' +
      '<label class="field"><span>Qty</span><input data-lot-f="qty" data-id="' + esc(r.id) + '" type="number" inputmode="numeric" min="1" value="' + esc(r.qty) + '"></label>' +
      '<label class="field"><span>Sold $</span><input data-lot-f="sold" data-id="' + esc(r.id) + '" type="number" inputmode="decimal" step="0.01" min="0" value="' + esc(r.sold != null ? r.sold : "") + '"></label>' +
      '<label class="field lot-offer"><span>Offer $</span><input data-lot-f="offer" data-id="' + esc(r.id) + '" type="number" inputmode="decimal" step="0.25" min="0" value="' + esc(r.offer != null ? r.offer : "") + '"></label>' +
      '<button class="stk-link" type="button" data-lot="remove" data-id="' + esc(r.id) + '">Remove</button>' +
      "</div></li>";
  }

  function totalsHtml() {
    var t = V.lotTotals(state.rows);
    return '<div class="lot-total"><span><em>Pieces</em><b>' + t.count + "</b></span><span class=\"is-hot\"><em>Your offer</em><b>" + money(t.offer) + "</b></span><span><em>Expected sold</em><b>" + money(t.expected) + "</b></span><span><em>Net after fees</em><b>" + money(t.net) + "</b></span><span><em>Est. profit</em><b>" + money(t.profit) + "</b></span></div>" +
      '<p class="fine">' + (t.verify ? t.verify + " to verify · " : "") + (t.flagged ? t.flagged + " flagged chase/TH · " : "") + "Profit counts only pieces with a sold comp; floor pieces add upside.</p>";
  }

  function paintRows() {
    var list = document.getElementById("lot-rows");
    if (list) list.innerHTML = state.rows.length ? state.rows.map(rowHtml).join("") : '<li class="fine">No pieces yet. Box cars on the photo, or add one by name.</li>';
    var tot = document.getElementById("lot-totals");
    if (tot) tot.innerHTML = totalsHtml();
    paintCanvas();
  }

  function paint() {
    var el = document.getElementById("lot-page");
    if (el && el.isConnected) {
      var wrap = document.createElement("div");
      wrap.innerHTML = render();
      if (wrap.firstChild) el.replaceWith(wrap.firstChild);
    }
    setTimeout(paintCanvas, 0);
  }

  function ruleText() {
    return "Max offer = (expected sold × 0.87 − $5) × " + Math.round((1 - state.margin) * 100) + "%. Pieces whose net is thin or unknown get the $" + Number(state.floor).toFixed(2) + " floor. Under 60% match = verify.";
  }

  function render() {
    chaseLists().then(function () { var changed = false; state.rows.forEach(function (r) { var f = flagsFor(r); if (f.join() !== (r.flags || []).join()) { r.flags = f; changed = true; } }); if (changed) paintRows(); });
    var vurl = window.HuntPhoto && window.HuntPhoto.visionUrl ? window.HuntPhoto.visionUrl(window.localStorage) : (function () { try { return localStorage.getItem("hunt-vision-proxy") || ""; } catch (e) { return ""; } })();
    setTimeout(paintCanvas, 0);
    var names = stock().comps ? stock().comps().filter(function (c) { return c.lane === "hot-wheels" || c.lane === "matchbox"; }).slice(0, 400) : [];
    return '<div id="lot-page" class="lot">' +
      '<nav class="crumbs" aria-label="Breadcrumb"><a href="#/home">Home</a><span class="crumb-sep" aria-hidden="true">/</span><a href="#/scan">Scan</a><span class="crumb-sep" aria-hidden="true">/</span><span>Lot offer</span></nav>' +
      "<h1>Lot offer</h1>" +
      '<p class="fine">Snap the whole table or pile. Box each car; Hunt reads it on this phone, matches it to its comps, and prices an offer per piece plus a lot total. The photo is never saved or uploaded' + (vurl ? " unless you tap Find cars with your AI proxy." : ".") + "</p>" +
      '<section class="tool lot-settings" aria-label="Offer settings"><p class="kicker">Offer rule</p>' +
      '<div class="lot-set"><label class="field"><span>Target profit (% of net)</span><input id="lot-margin" type="number" inputmode="numeric" min="0" max="90" step="5" value="' + Math.round(state.margin * 100) + '"></label>' +
      '<label class="field"><span>Commons floor $</span><input id="lot-floor" type="number" inputmode="decimal" min="0" max="5" step="0.25" value="' + esc(state.floor) + '"></label></div>' +
      '<p class="fine" id="lot-rule">' + ruleText() + "</p></section>" +
      '<section class="tool" aria-label="Photo"><p class="kicker">Photo</p>' +
      '<div class="stk-actions"><label class="solid photo-btn" for="lot-camera">Snap the lot</label><input id="lot-camera" class="photo-input" type="file" accept="image/*" capture="environment">' +
      '<label class="ghost photo-btn" for="lot-library">Pick a photo</label><input id="lot-library" class="photo-input" type="file" accept="image/*">' +
      (vurl && photo.canvas ? '<button class="ghost" type="button" data-lot="detect">Find cars (your AI proxy)</button>' : "") + "</div>" +
      (photo.canvas ? '<canvas id="lot-canvas" class="lot-canvas" role="img" aria-label="Lot photo. Drag a box around each car, or tap a car."></canvas>' : "") +
      '<p id="lot-msg" class="fine" role="status">' + esc(msg) + "</p>" +
      (photo.canvas ? "" : '<p class="fine">Tip: shoot from above in good light, cards facing up. Loose cars have no printed name, so expect to type those.</p>') +
      (vurl ? "" : '<p class="fine">Optional: automatic car finding needs your own AI vision proxy (off; see Scan settings and docs/valuation.md for costs).</p>') +
      "</section>" +
      '<section class="tool" aria-label="Pieces"><p class="kicker">Pieces</p>' +
      '<form id="lot-add-form" class="lot-add"><label class="field"><span>Add a piece by name</span><input id="lot-add" autocomplete="off" list="lot-names" placeholder="e.g. Drift-Ender"></label><button class="ghost" type="submit">Add</button></form>' +
      '<datalist id="lot-names">' + names.map(function (c) { return '<option value="' + esc(c.name) + '">'; }).join("") + "</datalist>" +
      '<ol id="lot-rows" class="lot-rows">' + (state.rows.length ? state.rows.map(rowHtml).join("") : '<li class="fine">No pieces yet. Box cars on the photo, or add one by name.</li>') + "</ol>" +
      '<div id="lot-totals">' + totalsHtml() + "</div>" +
      '<div class="stk-actions"><button class="solid" type="button" data-lot="share">Share offer sheet</button><button class="ghost" type="button" data-lot="csv">Export CSV</button><button class="danger" type="button" data-lot="clear">Clear lot</button></div>' +
      '<p class="fine">Offers use Hunt\'s published comps (one sold or guide value per item). Check a live sold search on big pieces before you pay. Not financial advice.</p></section></div>';
  }

  /* ---------- events ---------- */
  function rowById(id) { for (var i = 0; i < state.rows.length; i++) if (state.rows[i].id === id) return state.rows[i]; return null; }

  function canvasPoint(ev, cv) {
    var rect = cv.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height)) };
  }
  document.addEventListener("pointerdown", function (ev) {
    var cv = ev.target;
    if (!cv || cv.id !== "lot-canvas") return;
    ev.preventDefault();
    var p = canvasPoint(ev, cv);
    photo.drag = { x0: p.x, y0: p.y, box: [p.x, p.y, 0, 0] };
    try { cv.setPointerCapture(ev.pointerId); } catch (err) {}
  });
  document.addEventListener("pointermove", function (ev) {
    if (!photo.drag || !ev.target || ev.target.id !== "lot-canvas") return;
    var p = canvasPoint(ev, ev.target);
    var d = photo.drag;
    d.box = [Math.min(d.x0, p.x), Math.min(d.y0, p.y), Math.abs(p.x - d.x0), Math.abs(p.y - d.y0)];
    paintCanvas();
  });
  document.addEventListener("pointerup", function (ev) {
    if (!photo.drag) return;
    var d = photo.drag;
    photo.drag = null;
    var b = d.box;
    if (b[2] < 0.03 || b[3] < 0.03) {
      /* a tap: drop a box about one carded car wide, centered on the tap */
      var cv = document.getElementById("lot-canvas");
      var ratio = cv ? cv.width / cv.height : 1;
      var w = 0.22, h = Math.min(0.9, 0.22 * ratio * 1.4);
      b = [Math.max(0, Math.min(1 - w, d.x0 - w / 2)), Math.max(0, Math.min(1 - h, d.y0 - h / 2)), w, h];
    }
    addBox(b);
  });

  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (!t) return;
    if ((t.id === "lot-camera" || t.id === "lot-library") && t.files && t.files[0]) { onPhoto(t.files[0]); t.value = ""; return; }
    if (t.id === "lot-margin" || t.id === "lot-floor") {
      var m = Number(document.getElementById("lot-margin").value);
      var f = Number(document.getElementById("lot-floor").value);
      if (isFinite(m) && m >= 0 && m <= 90) state.margin = m / 100;
      if (isFinite(f) && f >= 0 && f <= 5) state.floor = f;
      state.rows.forEach(price);
      save();
      var rule = document.getElementById("lot-rule");
      if (rule) rule.textContent = ruleText();
      paintRows();
      return;
    }
    if (t.getAttribute && t.getAttribute("data-lot-cand")) {
      var rc = rowById(t.getAttribute("data-lot-cand"));
      var c = rc && rc.cands && rc.cands[Number(t.value)];
      if (!rc || !c) return;
      var comp = c.compId ? compById(c.compId) : null;
      if (comp) applyComp(rc, comp, c.score); else { rc.name = c.name; rc.score = c.score; rc.compId = ""; rc.sold = null; rc.source = ""; }
      rc.flags = flagsFor(rc);
      price(rc); save(); paintRows();
      return;
    }
    var field = t.getAttribute && t.getAttribute("data-lot-f");
    if (!field) return;
    var r = rowById(t.getAttribute("data-id"));
    if (!r) return;
    if (field === "name") { matchName(r, t.value); r.status = ""; save(); paintRows(); return; }
    if (field === "qty") r.qty = Math.max(1, Math.min(999, Math.floor(Number(t.value) || 1)));
    if (field === "sold") { var sv = t.value === "" ? null : Number(t.value); r.sold = sv != null && isFinite(sv) && sv >= 0 ? sv : null; r.source = r.sold != null ? "Your number" : ""; r.url = ""; r.date = ""; price(r); }
    if (field === "offer") { var ov = Number(t.value); if (t.value === "" ) { r.auto = true; price(r); } else if (isFinite(ov) && ov >= 0) { r.offer = Math.round(ov * 100) / 100; r.auto = false; } }
    save();
    if (field === "sold" || (field === "offer" && r.auto)) paintRows();
    else { var tot = document.getElementById("lot-totals"); if (tot) tot.innerHTML = totalsHtml(); }
  });

  document.addEventListener("submit", function (ev) {
    if (!ev.target || ev.target.id !== "lot-add-form") return;
    ev.preventDefault();
    var input = document.getElementById("lot-add");
    var name = input ? input.value.trim() : "";
    if (!name) return;
    chaseLists().then(function () {
      var r = cleanRow({ qty: 1 });
      matchName(r, name);
      state.rows.push(r);
      save();
      paintRows();
      var i2 = document.getElementById("lot-add");
      if (i2) { i2.value = ""; i2.focus(); }
    });
  });

  function download(name, text) {
    var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }

  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest("[data-lot]");
    if (!btn) return;
    var act = btn.getAttribute("data-lot");
    var settings = { margin: state.margin, floor: state.floor };
    if (act === "remove") { state.rows = state.rows.filter(function (r) { return r.id !== btn.getAttribute("data-id"); }); save(); paintRows(); return; }
    if (act === "detect") { detect(); return; }
    if (act === "csv") { download("hunt-lot-offer-" + today() + ".csv", V.lotCsv(state.rows, settings)); setMsg("Offer sheet saved as CSV."); return; }
    if (act === "share") {
      var text = V.lotText(state.rows, settings);
      if (navigator.share) { navigator.share({ title: "Hunt lot offer", text: text }).catch(function () {}); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { setMsg("Offer sheet copied. Paste it anywhere."); }, function () { setMsg("Could not copy. Use Export CSV."); }); return; }
      setMsg("Sharing is not available here. Use Export CSV.");
      return;
    }
    if (act === "clear") {
      if (!window.confirm("Clear this lot from this phone?")) return;
      state.rows = []; photo.canvas = null; photo.small = ""; msg = "";
      save(); paint();
    }
  });

  window.HuntLot = {
    render: render,
    state: function () { return state; },
    _price: price,
    _matchName: matchName,
    wipe: function () { state = { margin: 0.3, floor: 0.25, rows: [] }; photo.canvas = null; try { localStorage.removeItem(KEY); } catch (err) {} },
  };
})();
