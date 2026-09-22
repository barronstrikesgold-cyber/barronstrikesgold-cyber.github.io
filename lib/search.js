(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResellerSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function hay(rec) {
    return [
      rec && rec.name,
      rec && rec.notes,
      rec && rec.digest,
      rec && rec.category,
      rec && rec.categoryTitle,
      rec && rec.store,
      rec && rec.stores,
      rec && rec.grade,
      rec && rec.status,
      rec && rec.tag,
      rec && rec.fitness,
    ]
      .filter(function (part) {
        return part != null && part !== "";
      })
      .join(" ")
      .toLowerCase();
  }

  function searchRecords(records, query) {
    var q = String(query || "").trim().toLowerCase();
    var list = (records || []).slice();
    if (!q) return list;
    return list.filter(function (rec) {
      return hay(rec).indexOf(q) !== -1;
    });
  }

  function fitnessRank(name) {
    if (name === "Strong" || name === "STH") return 0;
    if (name === "Verify" || name === "Verify STH" || name === "Watch") return 1;
    return 2;
  }

  function sortByFitness(records, fitnessOf) {
    var pick =
      fitnessOf ||
      function (rec) {
        return rec.fitness || rec.status || "Pass";
      };
    return (records || []).slice().sort(function (a, b) {
      var d = fitnessRank(pick(a)) - fitnessRank(pick(b));
      if (d) return d;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  var INV_RANK = { sth: 0, "verify-sth": 1, priority: 2, multipack: 3, duplicate: 4 };

  function sortInventory(records) {
    return (records || []).slice().sort(function (a, b) {
      var d = (INV_RANK[a.tag] != null ? INV_RANK[a.tag] : 5) - (INV_RANK[b.tag] != null ? INV_RANK[b.tag] : 5);
      if (d) return d;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  return {
    hay: hay,
    searchRecords: searchRecords,
    fitnessRank: fitnessRank,
    sortByFitness: sortByFitness,
    sortInventory: sortInventory,
  };
});
