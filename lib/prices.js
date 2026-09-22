(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResellerPrices = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var TRUSTED = [
    {
      id: "f40",
      label: "$122",
      sold: 122,
      low: 122,
      high: 122,
      date: "August 2026",
      source: "HW Price Guide",
      sales: 8,
      note: "Down 12% from $138 in July.",
      sentiment: "down",
      enteredBy: "snapshot",
    },
    {
      id: "civic",
      label: "$61",
      sold: 61,
      low: 61,
      high: 61,
      date: "August 2026",
      source: "HW Price Guide",
      sales: 36,
      note: "Up 2%. Well off the spring highs.",
      sentiment: "flat to slightly up, well off the spring highs",
      enteredBy: "snapshot",
    },
    {
      id: "lotus",
      label: "$33",
      sold: 33,
      low: 33,
      high: 33,
      date: "August 2026",
      source: "HW Price Guide",
      sales: 23,
      note: "Down 14%. Orange Elise, not Elite. Inventory target stays $20–$40.",
      sentiment: "down",
      enteredBy: "snapshot",
    },
    {
      id: "impala",
      label: "$45",
      sold: 45,
      low: 45,
      high: 45,
      date: "July 2026",
      source: "HW Price Guide",
      sales: 22,
      note: "Down 10%. No August figure is stored.",
      sentiment: "down",
      enteredBy: "snapshot",
    },
    {
      id: "mustang",
      label: "$53",
      sold: 53,
      low: 53,
      high: 53,
      date: "May 2026",
      source: "HW Price Guide",
      sales: 41,
      note: "Up 2% that month. No later month is stored.",
      sentiment: "unknown after May",
      enteredBy: "snapshot",
    },
    {
      id: "topps-s1",
      label: "$13.20–$16.80",
      sold: null,
      low: 13.2,
      high: 16.8,
      date: "September 7, 2026",
      source: "Fanatics Collect",
      sales: null,
      note: "Sold under the printed price. Printed often $24.99. Pass.",
      sentiment: "under retail",
      printed: "Often $24.99",
      fitness: "Pass",
      enteredBy: "snapshot",
    },
  ];

  var byId = {};
  TRUSTED.forEach(function (row) {
    byId[row.id] = row;
  });

  function settledSale(id) {
    return byId[id] || null;
  }

  function retailLabel(item) {
    if (!item) return "Retail unknown";
    if (item.id === "topps-s1") return "Often $24.99";
    var shelf = String(item.shelf || "");
    if (/\$\d/.test(shelf) || /^about \$/i.test(shelf)) return shelf;
    if (item.category === "cars" && Number(item.shelfNum) === 1) return "About $1";
    return "Retail unknown";
  }

  function resellLabel(item) {
    var row = item && settledSale(item.id);
    if (!row) return "none";
    return row.label;
  }

  function sentimentOf(item) {
    var row = item && settledSale(item.id);
    var raw = (row && row.sentiment) || (item && item.sentiment) || "unknown";
    return String(raw);
  }

  function allowsInvented(item) {
    return false;
  }

  return {
    TRUSTED: TRUSTED,
    settledSale: settledSale,
    retailLabel: retailLabel,
    resellLabel: resellLabel,
    sentimentOf: sentimentOf,
    allowsInvented: allowsInvented,
  };
});
