(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResellerDates = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Product clock for release status. Central Time date of this rebuild.
  var APP_TODAY = "2026-09-22";

  function releaseState(iso, today) {
    var day = today || APP_TODAY;
    if (!iso) return "Upcoming";
    return String(iso) < String(day) ? "Released" : "Upcoming";
  }

  return { APP_TODAY: APP_TODAY, releaseState: releaseState };
});
