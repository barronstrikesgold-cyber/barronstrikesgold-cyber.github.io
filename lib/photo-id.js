/* Hunt photo identification helpers (window.HuntPhoto). Loaded only when "Identify from photo" is used.
 * 1. OCR on the phone with Tesseract.js (from jsDelivr, lazy). The photo never leaves the device for this step.
 * 2. Pull codes from the read text: Mattel item codes (JDP89 / JDP89-0910), assortment codes (FYJ44, C4982),
 *    UPC / EAN digits, Pokémon card numbers (158/128), LEGO set numbers, and name words.
 * 3. Rank Hunt's own names (catalog, price list, Monster Trucks, tracker) against the words.
 * 4. Optional, off by default: an owner-run vision proxy (hunt-vision-proxy) gets a downscaled copy and returns guesses.
 * No API key lives in this file. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HuntPhoto = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TESSERACT = {
    script: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
    langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int",
  };
  var VISION_KEY = "hunt-vision-proxy";
  var POKEMON_API = "https://api.pokemontcg.io/v2/cards";
  var STOP = ("THE AND FOR WITH FROM THIS THAT YOUR YOU ARE NOT ALL ONE TWO NEW AGES AGE YEARS WARNING CHOKING HAZARD SMALL PARTS " +
    "CHILDREN UNDER MADE CHINA MALAYSIA THAILAND INDONESIA VIETNAM MATTEL INC LLC LTD RESERVED RIGHTS TRADEMARKS TRADEMARK OWNED " +
    "USED UNDER LICENSE PRODUCT COLORS DETAILS MAY VARY CONTENTS COLLECT THEM INCLUDES INCLUDED ITEM CODE ASST ASSORTMENT " +
    "KEEP PACKAGE INFORMATION FUTURE REFERENCE WWW COM HTTP HTTPS TOY TOYS PLEASE RETAIN").split(" ");
  var DIGIT_FOR = { O: "0", Q: "0", D: "0", I: "1", L: "1", Z: "2", S: "5", B: "8", G: "6", T: "7" };
  var LETTER_FOR = { "0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G", "7": "T", "4": "A" };

  function upper(text) {
    return String(text == null ? "" : text).toUpperCase();
  }

  function gtinCheck(body) {
    var sum = 0;
    for (var i = body.length - 1, k = 0; i >= 0; i--, k++) sum += (body.charCodeAt(i) - 48) * (k % 2 === 0 ? 3 : 1);
    return String((10 - (sum % 10)) % 10);
  }

  function validGtin(d) {
    return /^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(d) && gtinCheck(d.slice(0, -1)) === d.slice(-1);
  }

  /* 3 letters + 2 digits, fixing common OCR swaps by position. The raw token must hold a digit or a -XXXX suffix. */
  function fixMattel(token) {
    var t = upper(token).replace(/[^A-Z0-9-]/g, "");
    var m = /^([A-Z0-9]{3})([A-Z0-9]{2})(?:-?([A-Z0-9]{4,6}))?$/.exec(t);
    if (!m) return null;
    if (!/\d/.test(m[1] + m[2]) && !m[3]) return null;
    var head = m[1].split("").map(function (c) { return /\d/.test(c) ? LETTER_FOR[c] || "" : c; }).join("");
    var tail = m[2].split("").map(function (c) { return /[A-Z]/.test(c) ? DIGIT_FOR[c] || "" : c; }).join("");
    if (!/^[A-Z]{3}$/.test(head) || !/^\d{2}$/.test(tail)) return null;
    /* most of the token has to be as printed: at most one fix */
    var fixes = 0;
    for (var i = 0; i < 3; i++) if (head[i] !== m[1][i]) fixes++;
    for (var j = 0; j < 2; j++) if (tail[j] !== m[2][j]) fixes++;
    if (fixes > 1) return null;
    return head + tail;
  }

  function uniq(list) {
    var out = [];
    list.forEach(function (v) { if (v && out.indexOf(v) === -1) out.push(v); });
    return out;
  }

  function upcsIn(text) {
    var out = [];
    var runs = String(text || "").match(/\d[\d \t.-]{6,24}\d/g) || [];
    runs.forEach(function (run) {
      var d = run.replace(/\D/g, "");
      [12, 13, 8, 14].forEach(function (len) {
        for (var i = 0; i + len <= d.length; i++) {
          var c = d.slice(i, i + len);
          if (validGtin(c) && !/^0+$/.test(c)) {
            var short = len === 13 && c[0] === "0" ? c.slice(1) : len === 14 && c.slice(0, 2) === "00" ? c.slice(2) : c;
            if (len >= 12 || d.length === 8) out.push(short);
          }
        }
      });
    });
    return uniq(out);
  }

  function setNumbers(text) {
    var out = [];
    var re = /(?:^|[^\d])(\d{1,3})\s*\/\s*(\d{2,3})(?![\d])/g;
    var m;
    while ((m = re.exec(String(text || "")))) {
      var num = parseInt(m[1], 10);
      var total = parseInt(m[2], 10);
      if (num > 0 && total >= 10 && num <= total + 150) out.push({ number: String(num), total: String(total), raw: m[1] + "/" + m[2] });
    }
    return out;
  }

  function words(text) {
    var out = [];
    (upper(text).replace(/[’']/g, "").match(/[A-Z][A-Z0-9&]{2,}/g) || []).forEach(function (w) {
      if (STOP.indexOf(w) === -1 && !/^\d+$/.test(w) && out.indexOf(w) === -1) out.push(w);
    });
    return out;
  }

  /* text -> everything Hunt can look up. assort: known assortment codes (FYJ44, C4982, ...). */
  function extract(text, opts) {
    var o = opts || {};
    var raw = String(text || "");
    var U = upper(raw);
    var known = (o.assort || []).map(upper);
    var mattel = [];
    var assort = [];
    (U.match(/[A-Z0-9]{5}(?:-[A-Z0-9]{4,6})?|[A-Z0-9]{3}[ ]?[A-Z0-9]{2}-[A-Z0-9]{4,6}/g) || []).forEach(function (tok) {
      var t = tok.replace(/ /g, "");
      if (known.indexOf(t) !== -1) { assort.push(t); return; }
      var k = fixMattel(t);
      if (!k) return;
      if (known.indexOf(k) !== -1) assort.push(k);
      else mattel.push(k);
    });
    /* "ASST. C4982" style mainline assortment codes */
    (U.match(/\b[A-Z]\d{4}\b/g) || []).forEach(function (t) { if (known.indexOf(t) !== -1 || /ASST/.test(U)) assort.push(t); });
    var lego = [];
    if (/LEGO/.test(U)) (raw.match(/(?:^|\D)(\d{4,6})(?!\d)/g) || []).forEach(function (m) {
      var n = m.replace(/\D/g, "");
      if (n.length >= 4 && n.length <= 6 && !/^(19|20)\d\d$/.test(n)) lego.push(n);
    });
    var upcs = upcsIn(raw);
    return {
      text: raw.replace(/\s+\n/g, "\n").trim(),
      mattel: uniq(mattel),
      assort: uniq(assort),
      upcs: upcs,
      sets: setNumbers(raw),
      lego: uniq(lego).filter(function (n) { return !upcs.some(function (u) { return u.indexOf(n) !== -1; }); }),
      words: words(raw),
    };
  }

  function lev(a, b) {
    if (a === b) return 0;
    var prev = [];
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var cur = [i];
      for (var k = 1; k <= b.length; k++) cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }

  function nameTokens(name) {
    return (upper(name).replace(/[’']/g, "").match(/[A-Z0-9&]{2,}/g) || []).filter(function (w) { return STOP.indexOf(w) === -1; });
  }

  /* 0..1: share of the name's words seen in the photo text (OCR typos allowed on longer words) */
  function scoreName(name, photoWords) {
    var toks = nameTokens(name);
    if (!toks.length || !photoWords.length) return 0;
    var hit = 0;
    var weight = 0;
    toks.forEach(function (t) {
      var w = t.length >= 4 ? 1 : 0.5;
      weight += w;
      var best = 0;
      photoWords.forEach(function (p) {
        if (p === t) best = 1;
        else if (t.length >= 5 && p.length >= 4 && lev(p, t) <= (t.length >= 8 ? 2 : 1)) best = Math.max(best, 0.8);
        else if (t.length >= 6 && p.length >= 5 && (p.indexOf(t) !== -1 || t.indexOf(p) !== -1)) best = Math.max(best, 0.6);
      });
      hit += best * w;
    });
    var s = hit / weight;
    /* one generic word is not a match */
    if (toks.length > 1 && hit < 1.5) s = s * 0.5;
    return Math.round(s * 100) / 100;
  }

  /* pool: [{name, ...}] -> top N {item, score} at or above min */
  function rank(pool, photoWords, limit, min) {
    var out = [];
    (pool || []).forEach(function (item) {
      var s = scoreName(item.name, photoWords);
      if (s >= (min == null ? 0.5 : min)) out.push({ item: item, score: s });
    });
    out.sort(function (a, b) { return b.score - a.score || String(a.item.name).length - String(b.item.name).length; });
    var seen = {};
    return out.filter(function (r) {
      var k = upper(r.item.name) + "|" + (r.item.code || "");
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    }).slice(0, limit || 5);
  }

  /* Pokémon TCG API (keyless, CORS *): only the card number and name words are sent. */
  function pokemonQuery(ext) {
    var set = ext.sets && ext.sets[0];
    if (!set) return "";
    var q = "number:" + set.number + " set.printedTotal:" + set.total;
    return POKEMON_API + "?q=" + encodeURIComponent(q) + "&pageSize=10&select=id,name,number,rarity,set,images,tcgplayer";
  }

  function parsePokemon(json, ext) {
    var cards = (json && json.data) || [];
    var w = (ext && ext.words) || [];
    return cards.map(function (c) {
      var nameScore = scoreName(c.name, w);
      var price = null;
      var tp = c.tcgplayer && c.tcgplayer.prices;
      if (tp) Object.keys(tp).forEach(function (k) { if (price == null && tp[k] && tp[k].market != null) price = tp[k].market; });
      return {
        name: c.name + " " + c.number + "/" + (c.set && c.set.printedTotal) + " · " + (c.set ? c.set.name : ""),
        cardName: c.name,
        code: (c.set && c.set.ptcgoCode ? c.set.ptcgoCode + " " : "") + c.number + "/" + (c.set && c.set.printedTotal),
        lane: "pokemon",
        brand: "Pokémon TCG",
        thumb: c.images ? c.images.small || c.images.large || "" : "",
        image: c.images ? c.images.large || c.images.small || "" : "",
        line: c.set ? c.set.name + (c.rarity ? " · " + c.rarity : "") : "",
        year: c.set && c.set.releaseDate ? String(c.set.releaseDate).slice(0, 4) : "",
        source: "Pokémon TCG API",
        sourceUrl: c.id ? "https://api.pokemontcg.io/v2/cards/" + encodeURIComponent(c.id) : "https://pokemontcg.io/",
        marketPrice: price,
        score: Math.min(1, 0.7 + nameScore * 0.3),
      };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  /* TCGdex (keyless, CORS *): fallback when the Pokémon TCG API is busy. List by card number + a name word, then details. */
  var TCGDEX = "https://api.tcgdex.net/v2/en/cards";
  function tcgdexQuery(ext) {
    var set = ext.sets && ext.sets[0];
    var name = (ext.words || []).filter(function (w) { return !/^(HP|EX|GX|VMAX|VSTAR|BASIC|STAGE|POKEMON|POKÉMON|TRAINER)$/.test(w); })[0];
    if (!set && !name) return "";
    return TCGDEX + "?" + (set ? "localId=" + encodeURIComponent(set.number) : "") + (name ? (set ? "&" : "") + "name=" + encodeURIComponent(name.toLowerCase()) : "");
  }
  /* list: [{id, name, localId, image}], details: {id: card detail} */
  function parseTcgdex(list, details, ext) {
    var set = ext.sets && ext.sets[0];
    var w = (ext && ext.words) || [];
    return (list || []).map(function (c) {
      var d = (details && details[c.id]) || {};
      var total = d.set && d.set.cardCount ? d.set.cardCount.official : null;
      if (set && total != null && String(total) !== String(set.total)) return null;
      var img = c.image || d.image || "";
      var nameScore = scoreName(c.name, w);
      return {
        name: c.name + " " + c.localId + (total ? "/" + total : "") + (d.set ? " · " + d.set.name : ""),
        cardName: c.name,
        code: c.localId + (total ? "/" + total : ""),
        lane: "pokemon",
        brand: "Pokémon TCG",
        thumb: img ? img + "/low.webp" : "",
        image: img ? img + "/high.webp" : "",
        line: d.set ? d.set.name + (d.rarity ? " · " + d.rarity : "") : "",
        year: d.set && d.set.releaseDate ? String(d.set.releaseDate).slice(0, 4) : "",
        source: "TCGdex",
        sourceUrl: TCGDEX + "/" + encodeURIComponent(c.id),
        marketPrice: null,
        score: Math.min(1, (set && total != null ? 0.7 : 0.5) + nameScore * 0.3),
      };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; });
  }

  function searchLinks(ext, tag) {
    var q = (ext.words || []).slice(0, 6).join(" ").toLowerCase();
    if (!q) q = (ext.mattel[0] || ext.upcs[0] || "").toLowerCase();
    var e = encodeURIComponent(q);
    return [
      { id: "google", label: "Google Shopping", url: "https://www.google.com/search?tbm=shop&q=" + e },
      { id: "ebay", label: "eBay sold", url: "https://www.ebay.com/sch/i.html?LH_Sold=1&LH_Complete=1&_nkw=" + e },
      { id: "amazon", label: "Amazon", url: "https://www.amazon.com/s?k=" + e + "&tag=" + (tag || "hempsply02-20") },
      { id: "lens", label: "Google Lens", url: "https://lens.google.com/" },
    ];
  }

  function visionUrl(storage) {
    try {
      var v = String((storage && storage.getItem(VISION_KEY)) || "").trim();
      return /^https:\/\/[^\s]+$/i.test(v) ? v : "";
    } catch (err) { return ""; }
  }

  /* POST {image: dataURL, hint: text} -> {guesses:[{name, brand, lane, code, confidence}]} */
  function askVision(url, dataUrl, hint, fetchFn) {
    var f = fetchFn || (typeof fetch === "function" ? fetch : null);
    if (!url || !f) return Promise.resolve([]);
    return f(url, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit", referrerPolicy: "no-referrer", body: JSON.stringify({ image: dataUrl, hint: String(hint || "").slice(0, 400) }) })
      .then(function (res) { return res.ok ? res.json() : { guesses: [] }; })
      .then(function (json) {
        return ((json && json.guesses) || []).slice(0, 5).filter(function (g) { return g && g.name; }).map(function (g) {
          return { name: String(g.name).slice(0, 140), brand: String(g.brand || "").slice(0, 60), lane: String(g.lane || "other"), code: String(g.code || "").slice(0, 40), score: Math.max(0, Math.min(1, Number(g.confidence) || 0.5)), source: "AI vision (your proxy)" };
        });
      }).catch(function () { return []; });
  }

  var tess = null;
  var tessProgress = null;
  /* loadScript(src) -> Promise. image: canvas / blob / data URL. onProgress(0..1). */
  function ocr(image, loadScript, onProgress, retried) {
    tessProgress = onProgress || null;
    if (!tess) {
      tess = loadScript(TESSERACT.script).then(function () {
        var T = (typeof self !== "undefined" ? self : this).Tesseract;
        if (!T) throw new Error("ocr");
        return T.createWorker("eng", 1, {
          workerPath: TESSERACT.workerPath,
          corePath: TESSERACT.corePath,
          langPath: TESSERACT.langPath,
          logger: function (m) { if (tessProgress && m && typeof m.progress === "number") tessProgress(m.status || "", m.progress); },
        });
      }).catch(function (err) { tess = null; throw err; });
    }
    return tess.then(function (worker) {
      return worker.recognize(image).then(function (out) {
        return { text: (out && out.data && out.data.text) || "", confidence: out && out.data ? out.data.confidence : 0 };
      });
    }).catch(function (err) {
      /* a dropped download or a crashed worker: start a fresh worker once */
      var old = tess;
      tess = null;
      if (old) old.then(function (w) { if (w && w.terminate) w.terminate(); }).catch(function () {});
      if (retried) throw err;
      if (typeof console !== "undefined") console.warn("photo reader retry", err && err.message ? err.message : err);
      return ocr(image, loadScript, onProgress, true);
    });
  }

  return {
    TESSERACT: TESSERACT,
    VISION_KEY: VISION_KEY,
    fixMattel: fixMattel,
    upcsIn: upcsIn,
    setNumbers: setNumbers,
    words: words,
    extract: extract,
    scoreName: scoreName,
    rank: rank,
    pokemonQuery: pokemonQuery,
    parsePokemon: parsePokemon,
    TCGDEX: TCGDEX,
    tcgdexQuery: tcgdexQuery,
    parseTcgdex: parseTcgdex,
    searchLinks: searchLinks,
    visionUrl: visionUrl,
    askVision: askVision,
    ocr: ocr,
  };
});
