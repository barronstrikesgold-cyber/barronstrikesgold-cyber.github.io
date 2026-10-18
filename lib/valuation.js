/* Hunt valuation: last sale, recent comps, trend, sell-or-keep, projection, grading pop, and lot offers.
 * Pure functions (no network) except askProxy, which only runs when the owner saved a proxy URL.
 * Never invents a price: with no dated sold data it says so. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HuntValue = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var FEE = 0.87;
  var FLAT = 5;
  var DEFAULT_TAX = 9.7;
  var DAY = 86400000;
  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  var PROXY_KEY = "hunt-value-proxy";
  var CARD_LANES = /^(pokemon|sports|magic|one-piece|lorcana|yugioh|tcg|cards?)$/;
  var DIECAST_LANES = /^(hot-wheels|matchbox|mattel|diecast|monster-trucks)$/;

  function num(v) {
    if (v === "" || v == null) return null;
    var n = Number(String(v).replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  function round2(n) { return Math.round(n * 100) / 100; }

  /* eBay net: sold × 0.87 − $5 */
  function net(sold) {
    var s = num(sold);
    return s == null ? null : round2(s * FEE - FLAT);
  }

  /* cost each including sales tax (default 9.7% St. Louis) */
  function costWithTax(cost, taxPct) {
    var c = num(cost);
    if (c == null) return null;
    var t = num(taxPct);
    return round2(c * (1 + (t == null ? DEFAULT_TAX : t) / 100));
  }

  /* "avg $96, 24 recent sales, 30-day range $70–$150" (HWPriceGuide style) */
  function parseGuide(text) {
    var s = String(text || "");
    var avg = /avg\s*\$?([\d,.]+)/i.exec(s);
    var count = /(\d+)\s+recent sales/i.exec(s);
    var range = /(\d+)-day range\s*\$?([\d,.]+)\s*[–-]\s*\$?([\d,.]+)/i.exec(s);
    if (!avg && !range) return null;
    return {
      avg: avg ? num(avg[1]) : null,
      count: count ? Number(count[1]) : null,
      days: range ? Number(range[1]) : null,
      low: range ? num(range[2]) : null,
      high: range ? num(range[3]) : null,
    };
  }

  /* "2026-10-10", "October 10, 2026", "Oct 10 2026" -> exact; "Oct 2026" -> mid-month, approx */
  function parseDate(s) {
    var t = String(s || "").trim();
    if (!t) return null;
    var iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (iso) return { date: iso[1] + "-" + iso[2] + "-" + iso[3], approx: false };
    var long = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(t);
    if (long && MONTHS[long[1].toLowerCase()] != null) {
      return { date: long[3] + "-" + pad(MONTHS[long[1].toLowerCase()] + 1) + "-" + pad(Number(long[2])), approx: false };
    }
    var month = /([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/.exec(t);
    if (month && MONTHS[month[1].toLowerCase()] != null) {
      return { date: month[2] + "-" + pad(MONTHS[month[1].toLowerCase()] + 1) + "-15", approx: true };
    }
    var us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    if (us) return { date: us[3] + "-" + pad(Number(us[1])) + "-" + pad(Number(us[2])), approx: false };
    return null;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ms(date) { return Date.parse(date + "T12:00:00Z"); }

  /* raw: [{price|value|sold, date, source, url, kind}] -> sorted, de-duplicated, dated points */
  function points(raw) {
    var seen = {};
    var out = [];
    (raw || []).forEach(function (r) {
      if (!r) return;
      var price = num(r.price != null ? r.price : r.value != null ? r.value : r.sold);
      if (price == null || price <= 0) return;
      var d = parseDate(r.date);
      if (!d) return;
      var key = d.date + "|" + price + "|" + (r.url || "");
      if (seen[key]) return;
      seen[key] = true;
      out.push({ date: d.date, approx: d.approx || !!r.approx, price: price, source: r.source || "", url: /^https:\/\//.test(r.url || "") ? r.url : "", kind: r.kind || "sold", title: r.title || "" });
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out;
  }

  function lastSale(pts) {
    var list = (pts || []).filter(function (p) { return p.kind === "sold"; });
    if (!list.length) list = pts || [];
    return list.length ? list[list.length - 1] : null;
  }

  function fit(pts) {
    var n = pts.length;
    var t0 = ms(pts[0].date);
    var xs = pts.map(function (p) { return (ms(p.date) - t0) / DAY; });
    var ys = pts.map(function (p) { return Math.log(p.price); });
    var mx = xs.reduce(function (a, b) { return a + b; }, 0) / n;
    var my = ys.reduce(function (a, b) { return a + b; }, 0) / n;
    var sxx = 0, sxy = 0, syy = 0;
    for (var i = 0; i < n; i++) { sxx += (xs[i] - mx) * (xs[i] - mx); sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) * (ys[i] - my); }
    var slope = sxx > 0 ? sxy / sxx : 0;
    var icpt = my - slope * mx;
    var sse = 0;
    for (var j = 0; j < n; j++) { var e = ys[j] - (icpt + slope * xs[j]); sse += e * e; }
    var r2 = syy > 0 ? Math.max(0, 1 - sse / syy) : 0;
    var sigma = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
    return { slope: slope, icpt: icpt, r2: r2, sigma: sigma, span: xs[n - 1], t0: t0, lastX: xs[n - 1] };
  }

  /* direction of the price: needs 3+ dated prices over 14+ days */
  function trend(pts) {
    var list = (pts || []).filter(function (p) { return !p.approx || pts.length >= 5; });
    if (list.length < 3) return { dir: "unknown", n: list.length, reason: "Not enough dated sales to call a trend (" + list.length + " of 3 needed)." };
    var f = fit(list);
    if (f.span < 14) return { dir: "unknown", n: list.length, reason: "Sales span only " + Math.round(f.span) + " days (14 needed)." };
    var pct30 = (Math.exp(f.slope * 30) - 1) * 100;
    var dir = Math.abs(pct30) < 5 ? "flat" : pct30 > 0 ? "rising" : "falling";
    return { dir: dir, n: list.length, pct30: Math.round(pct30 * 10) / 10, spanDays: Math.round(f.span), r2: Math.round(f.r2 * 100) / 100, reason: (pct30 >= 0 ? "+" : "") + (Math.round(pct30 * 10) / 10) + "% per 30 days across " + list.length + " sales over " + Math.round(f.span) + " days." };
  }

  /* past the release spike: peak within 45 days of release, now 30+ days after release, and 15%+ under that peak */
  function releaseSpike(pts, release, today) {
    var rel = parseDate(release);
    if (!rel || !pts || !pts.length) return { past: false, inWindow: false };
    var relMs = ms(rel.date);
    var now = today ? ms(today) : Date.now();
    var age = (now - relMs) / DAY;
    if (age < 0) return { past: false, inWindow: false, upcoming: true };
    if (age <= 30) return { past: false, inWindow: true, reason: "Released " + Math.round(age) + " days ago; prices often peak in the first weeks." };
    var early = pts.filter(function (p) { var d = (ms(p.date) - relMs) / DAY; return d >= -7 && d <= 45; });
    if (!early.length) return { past: false, inWindow: false };
    var peak = early.reduce(function (m, p) { return p.price > m.price ? p : m; }, early[0]);
    var last = pts[pts.length - 1];
    if (last.date > peak.date && last.price <= peak.price * 0.85) {
      return { past: true, peak: peak.price, last: last.price, reason: "Peaked at $" + peak.price.toFixed(2) + " after release; last sale $" + last.price.toFixed(2) + " (" + Math.round((1 - last.price / peak.price) * 100) + "% lower)." };
    }
    return { past: false, inWindow: false };
  }

  /* Sell or keep. Rules: net = sold × 0.87 − $5 vs cost incl. tax; hold if rising; sell if falling or past the release spike. */
  function recommend(o) {
    var sold = num(o && o.sold);
    var cost = num(o && o.unitCost);
    var tr = (o && o.trend) || { dir: "unknown" };
    var sp = (o && o.spike) || {};
    var out = { action: "UNKNOWN", net: null, profit: null, reasons: [] };
    if (sold == null) {
      out.reasons.push("No verified sold comp. Check a live sold search before you decide.");
      return out;
    }
    out.net = net(sold);
    out.profit = cost != null ? round2(out.net - cost) : null;
    var money = function (n) { return (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2); };
    var math = "Net " + money(out.net) + " (sold $" + sold.toFixed(2) + " × 0.87 − $5)" + (cost != null ? " vs cost " + money(cost) + " incl. tax = " + money(out.profit) : " · add your cost for profit");
    if (tr.dir === "rising") {
      out.action = "HOLD";
      out.reasons.push("Price is rising: " + tr.reason);
    } else if (tr.dir === "falling") {
      out.action = "SELL";
      out.reasons.push("Price is falling: " + tr.reason);
    } else if (sp.past) {
      out.action = "SELL";
      out.reasons.push("Past the release spike. " + sp.reason);
    } else if (out.profit != null && out.profit <= 0) {
      out.action = "KEEP";
      out.reasons.push("Selling on eBay now would not cover your cost. Keep it, or sell locally with no fees.");
    } else {
      out.action = "SELL";
      out.reasons.push(tr.dir === "flat" ? "Price is flat: " + tr.reason + " Take the profit." : "Trend unknown: " + String(tr.reason || "thin data.") + " The fee math is positive, so selling is the default.");
    }
    if (sp.inWindow && out.action !== "HOLD") out.reasons.push(sp.reason);
    if (out.action === "SELL" && out.profit != null && out.profit < 0) out.reasons.push("This sale is under your cost; it cuts the loss before it grows.");
    out.reasons.push(math);
    return out;
  }

  /* Projected value from historical sold data. Log-linear fit, extended `horizon` days. Needs 5+ sales over 30+ days. */
  function project(pts, horizon) {
    var h = horizon || 90;
    var list = (pts || []).slice();
    var span = list.length > 1 ? (ms(list[list.length - 1].date) - ms(list[0].date)) / DAY : 0;
    if (list.length < 5 || span < 30) {
      return { ok: false, n: list.length, spanDays: Math.round(span), reason: "Not enough data: " + list.length + " dated sale" + (list.length === 1 ? "" : "s") + " over " + Math.round(span) + " days. A projection needs at least 5 over 30 days." };
    }
    var f = fit(list);
    var last = list[list.length - 1].price;
    var x = f.lastX + h;
    var mid = Math.exp(f.icpt + f.slope * x);
    mid = Math.min(last * 2, Math.max(last * 0.5, mid));
    var spread = 1.28 * f.sigma * Math.sqrt(1 + 1 / list.length);
    var low = mid * Math.exp(-spread);
    var high = mid * Math.exp(spread);
    var conf = list.length >= 12 && f.r2 >= 0.5 && span >= 60 ? "high" : list.length >= 8 && f.r2 >= 0.3 ? "medium" : "low";
    return {
      ok: true,
      horizonDays: h,
      mid: round2(mid),
      low: round2(low),
      high: round2(high),
      confidence: conf,
      n: list.length,
      spanDays: Math.round(span),
      r2: Math.round(f.r2 * 100) / 100,
      method: "Log-linear trend fit of " + list.length + " dated sales over " + Math.round(span) + " days, extended " + h + " days. Range is an 80% band from how far sales scatter around the trend (capped at 0.5×–2× the last sale).",
      label: "Projection, not a promise.",
    };
  }

  /* Grading population. Hot Wheels: no pop data. Cards: PSA Public API through the owner's proxy only. */
  function popInfo(item, proxyPop) {
    var lane = String((item && item.lane) || "");
    if (DIECAST_LANES.test(lane)) return { status: "none", text: "No pop data. PSA, CGC, and Beckett do not publish population reports for Hot Wheels or Matchbox." };
    if (proxyPop && (proxyPop.psa != null || proxyPop.total != null)) {
      return { status: "ok", text: "PSA pop " + (proxyPop.total != null ? proxyPop.total : proxyPop.psa) + (proxyPop.psa10 != null ? " · PSA 10: " + proxyPop.psa10 : "") + (proxyPop.asOf ? " · as of " + proxyPop.asOf : ""), source: proxyPop.source || "PSA Public API (your proxy)", url: proxyPop.url || "" };
    }
    if (CARD_LANES.test(lane) || /\b\d{1,3}\/\d{1,3}\b/.test(String((item && item.code) || ""))) {
      return { status: "needs-proxy", text: "No free public pop source Hunt can read in the browser. PSA pop needs a PSA spec ID and the optional proxy (PSA Public API, free token). CGC and Beckett publish no public API.", url: "https://www.psacard.com/pop" };
    }
    return { status: "na", text: "No grading population for this kind of item." };
  }

  var CHASE = [
    [/\bsuper treasure hunt\b|\bSTH\b/i, "STH"],
    [/\btreasure hunt\b|\bTH\b/i, "TH"],
    [/\bsuper chase\b|\bchase\b|\b0\/5\b/i, "Chase"],
  ];
  /* Hot Wheels price lists name a Super Treasure Hunt "... Super" (e.g. "'23 Ram 1500 Super"). Only trusted for diecast. */
  function flags(name, extra, lane) {
    var s = String(name || "") + " " + String(extra || "");
    var out = [];
    CHASE.forEach(function (c) { if (c[0].test(s) && out.indexOf(c[1]) === -1) out.push(c[1]); });
    if (DIECAST_LANES.test(String(lane || "")) && /\bsuper\s*$/i.test(String(name || "").trim()) && out.indexOf("STH") === -1) out.push("STH");
    if (out.indexOf("STH") !== -1) out = out.filter(function (f) { return f !== "TH"; });
    return out;
  }

  /* Lot offer per piece: max offer = (expected sold × 0.87 − $5) × (1 − margin). Commons floor when the math is thin.
   * opts: { margin: 0.30, floor: 0.25, confidence: 0..1 } */
  function offer(sold, opts) {
    var o = opts || {};
    var margin = num(o.margin);
    if (margin == null || margin < 0 || margin >= 1) margin = 0.3;
    var floor = num(o.floor);
    if (floor == null || floor < 0) floor = 0.25;
    var s = num(sold);
    var conf = num(o.confidence);
    var verify = conf != null && conf < 0.6;
    if (s == null) return { offer: floor, basis: "floor", note: "No sold comp: commons floor", net: null, verify: true };
    var n = net(s);
    var raw = n * (1 - margin);
    if (!(raw > floor)) return { offer: floor, basis: "floor", note: "Net $" + n.toFixed(2) + " is thin: commons floor", net: n, verify: verify };
    var stepped = raw >= 20 ? Math.floor(raw) : Math.floor(raw * 4) / 4;
    return { offer: round2(Math.max(floor, stepped)), basis: "comp", note: "($" + s.toFixed(2) + " × 0.87 − $5) × " + Math.round((1 - margin) * 100) + "%", net: n, verify: verify };
  }

  function lotTotals(rows) {
    var t = { count: 0, offer: 0, expected: 0, net: 0, verify: 0, flagged: 0 };
    (rows || []).forEach(function (r) {
      var q = Math.max(1, Number(r.qty) || 1);
      t.count += q;
      t.offer += (num(r.offer) || 0) * q;
      if (num(r.sold) != null) { t.expected += num(r.sold) * q; t.net += net(r.sold) * q; }
      if (r.verify) t.verify += q;
      if (r.flags && r.flags.length) t.flagged += q;
    });
    t.offer = round2(t.offer);
    t.expected = round2(t.expected);
    t.net = round2(t.net);
    t.profit = round2(t.net - t.offer);
    return t;
  }

  function csvCell(v) {
    var s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function lotCsv(rows, settings) {
    var head = ["#", "Item", "Qty", "Flags", "Match", "Expected sold", "Sold source", "Net after fees", "Offer each", "Offer total", "Basis", "Verify"];
    var lines = [head.join(",")];
    (rows || []).forEach(function (r, i) {
      var q = Math.max(1, Number(r.qty) || 1);
      lines.push([i + 1, r.name || "Unidentified", q, (r.flags || []).join(" "), r.score != null ? Math.round(r.score * 100) + "%" : "", num(r.sold) != null ? num(r.sold).toFixed(2) : "", r.source || "", num(r.sold) != null ? net(r.sold).toFixed(2) : "", (num(r.offer) || 0).toFixed(2), ((num(r.offer) || 0) * q).toFixed(2), r.basis || "", r.verify ? "verify" : ""].map(csvCell).join(","));
    });
    var t = lotTotals(rows);
    lines.push(["", "Lot total", t.count, "", "", t.expected.toFixed(2), "", t.net.toFixed(2), "", t.offer.toFixed(2), "margin " + Math.round(((settings && settings.margin) || 0.3) * 100) + "% · floor $" + Number((settings && settings.floor) || 0.25).toFixed(2), t.verify ? t.verify + " to verify" : ""].map(csvCell).join(","));
    return lines.join("\n") + "\n";
  }

  function lotText(rows, settings) {
    var t = lotTotals(rows);
    var out = ["Hunt lot offer · " + t.count + " pieces · offer $" + t.offer.toFixed(2)];
    (rows || []).forEach(function (r, i) {
      out.push((i + 1) + ". " + (r.name || "Unidentified") + ((r.flags || []).length ? " [" + r.flags.join(", ") + "]" : "") + (Number(r.qty) > 1 ? " ×" + r.qty : "") + " — $" + (num(r.offer) || 0).toFixed(2) + (r.verify ? " (verify)" : ""));
    });
    out.push("Rule: (expected sold × 0.87 − $5) × " + Math.round((1 - ((settings && settings.margin) || 0.3)) * 100) + "%, floor $" + Number((settings && settings.floor) || 0.25).toFixed(2) + " for commons.");
    return out.join("\n");
  }

  /* ---------- optional owner proxy (off by default) ---------- */
  function proxyUrl(storage) {
    try {
      var v = String((storage && storage.getItem(PROXY_KEY)) || "").trim();
      return /^https:\/\/[^\s]+$/i.test(v) ? v.replace(/\/+$/, "") : "";
    } catch (err) { return ""; }
  }

  /* POST {q, code, upc, lane, psaSpec} -> {sales:[{date, price, url, source, title}], current:{price, source, url}, pop:{psa, psa10, asOf, source, url}} */
  function askProxy(url, query, fetchFn) {
    var f = fetchFn || (typeof fetch === "function" ? fetch : null);
    if (!url || !f) return Promise.resolve(null);
    var body = { q: String((query && query.q) || "").slice(0, 160), code: String((query && query.code) || "").slice(0, 40), upc: String((query && query.upc) || "").replace(/\D/g, "").slice(0, 14), lane: String((query && query.lane) || "").slice(0, 30), psaSpec: String((query && query.psaSpec) || "").replace(/\D/g, "").slice(0, 12) };
    return f(url + "/value", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit", referrerPolicy: "no-referrer", body: JSON.stringify(body) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || typeof j !== "object") return null;
        var sales = (Array.isArray(j.sales) ? j.sales : []).slice(0, 60).map(function (s) {
          return { price: num(s.price), date: String(s.date || "").slice(0, 10), url: /^https:\/\//.test(s.url || "") ? String(s.url) : "", source: String(s.source || "Your proxy").slice(0, 60), title: String(s.title || "").slice(0, 140), kind: "sold" };
        }).filter(function (s) { return s.price != null && parseDate(s.date); });
        var cur = j.current && num(j.current.price) != null ? { price: num(j.current.price), source: String(j.current.source || "").slice(0, 60), url: /^https:\/\//.test(j.current.url || "") ? j.current.url : "", asOf: String(j.current.asOf || "").slice(0, 10) } : null;
        var pop = j.pop && typeof j.pop === "object" ? { psa: num(j.pop.psa), psa10: num(j.pop.psa10), total: num(j.pop.total), asOf: String(j.pop.asOf || "").slice(0, 10), source: String(j.pop.source || "PSA Public API (your proxy)").slice(0, 60), url: /^https:\/\//.test(j.pop.url || "") ? j.pop.url : "" } : null;
        return { sales: sales, current: cur, pop: pop };
      }).catch(function () { return null; });
  }

  /* everything the item card shows, from comps + history + proxy answer */
  function valuate(o) {
    var raw = [].concat(o.history || [], o.sales || []);
    var guide = null;
    if (o.comp && o.comp.value != null) {
      guide = parseGuide(o.comp.source);
      /* the published comp is usually already in the history (dated by when it was seen); add it only if not */
      var cv = num(o.comp.value);
      var dup = (o.history || []).some(function (h) { return num(h.price) === cv && (h.source || "") === (o.comp.source || "").slice(0, 160); });
      if (!dup) raw.push({ price: o.comp.value, date: o.comp.date, source: o.comp.source, url: o.comp.url, kind: guide ? "guide" : "sold" });
    }
    var pts = points(raw);
    var sold = pts.filter(function (p) { return p.kind === "sold"; });
    var last = lastSale(pts);
    var tr = trend(pts);
    var sp = releaseSpike(pts, o.release, o.today);
    var current = last ? last.price : null;
    var rec = recommend({ sold: current, unitCost: o.unitCost, trend: tr, spike: sp });
    return {
      at: o.today || new Date().toISOString().slice(0, 10),
      last: last,
      recent: pts.slice(-8).reverse(),
      soldCount: sold.length,
      guide: guide,
      trend: tr,
      spike: sp,
      rec: rec,
      projection: project(pts, o.horizon),
      pop: popInfo(o.item, o.pop),
      proxyCurrent: o.current || null,
    };
  }

  return {
    FEE: FEE,
    FLAT: FLAT,
    DEFAULT_TAX: DEFAULT_TAX,
    PROXY_KEY: PROXY_KEY,
    num: num,
    net: net,
    costWithTax: costWithTax,
    parseGuide: parseGuide,
    parseDate: parseDate,
    points: points,
    lastSale: lastSale,
    trend: trend,
    releaseSpike: releaseSpike,
    recommend: recommend,
    project: project,
    popInfo: popInfo,
    flags: flags,
    offer: offer,
    lotTotals: lotTotals,
    lotCsv: lotCsv,
    lotText: lotText,
    proxyUrl: proxyUrl,
    askProxy: askProxy,
    valuate: valuate,
  };
});
