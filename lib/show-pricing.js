/* Hunt Show Mode pricing agent. Pure functions, no network.
 * Prices come only from the app's own data: data/market.json sold comps and catalog guide values.
 * When there is no comp the agent says "No verified comp" and never makes one up. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HuntShowPricing = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var SHOW_DISCOUNT = 0.12; /* show ticket sits ~12% under market: no fees, no shipping */
  var FLOOR_MARGIN = 0.15; /* floor never below cost + 15% (and at least +$0.50 under $5, +$1 above) */

  function num(v) {
    if (v === "" || v == null) return null;
    var n = Number(String(v).replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function step(x) {
    if (x < 10) return 1;
    if (x < 20) return 1;
    if (x < 100) return 5;
    if (x < 500) return 10;
    return 25;
  }

  function niceDown(x) {
    if (x == null || !(x > 0)) return null;
    if (x < 1) return Math.max(0.5, Math.floor(x * 2) / 2);
    var s = step(x);
    return Math.max(1, Math.floor(x / s) * s);
  }

  function niceUp(x) {
    if (x == null || !(x > 0)) return null;
    if (x < 1) return Math.ceil(x * 2) / 2;
    var s = step(x);
    return Math.ceil(x / s - 1e-9) * s;
  }

  function laneOfSection(id, name) {
    if (id === "pokemon") return "pokemon";
    if (id === "matchbox") return "matchbox";
    if (id === "funko") return "funko";
    if (id === "lego") return "lego";
    if (id === "sneakers") return "sneakers";
    if (id === "hot-wheels" || id === "cars") return "hot-wheels";
    if (id === "mattel" && /hot wheels/i.test(name || "")) return "hot-wheels";
    if (id === "mattel" && /matchbox/i.test(name || "")) return "matchbox";
    return "other";
  }

  function codesOf(item) {
    var out = [];
    ["upc", "barcode", "ean", "gtin", "sku", "code", "toy", "toyNo"].forEach(function (k) {
      var v = item && item[k];
      if (v && v !== "—") out.push(String(v).toUpperCase().replace(/[\s-]/g, ""));
    });
    if (item && item.resale && item.resale.toyNo && item.resale.toyNo !== "—") out.push(String(item.resale.toyNo).toUpperCase());
    return out;
  }

  /* data = { market: market.json, catalog: [catalog items] } */
  function buildComps(data) {
    var comps = [];
    var market = (data && data.market) || {};
    (market.sections || []).forEach(function (section) {
      (section.items || []).forEach(function (item) {
        var sold = num(item.sold);
        comps.push({
          id: "m:" + item.id,
          name: item.name,
          lane: laneOfSection(section.id, item.name),
          section: section.title || section.id,
          value: sold,
          kind: sold != null ? "sold" : "none",
          source: sold != null ? item.soldSource || "" : "",
          date: sold != null ? item.soldDate || "" : "",
          url: sold != null ? item.soldUrl || "" : "",
          retail: num(item.retail),
          photo: item.photo || "",
          codes: codesOf(item),
        });
      });
    });
    ((data && data.catalog) || []).forEach(function (item) {
      var r = item.resale || {};
      var value = num(r.soldValue);
      var source = value != null ? r.soldSource || "" : "";
      var date = value != null ? r.soldDate || "" : "";
      var url = value != null ? r.soldUrl || "" : "";
      if (value == null && num(item.soldNum) != null) {
        value = num(item.soldNum);
        source = [item.source, item.checkedNote].filter(Boolean).join(". ");
        date = item.date || "";
        url = "";
      }
      comps.push({
        id: "c:" + item.id,
        name: item.name,
        lane: item.category === "cars" ? "hot-wheels" : laneOfSection(item.category, item.name),
        section: item.category === "cars" ? "Hot Wheels" : item.category || "",
        value: value,
        kind: value != null ? (/guide/i.test(source) ? "guide" : "sold") : "none",
        source: source,
        date: date,
        url: url,
        retail: num(item.shelfNum),
        photo: item.photoMatched && item.photo ? item.photo : "",
        codes: codesOf(item),
      });
    });
    return comps;
  }

  function fold(s) {
    return String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function search(comps, query, limit) {
    var q = fold(query);
    if (!q) return [];
    var code = String(query).toUpperCase().replace(/[\s-]/g, "");
    var words = q.split(" ");
    var hits = [];
    (comps || []).forEach(function (c) {
      if (c.codes && c.codes.indexOf(code) !== -1) { hits.push({ c: c, score: 100 }); return; }
      var name = fold(c.name);
      if (!words.every(function (w) { return name.indexOf(w) !== -1; })) return;
      var score = name.indexOf(q) === 0 ? 50 : name.indexOf(q) !== -1 ? 30 : 10;
      if (c.value != null) score += 5;
      hits.push({ c: c, score: score });
    });
    hits.sort(function (a, b) { return b.score - a.score || a.c.name.localeCompare(b.c.name); });
    return hits.slice(0, limit || 20).map(function (h) { return h.c; });
  }

  function byCode(comps, code) {
    var key = String(code || "").toUpperCase().replace(/[\s-]/g, "");
    if (!key) return [];
    return (comps || []).filter(function (c) { return c.codes && c.codes.indexOf(key) !== -1; });
  }

  /* comp: {value, source, date} or null. unitCost: per-unit cost incl. tax or null. */
  function suggest(comp, unitCost, opts) {
    opts = opts || {};
    var value = comp && comp.value != null ? Number(comp.value) : null;
    var cost = unitCost == null ? null : Number(unitCost);
    var out = {
      hasComp: value != null,
      market: value,
      source: comp && value != null ? comp.source || "" : "",
      date: comp && value != null ? comp.date || "" : "",
      url: comp && value != null ? comp.url || "" : "",
      ebayNet: null,
      ticket: null,
      floor: null,
      lot: null,
      notes: [],
    };
    var costFloor = cost != null && cost > 0 ? niceUp(Math.max(cost * (1 + FLOOR_MARGIN), cost + (cost < 5 ? 0.5 : 1))) : null;
    if (value != null) {
      out.ebayNet = Math.round((value * 0.87 - 5) * 100) / 100;
      out.ticket = niceDown(value * (1 - SHOW_DISCOUNT));
      var netFloor = out.ebayNet > 0 ? niceDown(out.ebayNet) : null;
      out.floor = Math.max(costFloor || 0, netFloor || 0) || null;
      if (out.floor != null && out.ticket != null && out.floor > out.ticket) {
        if (cost != null && cost >= value) out.notes.push("Market is under what you paid. Hold it or list it online.");
        else out.notes.push("Ticket raised to your floor.");
        out.ticket = out.floor;
      }
      if (value < 5) {
        var lotPrice = niceDown(3 * value * 0.85);
        if (lotPrice && (costFloor == null || lotPrice >= 3 * (cost || 0))) out.lot = { qty: 3, price: lotPrice, basis: "comp" };
      }
    } else {
      out.floor = costFloor;
      out.notes.push("No verified comp. Price it from a live sold search, not a guess.");
      var common = (opts.lane === "hot-wheels" || opts.lane === "matchbox") && !opts.variant && (cost == null || cost <= 1.5);
      if (common) out.lot = { qty: 3, price: 5, basis: "house" };
    }
    return out;
  }

  return {
    SHOW_DISCOUNT: SHOW_DISCOUNT,
    FLOOR_MARGIN: FLOOR_MARGIN,
    niceDown: niceDown,
    niceUp: niceUp,
    buildComps: buildComps,
    search: search,
    byCode: byCode,
    suggest: suggest,
    fold: fold,
  };
});
