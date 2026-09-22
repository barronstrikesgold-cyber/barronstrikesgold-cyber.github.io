(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResellerProviders = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var CHECK = {
    walmart: "https://www.walmart.com/search?q=",
    target: "https://www.target.com/s?searchTerm=",
    bestbuy: "https://www.bestbuy.com/site/searchpage.jsp?st=",
    goodwill: "https://shopgoodwill.com/categories/search?q=",
    dollartree: "https://www.dollartree.com/searchresults?Ntt=",
    dollartreeJson: "https://www.dollartree.com/ccstoreui/v1/search?Ntt=",
    google: "https://www.google.com/search?q=",
    shopping: "https://www.google.com/search?tbm=shop&q=",
  };

  var PROVIDERS = [
    {
      id: "hw-price-guide",
      name: "HW Price Guide",
      kind: "snapshot",
      canLiveFetch: false,
      lastSuccess: "August 2026",
      status: "snapshot",
      userEntered: false,
      detail:
        "Static snapshot for the F40, Civic Custom, Lotus Sport Elise, Impala, and Mustang GTD. A browser page cannot refresh this guide. Live numbers need a backend and credentials.",
    },
    {
      id: "fanatics",
      name: "Fanatics Collect",
      kind: "snapshot",
      canLiveFetch: false,
      lastSuccess: "September 7, 2026",
      status: "snapshot",
      userEntered: false,
      detail: "Topps Series 1 sold range from September 7, 2026. Not a live feed.",
    },
    {
      id: "dollar-tree",
      name: "Dollar Tree",
      kind: "live",
      canLiveFetch: true,
      lastSuccess: null,
      status: "blocked",
      userEntered: false,
      detail:
        "Search opens on dollartree.com. Fetching a price from GitHub Pages is blocked by the store (CORS). A blocked fetch keeps the last real value, which for untracked items is no settled sale.",
    },
    {
      id: "walmart",
      name: "Walmart",
      kind: "link",
      canLiveFetch: false,
      lastSuccess: null,
      status: "blocked",
      userEntered: false,
      detail: "Shelf counts are not available to this static app. The Walmart link is a search, not a stock check.",
    },
    {
      id: "target",
      name: "Target",
      kind: "link",
      canLiveFetch: false,
      lastSuccess: null,
      status: "blocked",
      userEntered: false,
      detail: "Target search opens in a new tab. This app does not read Target inventory.",
    },
    {
      id: "bestbuy",
      name: "Best Buy",
      kind: "link",
      canLiveFetch: false,
      lastSuccess: null,
      status: "blocked",
      userEntered: false,
      detail: "Best Buy search opens in a new tab. Open-box prices are not fetched.",
    },
    {
      id: "goodwill",
      name: "ShopGoodwill",
      kind: "link",
      canLiveFetch: false,
      lastSuccess: null,
      status: "blocked",
      userEntered: false,
      detail: "ShopGoodwill search opens in a new tab. Local pegs are usually not online.",
    },
    {
      id: "user",
      name: "You",
      kind: "user",
      canLiveFetch: false,
      lastSuccess: null,
      status: "user-entered",
      userEntered: true,
      detail: "Numbers you type in Profit or on a shelf field stay labeled as yours. They do not become a tracked sale.",
    },
  ];

  function providerById(id) {
    for (var i = 0; i < PROVIDERS.length; i++) {
      if (PROVIDERS[i].id === id) return PROVIDERS[i];
    }
    return null;
  }

  function refreshPlan(provider) {
    var row = typeof provider === "string" ? providerById(provider) : provider;
    if (!row) {
      return { id: "", status: "error", updatesPrice: false, message: "Unknown source." };
    }
    if (!row.canLiveFetch) {
      return {
        id: row.id,
        status: row.status === "user-entered" ? "user-entered" : row.kind === "snapshot" ? "snapshot" : "blocked",
        updatesPrice: false,
        message:
          row.kind === "snapshot"
            ? "Live refresh needs a backend. The last trusted snapshot stays."
            : "This source is not fetched from the browser. Last real value kept.",
      };
    }
    return {
      id: row.id,
      status: "attempt",
      updatesPrice: false,
      message: "Trying the store. A result will not be saved as a settled sale.",
    };
  }

  function applyRefreshResult(currentPrice, result) {
    if (result && result.updatesPrice) {
      throw new Error("Refresh is not allowed to replace a price in this app.");
    }
    return currentPrice;
  }

  function checkHref(base, query) {
    return String(base || "") + encodeURIComponent(query || "");
  }

  return {
    CHECK: CHECK,
    PROVIDERS: PROVIDERS,
    providerById: providerById,
    refreshPlan: refreshPlan,
    applyRefreshResult: applyRefreshResult,
    checkHref: checkHref,
  };
});
