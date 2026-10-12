(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResellerDates = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Product clock for release status. Central Time date of this rebuild.
  var APP_TODAY = "2026-09-22";

  function releaseState(iso, today) {
    var day = today || APP_TODAY;
    if (!iso) return "TBA";
    return String(iso) < String(day) ? "Released" : "Upcoming";
  }

  function dropCountdown(launchAt, now) {
    var start = Date.parse(launchAt);
    var clock = now instanceof Date ? now.getTime() : (typeof now === "number" ? now : Date.parse(now));
    if (!isFinite(start) || !isFinite(clock)) return "";
    var diff = start - clock;
    if (diff <= 0) return "";
    var hours = Math.max(1, Math.ceil(diff / 3600000));
    if (hours < 168) return "Drops in " + hours + (hours === 1 ? " hour" : " hours");
    var days = Math.round(hours / 24);
    return "Drops in " + days + " days";
  }

  return { APP_TODAY: APP_TODAY, releaseState: releaseState, dropCountdown: dropCountdown };
});
