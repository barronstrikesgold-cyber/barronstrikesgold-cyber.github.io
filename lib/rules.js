(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResellerRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Locked rule: if it is not on the buy list, leave it.
  // A sold comp is shown only when a real source URL is stored.
  var LANES = {
    hotwheels: {
      title: "Hot Wheels",
      kicker: "Supers",
      blurb: "Gold-flame Supers only.",
      rule: "Buy the gold-flame Super: Spectraflame paint, Real Riders, and the tiny TH inside a gold flame. Regular mainlines are not flips. Supers share a UPC with the regular, so read the card.",
    },
    matchbox: {
      title: "Matchbox",
      kicker: "One tell",
      blurb: "SUPER CHASE only.",
      rule: "Buy only if the card says SUPER CHASE. Every other Matchbox stays on the peg.",
    },
    pokemon: {
      title: "Pokémon",
      kicker: "Two boxes",
      blurb: "ETB at $49.99, or M6a near ¥7200.",
      rule: "30th Celebration ETB only at the printed $49.99. Japanese M6a 30th CELEBRATION only near ¥7200. Any other Pokémon product is a leave.",
    },
    golf: {
      title: "Golf",
      kicker: "Name brands",
      blurb: "Name-brand clubs only.",
      rule: "Name-brand flips only. No sold data is stored, so do not invent a price. Pass a no-name club or a cracked head.",
    },
    sports: {
      title: "Sports",
      kicker: "Mostly pass",
      blurb: "Blisters at printed price are a pass.",
      rule: "Sports blister packs are a Pass at the printed price. No sold data is stored for these boxes.",
    },
    sneakers: {
      title: "Sneakers",
      kicker: "Secondary",
      blurb: "Not a blind buy.",
      rule: "Secondary lane. Not on the buy list. Leave the pair unless you already know that exact colorway, it is clean, and the size tag is on.",
    },
    tech: {
      title: "Tech",
      kicker: "Secondary",
      blurb: "Powers on, and not locked.",
      rule: "Secondary lane. Not on the buy list. Leave it unless it powers on, is not locked, and you already know what it sold for.",
    },
    streetwear: {
      title: "Streetwear",
      kicker: "Secondary",
      blurb: "Tagged pieces only.",
      rule: "Secondary lane. Not on the buy list. Leave it unless the piece is tagged and you already know that exact item.",
    },
  };

  var STORE_LANES = {
    walmart: ["hotwheels", "matchbox", "pokemon", "sports", "tech"],
    target: ["hotwheels", "matchbox", "pokemon", "sports", "streetwear"],
    goodwill: ["golf", "sneakers", "streetwear", "tech"],
    bestbuy: ["tech"],
    dollartree: ["hotwheels", "matchbox"],
  };

  var CARDS = {
    cuda: {
      lane: "hotwheels",
      verdict: "Buy",
      tells: "Spectraflame gold, Real Riders, gold flame on the card. Read the card. The regular shares this UPC.",
    },
    firebird: {
      lane: "hotwheels",
      verdict: "Buy",
      tells: "Spectraflame blue, Real Riders, gold flame. Read the card. A plain blue Firebird is a leave.",
    },
    f40: {
      lane: "hotwheels",
      verdict: "Buy",
      tells: "Spectraflame, Real Riders, gold flame. Read the card before you pay more than the peg.",
    },
    civic: {
      lane: "hotwheels",
      verdict: "Buy",
      tells: "Spectraflame, Real Riders, gold flame. Read the card. The regular Civic is not the flip.",
    },
    lotus: {
      lane: "hotwheels",
      verdict: "Buy",
      tells: "Spectraflame orange Elise, Real Riders, gold flame. Not the Elite. Read the card.",
    },
    impala: {
      lane: "hotwheels",
      verdict: "Buy",
      tells: "Spectraflame, Real Riders, gold flame on the '64 Impala card. Read the card.",
    },
    mustang: {
      lane: "hotwheels",
      verdict: "Buy",
      tells: "Spectraflame, Real Riders, gold flame on the Mustang GTD card. Read the card.",
    },
    porsche: {
      lane: "hotwheels",
      verdict: "Buy",
      tells: "Spectraflame brown 911, Real Riders, gold flame. Read the card. No sold data.",
    },
    skyline: {
      lane: "hotwheels",
      verdict: "Pass",
      tells: "Regular Treasure Hunt. Silver flame, not a Super. Leave it.",
    },
    matchbox: {
      lane: "matchbox",
      verdict: "Buy",
      tells: "The card must say SUPER CHASE. If those words are missing, leave it.",
    },
    etb: {
      lane: "pokemon",
      verdict: "Buy",
      tells: "30th Celebration Elite Trainer Box. Buy only at the printed $49.99. Any other sticker is a Pass.",
    },
    m6a: {
      lane: "pokemon",
      verdict: "Buy",
      tells: "Japanese M6a 30th CELEBRATION. Buy only near ¥7200. No sold data.",
    },
    "topps-s1": { lane: "sports", verdict: "Pass", tells: "Printed price is a Pass. No sold data with a source link." },
    "topps-fb": { lane: "sports", verdict: "Pass", tells: "Printed blaster is a Pass. No sold data." },
    fifa: { lane: "sports", verdict: "Pass", tells: "Printed soccer blaster is a Pass. No sold data." },
    artifacts: { lane: "sports", verdict: "Pass", tells: "Leave it until it is on a shelf and a sourced sold exists. No sold data." },
    "optic-fb": { lane: "sports", verdict: "Pass", tells: "Printed blaster is a Pass. No sold data." },
    "chrome-fb": { lane: "sports", verdict: "Pass", tells: "Printed hanger is a Pass. No sold data." },
    "select-fb": { lane: "sports", verdict: "Pass", tells: "Printed mega is a Pass. No sold data." },
    wnba: { lane: "sports", verdict: "Pass", tells: "Printed hanger is a Pass. No sold data." },
    "bowman-bb": { lane: "sports", verdict: "Pass", tells: "Printed box is a Pass. No sold data." },
    "jordan-1": { lane: "sneakers", verdict: "Pass", tells: "Not on the buy list. Clean, tagged, US 8–12 only if you already know the colorway. No size tag is a pass." },
    "dunk-sb": { lane: "sneakers", verdict: "Pass", tells: "Not on the buy list. SB is not a regular Dunk, and there is still no sold data." },
    "nb-550": { lane: "sneakers", verdict: "Pass", tells: "Not on the buy list. No sold data. Pass beaters and pairs with no size tag." },
    "jordan-3": { lane: "sneakers", verdict: "Pass", tells: "Not on the buy list. No sold data for a single colorway." },
    "jordan-4": { lane: "sneakers", verdict: "Pass", tells: "Not on the buy list. No sold data. Pass crushed pairs." },
    "jordan-11": { lane: "sneakers", verdict: "Pass", tells: "Not on the buy list. No sold data." },
    "nb-990": { lane: "sneakers", verdict: "Pass", tells: "Not on the buy list. No sold data." },
    "nb-2002r": { lane: "sneakers", verdict: "Pass", tells: "Not on the buy list. No sold data." },
    samba: { lane: "sneakers", verdict: "Pass", tells: "Not on the buy list. No sold data." },
    yeezy: { lane: "sneakers", verdict: "Pass", tells: "Not on the buy list. No sold data. Leave it if you cannot name the colorway." },
    iphone: { lane: "tech", verdict: "Pass", tells: "Not on the buy list. Leave locked phones and anything that does not power on. No sold data." },
    ipad: { lane: "tech", verdict: "Pass", tells: "Not on the buy list. It has to power on and stay unlocked. No sold data." },
    macbook: { lane: "tech", verdict: "Pass", tells: "Not on the buy list. It has to boot. No sold data." },
    airpods: { lane: "tech", verdict: "Pass", tells: "Not on the buy list. They have to pair. No sold data." },
    watch: { lane: "tech", verdict: "Pass", tells: "Not on the buy list. It has to pair. No sold data." },
    switch: { lane: "tech", verdict: "Pass", tells: "Not on the buy list. It has to power on. No sold data." },
    supreme: { lane: "streetwear", verdict: "Pass", tells: "Not on the buy list. Tagged box logo or a known collab only. No size tag is a pass. No sold data." },
    bape: { lane: "streetwear", verdict: "Pass", tells: "Not on the buy list. Tagged Bape only. No sold data." },
    "nike-adidas": { lane: "streetwear", verdict: "Pass", tells: "Not on the buy list. Tagged collab only. No sold data." },
  };

  var ORDER = Object.keys(CARDS);

  var DROP_VERDICT = {
    "hw-pq-cal": { verdict: "Buy", tells: "Case P and Q. Buy the gold-flame Supers only. Read the card." },
    "etb-cal": { verdict: "Buy", tells: "Buy only at the printed $49.99. No sold data." },
  };

  function laneMeta(id) {
    return LANES[id] || null;
  }

  function storeLanes(storeId) {
    return (STORE_LANES[storeId] || []).slice();
  }

  function cardRule(id) {
    return CARDS[id] || null;
  }

  function verdictFor(item) {
    if (!item) return "Pass";
    if (item.kind === "golf") return "Buy";
    var rule = CARDS[item.id];
    return rule ? rule.verdict : "Pass";
  }

  function tellsFor(item) {
    if (!item) return "If it is not on the buy list, leave it.";
    if (item.kind === "golf") return "Name-brand club. No sold data, so do not invent a price.";
    var rule = CARDS[item.id];
    return rule ? rule.tells : "If it is not on the buy list, leave it.";
  }

  function laneFor(item) {
    if (!item) return "";
    if (item.kind === "golf") return "golf";
    var rule = CARDS[item.id];
    return rule ? rule.lane : "";
  }

  function isSourceUrl(url) {
    if (!url || String(url).indexOf("https://") !== 0) return false;
    return !/search\?|searchTerm|searchpage|Ntt=|tbm=shop/i.test(String(url));
  }

  function compOf(item) {
    if (!item || !item.compLabel || !isSourceUrl(item.sourceUrl)) return null;
    return {
      label: String(item.compLabel),
      url: String(item.sourceUrl),
      source: item.compSource ? String(item.compSource) : "Source",
    };
  }

  function priceLine(item) {
    var comp = compOf(item);
    return comp ? comp.label : "No sold data";
  }

  function dropVerdict(id) {
    return DROP_VERDICT[id] || { verdict: "Pass", tells: "Not on the buy list. Leave it. No sold data." };
  }

  function byLane(items, lane) {
    return (items || [])
      .filter(function (item) {
        return laneFor(item) === lane;
      })
      .slice()
      .sort(function (a, b) {
        var av = verdictFor(a) === "Buy" ? 0 : 1;
        var bv = verdictFor(b) === "Buy" ? 0 : 1;
        if (av !== bv) return av - bv;
        var ai = ORDER.indexOf(a.id);
        var bi = ORDER.indexOf(b.id);
        if (ai < 0) ai = 999;
        if (bi < 0) bi = 999;
        if (ai !== bi) return ai - bi;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }

  return {
    LANES: LANES,
    STORE_LANES: STORE_LANES,
    CARDS: CARDS,
    laneMeta: laneMeta,
    storeLanes: storeLanes,
    cardRule: cardRule,
    verdictFor: verdictFor,
    tellsFor: tellsFor,
    laneFor: laneFor,
    isSourceUrl: isSourceUrl,
    compOf: compOf,
    priceLine: priceLine,
    dropVerdict: dropVerdict,
    byLane: byLane,
  };
});
