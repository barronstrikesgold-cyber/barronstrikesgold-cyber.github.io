(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ResellerAmazon = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Stored data keeps clean https://www.amazon.com/dp/ASIN URLs.
  // tagUrl, productUrl, and buyHref add the Associates tag when a link is rendered.
  // TODO: look up ASINs through Amazon's Product Advertising API. Amazon blocks
  // automated HTML access and tells callers to use PA-API instead of scraping.
  var TAG = "hempsply02-20";
  var DISCLOSURE = "As an Amazon Associate I earn from qualifying purchases.";
  var ASIN_RE = /^[A-Z0-9]{10}$/;
  var PRODUCT_PATH = /\/(?:dp|gp\/product|gp\/aw\/d|gp\/offer-listing|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?=\/|[?#]|$)/i;

  function isBuyCheck(verdict) {
    var code = String(verdict || "").trim().toUpperCase();
    return code === "BUY" || code === "CHECK";
  }

  function amazonHost(hostname) {
    return /(^|\.)amazon\.com$/i.test(String(hostname || ""));
  }

  function asinFromUrl(value) {
    var raw = String(value || "").trim();
    if (!raw || raw.toLowerCase().indexOf("amazon.com") === -1) return "";
    try {
      var url = new URL(raw);
      if (!amazonHost(url.hostname)) return "";
      var match = url.pathname.match(PRODUCT_PATH);
      if (match && ASIN_RE.test(match[1].toUpperCase())) return match[1].toUpperCase();
    } catch (err) {
      return "";
    }
    return "";
  }

  function isProductUrl(value) {
    return Boolean(asinFromUrl(value));
  }

  function cleanProductUrl(asin) {
    var code = String(asin || "").trim().toUpperCase();
    if (!ASIN_RE.test(code)) return "";
    return "https://www.amazon.com/dp/" + code;
  }

  function productUrl(asin) {
    var clean = cleanProductUrl(asin);
    return clean ? clean + "?tag=" + TAG : "";
  }

  function searchUrl(query) {
    return "https://www.amazon.com/s?k=" + encodeURIComponent(String(query || "").trim()) + "&tag=" + TAG;
  }

  function ebayUrl(query, sold) {
    var url = "https://www.ebay.com/sch/i.html?_nkw=" + encodeURIComponent(String(query || "").trim()) + "&_sacat=0";
    if (sold) url += "&LH_Sold=1&LH_Complete=1";
    return url;
  }

  function tagUrl(value) {
    var raw = String(value == null ? "" : value);
    var asin = asinFromUrl(raw);
    if (!asin) return raw;
    var url = new URL(raw);
    if (url.protocol === "https:" && url.hostname === "www.amazon.com" && url.searchParams.get("tag") === TAG) return raw;
    url.protocol = "https:";
    url.hostname = "www.amazon.com";
    url.searchParams.set("tag", TAG);
    return url.toString();
  }

  function sameProduct(left, right) {
    var a = asinFromUrl(left);
    var b = asinFromUrl(right);
    return Boolean(a && b && a === b);
  }

  function directAsin(item) {
    if (!item || typeof item !== "object") return "";
    var keys = ["asin", "amazonAsin", "ASIN"];
    for (var i = 0; i < keys.length; i++) {
      var code = String(item[keys[i]] || "").trim().toUpperCase();
      if (ASIN_RE.test(code)) return code;
    }
    return "";
  }

  function knownAsin(item) {
    var direct = directAsin(item);
    if (direct) return direct;
    if (!item || typeof item !== "object") return "";
    var keys = ["amazonUrl", "buyUrl", "retailUrl"];
    for (var i = 0; i < keys.length; i++) {
      var asin = asinFromUrl(item[keys[i]]);
      if (asin) return asin;
    }
    return "";
  }

  function hasProductLink(item) {
    if (!item || typeof item !== "object") return false;
    return isProductUrl(item.amazonUrl) || isProductUrl(item.buyUrl) || isProductUrl(item.retailUrl);
  }

function buyHref(item, verdict) {
  var code = verdict != null ? verdict : item && (item.resaleVerdict || item.verdict);
  if (!isBuyCheck(code)) return "";
  return productUrl(knownAsin(item));
}

function searchQuery(item) {
  if (typeof item === "string") return String(item).replace(/\s+/g, " ").trim();
  if (!item || typeof item !== "object") return "";
  var bits = [];
  function add(value) {
    var text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    if (!text || text.length > 90) return;
    if (bits.join(" ").toLowerCase().indexOf(text.toLowerCase()) !== -1) return;
    bits.push(text);
  }
  add(item.name || item.id || "");
  add(item.brand);
  add(item.edition);
  add(item.platforms);
  add(item.format);
  add(item.series);
  add(item.category);
  if (item.section === "games") add("Video games");
  return bits.join(" ").trim();
}

// Always-on offer. buyHref stays limited to BUY/CHECK so the stored-link stamp does not change.
function offerUrl(item) {
  var asin = knownAsin(item);
  if (asin) return productUrl(asin);
  return searchUrl(searchQuery(item));
}

  function tagText(value, stats) {
    if (typeof value !== "string" || value.toLowerCase().indexOf("amazon.com") === -1) return value;
    return value.replace(/https?:\/\/[^\s"'<>]+/gi, function (found) {
      var trimmed = found.replace(/[),.;]+$/g, "");
      var suffix = found.slice(trimmed.length);
      if (!isProductUrl(trimmed)) return found;
      stats.productLinks += 1;
      var next = cleanProductUrl(asinFromUrl(trimmed));
      if (next !== trimmed) stats.tagged += 1;
      return next + suffix;
    });
  }

  function stampAssociates(value) {
    var stats = { tagged: 0, added: 0, productLinks: 0 };
    function walk(node) {
      if (typeof node === "string") return tagText(node, stats);
      if (Array.isArray(node)) return node.map(walk);
      if (!node || typeof node !== "object") return node;
      var next = {};
      Object.keys(node).forEach(function (key) {
        next[key] = walk(node[key]);
      });
      var verdict = next.resaleVerdict || next.verdict;
      if (isBuyCheck(verdict) && knownAsin(next) && !hasProductLink(next)) {
        next.amazonUrl = cleanProductUrl(knownAsin(next));
        stats.added += 1;
      }
      return next;
    }
    return { value: walk(value), tagged: stats.tagged, added: stats.added, productLinks: stats.productLinks };
  }

  return {
    TAG: TAG,
    DISCLOSURE: DISCLOSURE,
    isBuyCheck: isBuyCheck,
    asinFromUrl: asinFromUrl,
    isProductUrl: isProductUrl,
    cleanProductUrl: cleanProductUrl,
    productUrl: productUrl,
    searchUrl: searchUrl,
    ebayUrl: ebayUrl,
    tagUrl: tagUrl,
    sameProduct: sameProduct,
    knownAsin: knownAsin,
    buyHref: buyHref,
    searchQuery: searchQuery,
    offerUrl: offerUrl,
    stampAssociates: stampAssociates,
  };
});
