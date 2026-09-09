(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ResellerCash = api;
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

  return {
    FEE: FEE,
    cashLeft: cashLeft,
    leftoverCash: leftoverCash,
    beatsShelfAfterFees: beatsShelfAfterFees,
    itemFitness: itemFitness,
    itemVerdict: itemVerdict,
  };
});
