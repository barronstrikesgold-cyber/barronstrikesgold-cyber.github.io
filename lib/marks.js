(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HuntMarks = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var CHIP_WORDS = {
    all: "All",
    latest: "Latest",
    "hot-wheels": "Hot Wheels",
    matchbox: "Matchbox",
    pokemon: "Pokémon",
    golf: "Golf",
  };

  function brandWord(label) {
    return String(label == null ? "" : label).replace(/\s+/g, " ").trim();
  }

  function chipWord(id, fallback) {
    if (Object.prototype.hasOwnProperty.call(CHIP_WORDS, id)) return CHIP_WORDS[id];
    return brandWord(fallback || id);
  }

  function dropBrand(row) {
    var name = row && row.name ? String(row.name) : "";
    if (/matchbox/i.test(name)) return "Matchbox";
    if (/hot wheels/i.test(name)) return "Hot Wheels";
    if (/pok[eé]mon/i.test(name)) return "Pokémon";
    if (/topps/i.test(name)) return "Topps";
    if (/upper deck/i.test(name)) return "Upper Deck";
    if (/panini/i.test(name)) return "Panini";
    if (row && row.category) return brandWord(row.category);
    return "Release";
  }

  function licensedProduct(sources, id) {
    var list = sources && sources.licenses;
    if (!id || !Array.isArray(list)) return null;
    var row = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) row = list[i];
    }
    if (!row || row.written !== true || row.kind !== "product") return null;
    if (!row.src || /logo/i.test(String(row.src))) return null;
    var width = Number(row.width);
    var height = Number(row.height);
    return {
      src: String(row.src),
      width: width > 0 ? width : 144,
      height: height > 0 ? height : 108,
      alt: brandWord(row.alt || ""),
    };
  }

  return {
    brandWord: brandWord,
    chipWord: chipWord,
    dropBrand: dropBrand,
    licensedProduct: licensedProduct,
  };
});
