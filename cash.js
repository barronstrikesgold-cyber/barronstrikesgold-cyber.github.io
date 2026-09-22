(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResellerCash = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var FEE = 0.13;

  function cashLeft(sold, shipping, feeRate) {
    var rate = feeRate == null ? FEE : feeRate;
    var ship = Number(shipping) || 0;
    if (sold === null || sold === undefined || sold === "") return null;
    var n = Number(sold);
    if (!Number.isFinite(n)) return null;
    return n * (1 - rate) - ship;
  }

  function leftoverCash(sold, shipping, feeRate) {
    return cashLeft(sold, shipping, feeRate);
  }

  function beatsShelfAfterFees(opts) {
    var net = cashLeft(opts.sold, opts.shipping);
    if (net === null) return false;
    var shelf = Number(opts.shelf);
    if (!Number.isFinite(shelf)) return false;
    return net > shelf;
  }

  function itemFitness(item) {
    if (item && item.fitness) return item.fitness;
    if (!item) return "Watch";
    if (item.rule === "leave") return "Pass";
    if (item.rule === "buy") return "Strong";
    if (beatsShelfAfterFees(item)) return "Strong";
    if (item.sold == null || item.sold === "") return "Watch";
    return "Pass";
  }

  function itemVerdict(item) {
    if (item.rule === "buy") return "Buy";
    if (item.rule === "leave") return "Leave it";
    if (beatsShelfAfterFees(item)) return "Buy";
    return "Leave it";
  }

  function feeAmount(sold, feeRate) {
    if (sold === null || sold === undefined || sold === "") return null;
    var n = Number(sold);
    if (!Number.isFinite(n)) return null;
    var rate = feeRate == null ? FEE : feeRate;
    return n * rate;
  }

  function netProfit(opts) {
    opts = opts || {};
    var proceeds = cashLeft(opts.sold, opts.shipping, opts.feeRate);
    if (proceeds === null) return null;
    var cost = Number(opts.cost) || 0;
    var tax = Number(opts.tax) || 0;
    return proceeds - tax - cost;
  }

  function roi(net, cost) {
    var c = Number(cost);
    if (net === null || net === undefined || !Number.isFinite(Number(net))) return null;
    if (!Number.isFinite(c) || c <= 0) return null;
    return Number(net) / c;
  }

  function breakEven(opts) {
    opts = opts || {};
    var rate = opts.feeRate == null ? FEE : opts.feeRate;
    if (!(rate < 1)) return null;
    var cost = Number(opts.cost) || 0;
    var ship = Number(opts.shipping) || 0;
    var tax = Number(opts.tax) || 0;
    return (cost + ship + tax) / (1 - rate);
  }

  function targetMid(low, high) {
    if (low == null || low === "" || high == null || high === "") return null;
    var a = Number(low);
    var b = Number(high);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return (a + b) / 2;
  }

  return {
    FEE: FEE,
    cashLeft: cashLeft,
    leftoverCash: leftoverCash,
    beatsShelfAfterFees: beatsShelfAfterFees,
    itemFitness: itemFitness,
    itemVerdict: itemVerdict,
    feeAmount: feeAmount,
    netProfit: netProfit,
    roi: roi,
    breakEven: breakEven,
    targetMid: targetMid,
  };
});
