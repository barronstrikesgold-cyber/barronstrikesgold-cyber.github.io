(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ResellerMarket = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var VERDICTS = { BUY: 1, CHECK: 1, "LOT ONLY": 1 };

  function roundMoney(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function netOf(sold) {
    if (sold == null || !isFinite(Number(sold))) return null;
    return roundMoney(Number(sold) * 0.87 - 5);
  }

  function hasVerifiedSold(item) {
    if (!item || item.sold == null || !isFinite(Number(item.sold))) return false;
    if (!/^https:\/\//.test(String(item.soldUrl || ""))) return false;
    return String(item.soldSource || "").trim().length > 3;
  }

  function verdictFor(item) {
    if (!hasVerifiedSold(item)) return "CHECK";
    if (item.sheetVerdict && VERDICTS[item.sheetVerdict]) return item.sheetVerdict;
    var net = netOf(item.sold);
    var retail = item.retail == null ? null : Number(item.retail);
    if (net == null || net <= 0) return "CHECK";
    if (retail != null && net >= retail && net >= 15) return "BUY";
    if (net >= 25) return "BUY";
    return "LOT ONLY";
  }

  function finalize(item) {
    var verified = hasVerifiedSold(item);
    var sold = verified ? roundMoney(item.sold) : null;
    var net = null;
    if (verified) net = item.sheetVerdict && item.net != null ? roundMoney(item.net) : netOf(sold);
    var verdict = verdictFor({
      sold: sold,
      soldUrl: verified ? item.soldUrl : "",
      soldSource: verified ? item.soldSource : "",
      sheetVerdict: item.sheetVerdict,
      retail: item.retail,
    });
    var next = {};
    Object.keys(item).forEach(function (key) {
      if (key !== "sheetVerdict") next[key] = item[key];
    });
    next.sold = sold;
    next.net = net;
    next.verdict = verdict;
    if (!verified) {
      next.soldDate = "";
      next.soldSource = item.soldSource && !item.sold ? String(item.soldSource) : (verified ? item.soldSource : "");
    }
    return next;
  }

  function latestFeed(items, today) {
    var day = String(today || "");
    return (items || []).filter(function (item) {
      return item && item.feed && item.release && String(item.release) >= day;
    }).sort(function (a, b) {
      var byDate = String(a.release).localeCompare(String(b.release));
      if (byDate) return byDate;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  return {
    netOf: netOf,
    hasVerifiedSold: hasVerifiedSold,
    verdictFor: verdictFor,
    finalize: finalize,
    latestFeed: latestFeed,
  };
});
