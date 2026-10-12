(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ResellerCoupons = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function dayOf(value) {
    var text = String(value || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
  }

  function dead(row, today) {
    if (!row || typeof row !== "object") return true;
    if (row.example === true) return true;
    if (row.active === false) return true;
    if (!String(row.code || "").trim()) return true;
    var expires = dayOf(row.expires);
    var day = dayOf(today);
    if (!expires || !day || expires < day) return true;
    return false;
  }

  function activeCoupons(rows, today) {
    return (rows || []).filter(function (row) { return !dead(row, today); });
  }

  function pruneCoupons(rows, today) {
    return activeCoupons(rows, today);
  }

  function activeOffers(rows, today) {
    var day = dayOf(today);
    return (rows || []).filter(function (row) {
      if (!row || typeof row !== "object") return false;
      if (row.active === false) return false;
      if (String(row.code || "").trim()) return false;
      if (!String(row.sourceUrl || "").trim()) return false;
      var expires = dayOf(row.expires);
      if (!expires || !day || expires < day) return false;
      return true;
    });
  }

  return { activeCoupons: activeCoupons, pruneCoupons: pruneCoupons, activeOffers: activeOffers };
});
