/* Hunt: search Hot Wheels mainline cases. Parses case-box codes (L2593-973N, C4982-99NL), card codes with the
 * case letter (JJK58-N9C0N), and "2026 N" / "case N". Renders the case's cars from data/hw/cases-<year>.json.
 * Mapping comes from published case checklists (source link per case); unknowns stay unknown. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HuntCases = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q"];
  var YEARS = [2026];
  var ASSORTS = { L2593: "US long card", C4982: "International long card", "5785": "Short card" };
  var LETTER_RE = "[A-HJ-NP-Q]";

  /* -> { year, letter, assort, toy, raw } | { assort, year, letter: "" } | null */
  function parseQuery(text, opts) {
    var o = opts || {};
    var s = String(text == null ? "" : text).toUpperCase().replace(/[‐-―]/g, "-");
    var year = (/\b(20[2-3]\d)\b/.exec(s) || [])[1];
    year = year ? Number(year) : (o.year || YEARS[YEARS.length - 1]);
    var m = /\b(L2593|C4982|5785)\s*-?\s*([0-9A-Z]{2,5})\b/.exec(s);
    if (m) {
      var last = m[2].slice(-1);
      var letter = LETTERS.indexOf(last) !== -1 ? last : "";
      /* "-976K PN": the letter can also sit right before a 2-letter mix tag */
      if (!letter) return { assort: m[1], year: year, letter: "", raw: m[0] };
      return { assort: m[1], year: year, letter: letter, raw: m[0] };
    }
    m = /\b(L2593|C4982|5785)\b/.exec(s);
    if (m) return { assort: m[1], year: year, letter: "", raw: m[0] };
    /* card code: toy # + suffix whose last letter is the case (JJK58-N9C0N) */
    m = /\b([A-Z]{3}\d{2})\s*-\s*([0-9A-Z]{3,6})\b/.exec(s);
    if (m && /[A-Z]$/.test(m[2]) && LETTERS.indexOf(m[2].slice(-1)) !== -1 && /\d/.test(m[2])) {
      return { toy: m[1], year: o.yearOfToy ? (o.yearOfToy(m[1]) || year) : year, letter: m[2].slice(-1), raw: m[0] };
    }
    m = new RegExp("\\b(?:CASE|MIX)\\s*(" + LETTER_RE + ")\\b").exec(s) || new RegExp("\\b(" + LETTER_RE + ")[\\s-]*(?:CASE|MIX)\\b").exec(s);
    if (m) return { year: year, letter: m[1], raw: m[0] };
    m = new RegExp("^\\s*(20[2-3]\\d)\\s*-?\\s*(" + LETTER_RE + ")\\s*$").exec(s) || new RegExp("^\\s*(" + LETTER_RE + ")\\s*-?\\s*(20[2-3]\\d)\\s*$").exec(s);
    if (m) {
      var y = /^\d/.test(m[1]) ? m[1] : m[2];
      var l = /^\d/.test(m[1]) ? m[2] : m[1];
      return { year: Number(y), letter: l, raw: m[0] };
    }
    return null;
  }

  /* every case code in OCR text (box labels, card backs) */
  function casesIn(text, opts) {
    var out = [];
    String(text || "").split(/\n+/).forEach(function (line) {
      var q = parseQuery(line, opts);
      if (q && (q.assort || q.toy) && !out.some(function (x) { return x.raw === q.raw; })) out.push(q);
    });
    return out;
  }

  /* eBay fee check used across Hunt: sold x 0.87 - $5 shipping/supplies */
  function feeCheck(sold, cost) {
    var s = Number(sold);
    if (!isFinite(s) || s <= 0) return null;
    var net = Math.round((s * 0.87 - 5) * 100) / 100;
    var c = cost === "" || cost == null ? null : Number(cost);
    var profit = c != null && isFinite(c) ? Math.round((net - c) * 100) / 100 : null;
    return { sold: s, net: net, cost: c, profit: profit, verdict: profit == null ? "" : profit > 0 ? "BUY" : "PASS" };
  }

  function findCar(data, toy) {
    if (!data || !toy) return null;
    var hit = null;
    Object.keys(data.cases || {}).forEach(function (L) {
      ((data.cases[L] || {}).cars || []).forEach(function (c) {
        if (!hit && (c.toy === toy || (c.toys || []).indexOf(toy) !== -1)) hit = { letter: L, car: c };
      });
    });
    return hit;
  }

  function money(n) { return "$" + Number(n).toFixed(2); }

  /* opts: { esc, compFor(car) -> {value, source} | null, cost, thumb(path) -> url, compact, highlight: toy } */
  function caseHtml(data, q, opts) {
    var o = opts || {};
    var esc = o.esc || function (x) { return String(x == null ? "" : x); };
    var L = q && q.letter;
    if (data && q && q.year && Number(data.year) !== Number(q.year)) data = null;
    var c = data && data.cases && data.cases[L];
    var head = '<p class="kicker">Hot Wheels mainline · ' + esc(q && q.year ? q.year : data ? data.year : "") + (q && q.assort ? " · " + esc(q.assort) + " (" + esc(ASSORTS[q.assort] || "") + ")" : "") + "</p>";
    if (!c) return '<section class="hwcase is-miss">' + head + "<p><b>Hunt has no case list for " + esc(q.year) + (L ? " case " + esc(L) : "") + ".</b> Case lists come from published checklists; this one is not mapped yet.</p></section>";
    if (c.status !== "listed") return '<section class="hwcase is-miss">' + head + "<h3>Case " + esc(L) + "</h3><p>Unknown: " + esc(c.note || "no published checklist yet") + "</p></section>";
    var cars = c.cars.slice().sort(function (a, b) { return rank(a) - rank(b) || a.col.localeCompare(b.col); });
    var html = '<section class="hwcase" aria-label="Case ' + esc(L) + '">' + head +
      "<h3>" + esc(data.year) + " case " + esc(L) + " · " + cars.length + " cars listed</h3>" +
      '<p class="hwcase-flags">' + (c.sth.length ? '<span class="flag sth">STH ' + esc(c.sth.join(", ")) + "</span>" : "") + (c.th.length ? '<span class="flag th">TH ' + esc(c.th.join(", ")) + "</span>" : "") + "</p>" +
      '<p class="fine">Qty per case: not published by Mattel (72 cars per case; TH/STH are random inserts). Source: <a href="' + esc(c.source) + '" target="_blank" rel="noopener noreferrer">case checklist</a> · toy # and photos: Hot Wheels Wiki.</p>';
    html += '<ul class="hwcase-list">' + cars.map(function (car) {
      var comp = o.compFor ? o.compFor(car) : null;
      var fee = comp && comp.value != null ? feeCheck(comp.value, o.cost) : null;
      var flags = (car.tag === "STH" ? '<span class="flag sth">STH</span>' : car.tag === "TH" ? '<span class="flag th">TH</span>' : "") +
        (car.isNew ? '<span class="flag new">New</span>' : "") + (car.store ? '<span class="flag store">' + esc(car.store) + "</span>" : "");
      var toy = car.toy ? "Toy # " + esc(car.toy) : car.toys && car.toys.length ? "Toy # " + esc(car.toys.join(" or ")) + " (color not confirmed)" : "Toy # unknown";
      var img = car.image ? (o.thumb ? o.thumb(car.image) : car.image) : "";
      return '<li class="hwcase-car' + (car.tag ? " is-chase" : "") + (o.highlight && (car.toy === o.highlight || (car.toys || []).indexOf(o.highlight) !== -1) ? " is-hit" : "") + '">' +
        '<span class="hwcase-img">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : "") + "</span>" +
        '<span class="hwcase-copy"><span class="hwcase-name"><b>' + esc(car.name) + "</b> " + flags + "</span>" +
        "<span>" + esc(car.col) + "/250 · " + esc(car.color) + " · " + esc(car.series) + "</span>" +
        "<span>" + toy + (car.colorConfirmed ? "" : car.image ? " · casting photo, color may differ" : "") + "</span>" +
        (fee ? '<span class="hwcase-fee">Sold ' + money(fee.sold) + " → net " + money(fee.net) + (fee.profit != null ? " · after cost " + (fee.profit >= 0 ? "+" : "−") + money(Math.abs(fee.profit)) + " " + fee.verdict : " · add your cost") + "</span>" : '<span class="fine">No verified sold comp</span>') +
        "</span></li>";
    }).join("") + "</ul></section>";
    return html;
  }

  function rank(car) { return car.tag === "STH" ? 0 : car.tag === "TH" ? 1 : car.isNew ? 2 : 3; }

  return { LETTERS: LETTERS, YEARS: YEARS, ASSORTS: ASSORTS, parseQuery: parseQuery, casesIn: casesIn, feeCheck: feeCheck, findCar: findCar, caseHtml: caseHtml };
});
