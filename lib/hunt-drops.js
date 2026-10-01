(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResellerHuntDrops = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function byIso(a, b) {
    return String(a.iso).localeCompare(String(b.iso));
  }

  function pickHuntDrops(drops, today, verdictFor) {
    var list = (drops || []).filter(function (row) { return row && row.iso; });
    var upcoming = list.filter(function (row) { return String(row.iso) >= String(today); }).sort(byIso);
    var released = list.filter(function (row) { return String(row.iso) < String(today); }).sort(byIso);
    function buys(rows) {
      return rows.filter(function (row) { return verdictFor(row) === "Buy"; });
    }
    var nextBuys = buys(upcoming);
    var freshBuys = buys(released);
    return {
      next: nextBuys[0] || upcoming[0] || null,
      fresh: freshBuys.length ? freshBuys[freshBuys.length - 1] : (released.length ? released[released.length - 1] : null),
    };
  }

  function dataStatusLabel(phase) {
    if (phase === "checking") return "Checking…";
    if (phase === "fresh") return "Updated just now";
    if (phase === "error") return "Could not update. Showing the last copy on this phone.";
    return "";
  }

  function shouldRefreshOnReturn(now, quietUntil, visibilityState) {
    if (visibilityState === "hidden") return false;
    return now >= quietUntil;
  }

  return {
    pickHuntDrops: pickHuntDrops,
    dataStatusLabel: dataStatusLabel,
    shouldRefreshOnReturn: shouldRefreshOnReturn,
  };
});
