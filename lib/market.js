(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ResellerMarket = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
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
    if (String(item.soldSource || "").trim().length <= 3) return false;
    return /^\d{4}-\d{2}-\d{2}/.test(String(item.soldDate || ""));
  }

  function verdictFor(item) {
    if (!hasVerifiedSold(item)) return "CHECK";
    var net = netOf(item.sold);
    var retail = item.retail == null || !isFinite(Number(item.retail)) ? null : Number(item.retail);
    if (net == null || retail == null || retail <= 0) return "CHECK";
    if (net < retail) return "PASS";
    if (item.liquid && net >= retail * 1.09 + 15) return "BUY";
    return "CHECK";
  }

  function finalize(item) {
    var verified = hasVerifiedSold(item);
    var sold = verified ? roundMoney(item.sold) : null;
    var net = verified ? netOf(sold) : null;
    var verdict = verdictFor({
      sold: sold,
      soldUrl: verified ? item.soldUrl : "",
      soldSource: verified ? item.soldSource : "",
      soldDate: verified ? item.soldDate : "",
      liquid: item.liquid,
      retail: item.retail,
    });
    var next = {};
    Object.keys(item).forEach(function (key) {
      if (key !== "sheetVerdict") next[key] = item[key];
    });
    next.sold = sold;
    next.net = net;
    next.verdict = verdict;
    next.liquid = verified ? Boolean(item.liquid) : false;
    if (!verified) {
      next.soldDate = "";
      next.soldSource = item.soldSource && !item.sold ? String(item.soldSource) : "";
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
