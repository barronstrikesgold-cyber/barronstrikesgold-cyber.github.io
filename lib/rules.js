(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResellerRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Peg rule: buy gold-flame STH, Car Culture / Fast & Furious Spectraflame chase,
  // and Matchbox SUPER CHASE at peg price. Leave the rest unless Selective and a
  // last sold clears fees. Sheet figures are late Sep 2026 comps, not a live sale.
  // A sourced comp still needs a real https URL that is not a search page.
  var STH_TELL = "Spectraflame, Real Riders, and the tiny TH inside a gold flame. Supers share a UPC with the regular. Read the card.";
  var STH_2027 = "Too new for a sold. Buy when the card is gold-flame: Spectraflame, Real Riders, and the tiny gold-flame TH. Read the card. Later cases use the same ID.";
  var MB_TELL = "The card must say SUPER CHASE. If those words are missing, leave it.";

  function sth(tells, sold, high, flag) {
    return {
      lane: "sth",
      verdict: "Buy",
      pay: "Pay ~$1.25",
      tells: tells || STH_TELL,
      lastSold: sold == null ? null : sold,
      lastSoldHigh: high == null ? null : high,
      soldFlag: flag || "",
    };
  }

  function chase(lane, pay, tells, sold, high) {
    return {
      lane: lane,
      verdict: "Buy",
      pay: pay,
      tells: tells,
      lastSold: sold == null ? null : sold,
      lastSoldHigh: high == null ? null : high,
      soldFlag: "",
    };
  }

  function pass(lane, pay, tells, sold, high) {
    return {
      lane: lane,
      verdict: "Pass",
      pay: pay,
      tells: tells,
      lastSold: sold == null ? null : sold,
      lastSoldHigh: high == null ? null : high,
      soldFlag: "",
    };
  }

  var LANES = {
    sth: {
      title: "Hot Wheels Supers",
      kicker: "Gold flame",
      blurb: "Spectraflame, Real Riders, tiny TH.",
      rule: "Buy the gold-flame Super at peg price. Spectraflame paint, Real Riders, and the tiny TH inside a gold flame. Regular mainlines are not flips. Supers share a UPC with the regular, so read the card.",
    },
    cc: {
      title: "Car Culture chase",
      kicker: "0/5 gold",
      blurb: "Gold chase card only.",
      rule: "Buy only the gold or Spectraflame chase card, about $7. Filler Car Culture stays on the peg.",
    },
    ff: {
      title: "Fast & Furious chase",
      kicker: "Spectraflame",
      blurb: "Chase card only.",
      rule: "Buy the Spectraflame chase only, about $6–$8. The regular cars in the set are a leave.",
    },
    mbsc: {
      title: "Matchbox Super Chase",
      kicker: "Card text",
      blurb: "The card must say SUPER CHASE.",
      rule: "Buy only if the card says SUPER CHASE. Pay about $1–$2. Every other Matchbox stays on the peg.",
    },
    leave: {
      title: "Leave these",
      kicker: "Always pass",
      blurb: "Mainlines, silver TH, common premium.",
      rule: "Leave basic mainlines, silver-flame regular Treasure Hunts, common exclusives, regular Matchbox, and Cars movie cars that do not say SUPER CHASE.",
    },
    selective: {
      title: "Selective",
      kicker: "Default pass",
      blurb: "Only if a sold clears fees.",
      rule: "Default Pass for aisle speed. Team Transport, Boulevard, ZAMAC, Red, and RLC stay here. Buy only when you already know a last sold that clears fees.",
    },
    pokemon: {
      title: "Pokémon",
      kicker: "Sealed MSRP",
      blurb: "Named boxes at the printed price.",
      rule: "Buy the 30th Celebration ETB only at printed $49.99, Knockout near $19.99, Tech Sticker at printed MSRP, Booster Bundle only at $59.99, and Japanese M6a only near ¥7200. Pass Wave 2 and any secondary markup.",
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
    walmart: ["sth", "cc", "ff", "mbsc", "leave", "selective", "pokemon", "sports", "tech"],
    target: ["sth", "cc", "ff", "mbsc", "leave", "selective", "pokemon", "sports", "streetwear"],
    goodwill: ["golf", "sneakers", "streetwear", "tech"],
    bestbuy: ["tech"],
    dollartree: ["sth", "cc", "ff", "mbsc", "leave", "selective"],
  };

  var CARDS = {
    cuda: sth("Gold '70 AAR Cuda. " + STH_TELL, 100),
    firebird: sth("Blue '67 Firebird. A plain blue Firebird is a leave. " + STH_TELL, 126, null, "sparse"),
    subaru: sth("Subaru Impreza Super. Not the Skyline. Spectraflame blue Impreza, Real Riders, and the tiny TH inside a gold flame. Supers share a UPC with the regular. Read the card.", 68),
    f40: sth("Ferrari F40. " + STH_TELL, 148),
    civic: sth("Civic Custom. The regular Civic is not the flip. " + STH_TELL, 56),
    lotus: sth("Lotus Sport Elise. Not the Elite. " + STH_TELL, 31),
    mustang: sth("Mustang GTD. " + STH_TELL, 51),
    impala: sth("Teal '64 Impala. " + STH_TELL, 48),
    porsche: sth("Brown/Gold Porsche 911. " + STH_TELL, 104),
    drift: sth("Drift-Ender. " + STH_TELL, 22),
    sierra: sth("'87 Sierra Cosworth. " + STH_TELL, 40),
    otto: sth("Custom Otto. " + STH_TELL, 29),
    "supra-tooned": sth("'94 Toyota Supra Tooned. " + STH_TELL, 37),
    maxima: sth("Nissan Maxima Drift. " + STH_TELL, 48),
    ram: sth("'23 Ram 1500. " + STH_TELL, 89),
    lincoln: sth("'64 Lincoln Continental. " + STH_2027),
    m4: sth("BMW M4 GT3. " + STH_2027),
    d100: sth("'87 Dodge D100. " + STH_2027),
    starion: sth("'88 Mitsubishi Starion. " + STH_2027),
    db5: sth("Aston Martin DB5 Safari. " + STH_2027),
    ferrari12: sth("Ferrari 12Cilindri. " + STH_2027),
    belair: chase("cc", "Pay ~$7", "Buy only the gold Bel Air chase card, 0/5. Filler Car Culture stays on the peg.", 88, 90),
    datsun: chase("cc", "Pay ~$7", "Buy only the gold Datsun 510 chase card, 0/5. Filler Car Culture stays on the peg.", 63, 75),
    "ff-supra": chase("ff", "Pay ~$6–$8", "Buy the Spectraflame Supra chase only. The regular Supra in the set is a leave.", 64, 68),
    "mb-integra": chase("mbsc", "Pay ~$1–$2", "Acura Integra Type R, Mix H. No solid solds. " + MB_TELL),
    "mb-911": chase("mbsc", "Pay ~$1–$2", "'85 Porsche 911 Rally. " + MB_TELL, 30, 60),
    "mb-jag": chase("mbsc", "Pay ~$1–$2", "'77 Jaguar XJ6C. " + MB_TELL, 25, 40),
    "mb-bronco": chase("mbsc", "Pay ~$1–$2", "'78 Ford Bronco, late 2026. Too new for a sold. " + MB_TELL),
    "mb-gtr": chase("mbsc", "Pay ~$1–$2", "Nissan GT-R NISMO is reported only. Confirm the card says SUPER CHASE before you buy."),
    "mb-356": chase("mbsc", "Pay ~$1–$2", "Moving Parts Porsche 356A. " + MB_TELL, 15, 25),
    "mb-vanquish": chase("mbsc", "Pay ~$1–$2", "2027 Aston Martin Vanquish. Too new for a sold. " + MB_TELL),
    "mb-defender": chase("mbsc", "Pay ~$1–$2", "2027 Moving Parts Defender 130. Too new for a sold. " + MB_TELL),
    skyline: pass("leave", "Pay ~$1.25", "Regular Treasure Hunt. Silver flame, not a Super. Leave it."),
    mainline: pass("leave", "Pay ~$1.25", "Basic mainline. Not a gold-flame Super. Leave it."),
    exclusives: pass("leave", "Pay premium", "Common store exclusive. Leave it unless it is a gold-flame Super, a named chase, or a card that says SUPER CHASE."),
    "mb-regular": pass("leave", "Pay ~$1–$2", "Regular Matchbox. The card does not say SUPER CHASE. Leave it."),
    "cars-movie": pass("leave", "Pay ~$1–$2", "Cars movie car. Leave it unless the card says SUPER CHASE."),
    matchbox: pass("leave", "Pay ~$1–$2", "2024 Nissan Z prints SUPER CHASE, but it is not on this late-2026 peg list. Buy the named Super Chases in Matchbox Super Chase."),
    "tt-msrp": pass("selective", "Pay about MSRP", "Team Transport at about MSRP. Default Pass. Only if a last sold under MSRP clears fees."),
    boulevard: pass("selective", "Pay premium", "Boulevard. Default Pass unless you already know a last sold that clears fees. No sold data stored."),
    zamac: pass("selective", "Pay premium", "ZAMAC. Default Pass unless a last sold clears fees. No sold data stored."),
    "red-supra": pass("selective", "Pay ~$6", "Red Edition. The Supra example is a thin sold. Net does not clear a premium peg after fees. Default Pass.", 11),
    "tt-under": pass("selective", "Pay under MSRP", "Team Transport under MSRP. Default Pass unless you already know a fat sold that clears fees."),
    rlc: pass("selective", "Secondary", "RLC chrome chase. Default Pass until a chrome chase comp clears fees. No sold data stored."),
    etb: {
      lane: "pokemon",
      verdict: "Buy",
      pay: "Printed $49.99",
      tells: "English 30th Celebration Elite Trainer Box. Buy only at the printed $49.99. Any other sticker is a Pass.",
    },
    knockout: {
      lane: "pokemon",
      verdict: "Buy",
      pay: "Printed ~$19.99",
      tells: "Knockout. Buy only near the printed $19.99. A markup is a Pass. No sold data.",
    },
    "tech-sticker": {
      lane: "pokemon",
      verdict: "Buy",
      pay: "Printed MSRP",
      tells: "Tech Sticker. Buy only at the printed MSRP. Do not invent the sticker price. A markup is a Pass. No sold data.",
    },
    bundle: {
      lane: "pokemon",
      verdict: "Buy",
      pay: "Printed $59.99",
      tells: "Booster Bundle. Buy only at the printed $59.99. Any higher sticker is a Pass. No sold data.",
    },
    m6a: {
      lane: "pokemon",
      verdict: "Buy",
      pay: "Near ¥7200",
      tells: "Japanese M6a 30th CELEBRATION. Buy only near ¥7200. No sold data.",
    },
    "poke-wave2": {
      lane: "pokemon",
      verdict: "Pass",
      pay: "Not a target",
      tells: "Wave 2. Pass. It is not one of the sealed MSRP targets.",
    },
    "poke-markup": {
      lane: "pokemon",
      verdict: "Pass",
      pay: "Above MSRP",
      tells: "Secondary markup. Pass. The named boxes are a buy only at the printed price.",
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
    "hw-pq-cal": { verdict: "Buy", tells: "Case P and Q. Gold-flame Supers only. Read the card." },
    "hw-sth-pegs": { verdict: "Buy", tells: "2026 gold-flame Supers still on pegs. Read the card. A case code is freight, not a national day." },
    "mb-sc-2026": { verdict: "Buy", tells: "Matchbox Super Chase still landing, including the late 2026 Bronco. The card must say SUPER CHASE." },
    "hw-sth-2027": { verdict: "Buy", tells: "Early 2027 gold-flame Supers. Buy when the card matches. Too new for a sold." },
    "mb-sc-2027": { verdict: "Buy", tells: "2027 Vanquish and Defender 130 Super Chase. Buy when the card says SUPER CHASE. Too new for a sold." },
    "etb-cal": { verdict: "Buy", tells: "Printed $49.99 only. No sold data." },
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

  function payFor(item) {
    var rule = item && CARDS[item.id];
    return rule && rule.pay ? rule.pay : "";
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

  function netOf(sold) {
    return Math.round(Number(sold) * 0.87 - 5);
  }

  function moneyOf(item) {
    var rule = item && CARDS[item.id];
    if (!rule || rule.lastSold == null || !isFinite(Number(rule.lastSold))) return null;
    var low = Number(rule.lastSold);
    var high = rule.lastSoldHigh == null ? null : Number(rule.lastSoldHigh);
    var sold = high == null ? "~$" + low : "~$" + low + "–$" + high;
    if (rule.soldFlag) sold += " " + rule.soldFlag;
    var net = high == null ? "~$" + netOf(low) : "~$" + netOf(low) + "–$" + netOf(high);
    return {
      sold: sold,
      net: net,
      note: "Sheet late Sep 2026. Not a live sale.",
    };
  }

  function priceLine(item) {
    var comp = compOf(item);
    if (comp) return comp.label;
    var money = moneyOf(item);
    if (!money) return "No sold data";
    return "Last sold " + money.sold + " · Net " + money.net;
  }

  function dropVerdict(id) {
    return DROP_VERDICT[id] || { verdict: "Pass", tells: "Not on this hunt. No sold data." };
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
    payFor: payFor,
    laneFor: laneFor,
    isSourceUrl: isSourceUrl,
    compOf: compOf,
    moneyOf: moneyOf,
    netOf: netOf,
    priceLine: priceLine,
    dropVerdict: dropVerdict,
    byLane: byLane,
  };
});
