(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HuntFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var KEY = "hunt-settings";
  var DEFAULTS = {
    feePercent: 13,
    shipping: 5,
    minProfit: 5,
    minSales: 5,
  };

  function num(value, fallback, min) {
    if (value == null || value === "") return fallback;
    var n = Number(value);
    if (!Number.isFinite(n) || n < min) return fallback;
    return n;
  }

  function clampSettings(raw) {
    raw = raw || {};
    return {
      feePercent: num(raw.feePercent, DEFAULTS.feePercent, 0),
      shipping: num(raw.shipping, DEFAULTS.shipping, 0),
      minProfit: num(raw.minProfit, DEFAULTS.minProfit, 0),
      minSales: num(raw.minSales, DEFAULTS.minSales, 0),
    };
  }

  function loadSettings(storage) {
    try {
      var raw = storage && storage.getItem(KEY);
      if (!raw) return clampSettings(DEFAULTS);
      return clampSettings(JSON.parse(raw));
    } catch (err) {
      return clampSettings(DEFAULTS);
    }
  }

  function saveSettings(storage, settings) {
    var next = clampSettings(settings);
    storage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  function cents(value) {
    return Math.round(Number(value) * 100);
  }

  function dollars(value) {
    return value / 100;
  }

  function breakdown(input, settings) {
    settings = clampSettings(settings || DEFAULTS);
    input = input || {};
    var sales = num(input.sales, 0, 0);
    var costMissing = input.cost == null || input.cost === "" || !Number.isFinite(Number(input.cost));
    var soldMissing = input.sold == null || input.sold === "" || !Number.isFinite(Number(input.sold));
    if (soldMissing || costMissing) {
      return {
        sold: soldMissing ? null : dollars(cents(input.sold)),
        fees: null,
        shipping: settings.shipping,
        cost: costMissing ? null : dollars(cents(input.cost)),
        profit: null,
        sales: sales,
        verdict: "CHECK",
        reason: soldMissing ? "no-sold" : "no-cost",
        feePercent: settings.feePercent,
      };
    }
    var soldCents = cents(input.sold);
    var feeCents = Math.round(soldCents * settings.feePercent / 100);
    var profitCents = soldCents - feeCents - cents(settings.shipping) - cents(input.cost);
    var profit = dollars(profitCents);
    var verdict = "CHECK";
    var reason = "thin-profit";
    if (profit < 0) {
      verdict = "PASS";
      reason = "loss";
    } else if (profit >= settings.minProfit && sales >= settings.minSales) {
      verdict = "BUY";
      reason = "clears";
    } else if (sales < settings.minSales) {
      reason = "few-sales";
    }
    return {
      sold: dollars(soldCents),
      fees: dollars(feeCents),
      shipping: settings.shipping,
      cost: dollars(cents(input.cost)),
      profit: profit,
      sales: sales,
      verdict: verdict,
      reason: reason,
      feePercent: settings.feePercent,
    };
  }

  function shouldNotify(rule, prev, next) {
    rule = rule || {};
    prev = prev || {};
    next = next || {};
    var reasons = [];
    var threshold = Number(rule.threshold);
    if (rule.profitOn && Number.isFinite(Number(next.profit)) && Number.isFinite(threshold)) {
      var nowAbove = Number(next.profit) > threshold;
      var wasAbove = Number.isFinite(Number(prev.profit)) && Number(prev.profit) > threshold;
      if (nowAbove && !wasAbove) reasons.push("profit");
    }
    if (rule.stockOn && next.inStock && !prev.inStock) reasons.push("stock");
    if (rule.verdictOn && prev.verdict && next.verdict && prev.verdict !== next.verdict) reasons.push("verdict");
    return reasons;
  }

  return {
    KEY: KEY,
    DEFAULTS: DEFAULTS,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    breakdown: breakdown,
    shouldNotify: shouldNotify,
  };
});
