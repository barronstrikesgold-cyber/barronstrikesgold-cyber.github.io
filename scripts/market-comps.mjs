/**
 * Attach sold comps that a public page actually lists.
 * A number without a URL and a date is not stored.
 * Listing asks stay notes. They are not solds.
 */
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const STOP = new Set(["the", "and", "for", "with", "from", "card", "cards", "set", "edition", "collection", "pokemon", "pokémon"]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

async function getText(url, headers) {
  const res = await fetch(url, {
    headers: Object.assign({
      "User-Agent": UA,
      Accept: "text/html,application/json",
      "Accept-Language": "en-US,en;q=0.9",
    }, headers || {}),
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(res.status + " " + url);
  return res.text();
}

function fold(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tokens(text) {
  return fold(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((word) => word.length > 2 && !STOP.has(word));
}

function scoreName(query, name) {
  const wanted = tokens(query);
  const have = new Set(tokens(name));
  if (!wanted.length || !have.size) return 0;
  const hits = wanted.filter((word) => have.has(word)).length;
  return hits / wanted.length;
}

function plain(html) {
  return String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export function saleIso(monthName, day, today) {
  const month = MONTHS[String(monthName || "").slice(0, 3).toLowerCase()];
  const date = Number(day);
  if (!month || !date) return "";
  const year = Number(String(today).slice(0, 4));
  const todayMonth = Number(String(today).slice(5, 7));
  const usedYear = month > todayMonth + 1 ? year - 1 : year;
  return usedYear + "-" + String(month).padStart(2, "0") + "-" + String(date).padStart(2, "0");
}

export function parseSwappaSales(html, today) {
  const text = plain(html);
  const chunk = (text.split(/Sampling of recent/i)[1] || "").split(/\bClose\b/)[0];
  const rows = [];
  const re = /([A-Z][a-z]{2})\s+(\d{1,2})\s+(New|Mint|Good|Fair)([^$]{0,40}?)\$([0-9,]+)/g;
  let match;
  while ((match = re.exec(chunk))) {
    const iso = saleIso(match[1], match[2], today);
    const price = Number(match[5].replace(/,/g, ""));
    if (!iso || !Number.isFinite(price)) continue;
    rows.push({ date: iso, condition: match[3], detail: match[4].replace(/\s+/g, " ").trim(), price });
  }
  return rows;
}

export function averageSales(rows) {
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => sum + row.price, 0);
  const dates = rows.map((row) => row.date).sort();
  return { sold: roundMoney(total / rows.length), count: rows.length, date: dates[dates.length - 1] };
}

export function parseHwAverage(html) {
  const sales = html.match(/Recent sales<\/p>\s*<p[^>]*>\s*([0-9]+)\s*<\/p>/i);
  const avg = html.match(/Average<\/p>\s*<p[^>]*>[\s\S]{0,240}?<span>([0-9]+(?:\.[0-9]+)?)<\/span>/i);
  if (!avg) return null;
  const count = sales ? Number(sales[1]) : 0;
  const sold = Number(avg[1]);
  if (!Number.isFinite(sold) || count <= 0) return null;
  return { sold, count };
}

export function parseBricklinkNew(html) {
  const text = plain(html);
  const block = (text.split("Last 6 Months Sales")[1] || "").slice(0, 700);
  const match = block.match(/Times Sold:\s*(\d+)\s+Total Qty:\s*(\d+)\s+Min Price:\s*US \$([0-9,.]+)\s+Avg Price:\s*US \$([0-9,.]+)/);
  if (!match) return null;
  const count = Number(match[1]);
  const sold = Number(match[4].replace(/,/g, ""));
  if (!count || !Number.isFinite(sold)) return null;
  return { sold, count };
}

export function tcgProductUrl(productId) {
  return "https://www.tcgplayer.com/product/" + productId;
}

export function humanSoldUrl(url) {
  const match = String(url || "").match(/https?:\/\/infinite-api\.tcgplayer\.com\/price\/history\/(\d+)/i);
  if (match) return tcgProductUrl(match[1]);
  return String(url || "");
}

export function isApiSoldHost(url) {
  if (!url) return false;
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch (err) { return false; }
  return host.split(".").some((label) => label === "api" || label.endsWith("-api") || label.startsWith("api-"));
}

function applyComp(item, comp) {
  return Object.assign({}, item, {
    sold: comp.sold,
    soldDate: comp.date,
    soldSource: comp.source,
    soldUrl: humanSoldUrl(comp.url),
    liquid: Boolean(comp.liquid),
    sheetVerdict: "",
  });
}

function copyComp(item, previous) {
  if (!previous || previous.sold == null || !previous.soldUrl || !previous.soldDate) return item;
  return applyComp(item, {
    sold: previous.sold,
    date: previous.soldDate,
    source: previous.soldSource,
    url: previous.soldUrl,
    liquid: previous.liquid,
  });
}

let tcgPhotoOk;
async function tcgPhoto(productId) {
  const url = "https://tcgplayer-cdn.tcgplayer.com/product/" + productId + "_200w.jpg";
  if (tcgPhotoOk == null) {
    try {
      const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
      tcgPhotoOk = res.ok;
    } catch (err) {
      tcgPhotoOk = false;
    }
  }
  return tcgPhotoOk ? url : "";
}

async function tcgSearch(query, line) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    const filters = { term: {}, match: {} };
    if (line) filters.term.productLineName = [line];
    const res = await fetch("https://mp-search-api.tcgplayer.com/v1/search/request?q=" + encodeURIComponent(query) + "&isList=false", {
      method: "POST",
      headers: { "User-Agent": UA, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        algorithm: "sales_synonym_v2",
        from: 0,
        size: 8,
        filters,
        listingSearch: { filters: { term: { sellerStatus: "Live" }, range: { quantity: { gte: 1 } }, exclude: { channelExclusion: 0 } }, context: { cart: {} }, sort: {} },
        context: { cart: {}, shippingCountry: "US" },
        settings: { useFuzzySearch: true, didYouMean: {} },
        sort: {},
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 429 || res.status >= 500) {
      last = new Error(res.status + " tcg search");
      await sleep(400 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(res.status + " tcg search");
    const data = await res.json();
    return (data.results && data.results[0] && data.results[0].results) || [];
  }
  throw last;
}

async function tcgWindow(productId) {
  const data = JSON.parse(await getText("https://infinite-api.tcgplayer.com/price/history/" + productId + "?range=month", { Accept: "application/json" }));
  let qty = 0;
  let money = 0;
  let latest = "";
  (data.result || []).forEach((day) => {
    (day.variants || []).forEach((variant) => {
      if (variant.variant && variant.variant !== "Normal") return;
      const count = Number(variant.quantity || 0);
      const price = Number(variant.averageSalesPrice);
      if (count > 0 && price > 0) {
        qty += count;
        money += price * count;
        if (!latest || day.date > latest) latest = day.date;
      }
    });
  });
  if (!qty || !latest) return null;
  return { sold: roundMoney(money / qty), count: qty, date: latest };
}

function tcgQuery(item) {
  const name = item.name || "";
  if (item.section === "magic") {
    if (/commander/i.test(name)) return name + " commander deck";
    return name + " play booster display";
  }
  if (item.section === "yugioh") return name + " booster box";
  if (item.section === "lorcana") return /booster|box|trove|starter/i.test(name) ? name : name + " booster box";
  if (item.section === "pokemon" && /etb/i.test(name)) return name.replace(/\bETB\b/i, "elite trainer box");
  return name;
}

function tcgLine(section) {
  return {
    pokemon: "pokemon",
    magic: "magic",
    onepiece: "one piece card game",
    lorcana: "lorcana",
    yugioh: "yugioh",
    sports: "",
  }[section] || "";
}

const SEALED_WORDS = ["booster", "display", "collection", "deck", "bundle", "elite", "trainer", "blaster", "hobby", "pack", "etb", "tin", "case"];
const GENERIC = new Set(["play", "booster", "display", "box", "deck", "commander", "pack", "collection", "sealed", "elite", "trainer", "card", "cards", "set", "edition", "tcg", "blaster", "hobby", "retail", "case", "gift", "premium", "1st", "2nd", "3rd", "unlimited", "first"]);

function distinctive(text) {
  return tokens(text).filter((word) => !GENERIC.has(word));
}

export function acceptProduct(query, name) {
  const bad = /code card|digital bundle|divider|sleeves only/i;
  if (bad.test(name) && !bad.test(query)) return false;
  if (/\bcase\b/i.test(name) && !/\bcase\b/i.test(query)) return false;
  const q = String(query || "").toLowerCase();
  const n = String(name || "").toLowerCase();
  const wantedSealed = SEALED_WORDS.filter((word) => q.includes(word));
  if (wantedSealed.length && !wantedSealed.some((word) => n.includes(word))) return false;
  const needed = distinctive(query);
  if (needed.length < 2) return false;
  const have = new Set(tokens(name));
  if (!needed.every((word) => have.has(word))) return false;
  const cleaned = String(name).replace(/\[[^\]]*\]/g, " ");
  const parts = cleaned.split(/\s*[-–—:]\s+/);
  const body = parts.length > 1 ? parts.slice(1).join(" ") : cleaned;
  const extra = distinctive(body).filter((word) => !needed.includes(word));
  if (extra.length) return false;
  if (/\belite trainer\b/i.test(name) && !/\belite trainer\b|\betb\b/i.test(query)) return false;
  const narrower = ["pack", "case", "bundle", "tin", "blaster", "box", "display", "deck"].filter((word) => {
    const hit = new RegExp("\\b" + word + "\\b", "i");
    return hit.test(name) && !hit.test(query);
  });
  if (narrower.length) return false;
  return true;
}

async function tcgComp(item, cache) {
  const line = tcgLine(item.section);
  if (line === undefined) return null;
  const query = tcgQuery(item);
  const key = line + "|" + query.toLowerCase();
  if (!cache.search.has(key)) {
    cache.search.set(key, await tcgSearch(query, line));
    await sleep(70);
  }
  const rows = cache.search.get(key).filter((row) => row && row.productName && acceptProduct(query, row.productName));
  let best = null;
  let bestScore = 0;
  rows.forEach((row) => {
    const scored = scoreName(query, row.productName);
    if (scored > bestScore) {
      best = row;
      bestScore = scored;
    }
  });
  if (!best) return null;
  if (!cache.history.has(best.productId)) {
    cache.history.set(best.productId, await tcgWindow(best.productId));
    await sleep(70);
  }
  const window = cache.history.get(best.productId);
  if (!window) return null;
  const url = tcgProductUrl(best.productId);
  return {
    sold: window.sold,
    date: window.date,
    liquid: window.count >= 5,
    url,
    source: "TCGplayer sales for " + best.productName + ". Volume-weighted average $" + window.sold.toFixed(2) + " across " + window.count + " sales, last sale " + window.date + ". Not a listing ask.",
  };
}

async function bricklinkComp(item) {
  const setNo = (String(item.name || "").match(/^(\d{4,6})\b/) || [])[1];
  if (!setNo) return null;
  const page = await getText("https://www.bricklink.com/v2/catalog/catalogitem.page?S=" + setNo + "-1");
  const itemId = (page.match(/itemid="(\d+)/i) || [])[1];
  if (!itemId) return null;
  await sleep(80);
  const guideUrl = "https://www.bricklink.com/v2/catalog/catalogitem_pgtab.page?idItem=" + itemId + "&idColor=0&st=2&gm=1&gc=0&ei=0&prec=2";
  const guide = await getText(guideUrl, { Referer: "https://www.bricklink.com/v2/catalog/catalogitem.page?S=" + setNo + "-1" });
  const parsed = parseBricklinkNew(guide);
  if (!parsed) return null;
  return {
    sold: parsed.sold,
    date: todayIso(),
    liquid: parsed.count >= 5,
    url: guideUrl,
    source: "BrickLink new sales, last 6 months, " + parsed.count + " times sold, average $" + parsed.sold.toFixed(2) + ", observed " + todayIso() + ". Current asks were not used.",
  };
}

const HW_NOISE = new Set(["hot", "wheels", "rlc", "exclusive", "elite", "matchbox", "super", "chase", "with", "version", "premium", "cars", "red", "line", "club"]);

export function hwScore(query, href) {
  const wanted = tokens(query).filter((word) => !HW_NOISE.has(word));
  const have = new Set(tokens(href.replace(/-/g, " ")).filter((word) => !HW_NOISE.has(word)));
  if (wanted.length < 2 || !have.size) return 0;
  return wanted.filter((word) => have.has(word)).length / wanted.length;
}

function slugYear(href) {
  const year = String(href).match(/\/(20\d{2})-/);
  return year ? Number(year[1]) : 0;
}

function hwQuery(name) {
  return String(name || "")
    .replace(/hot wheels/ig, " ")
    .replace(/\brlc\b/ig, " ")
    .replace(/exclusive/ig, " ")
    .replace(/elite\s*64/ig, " ")
    .replace(/super chase/ig, " ")
    .replace(/matchbox/ig, " ")
    .replace(/selections/ig, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function hwComp(item, require) {
  const query = hwQuery(item.name);
  const html = await getText("https://hwpriceguide.com/search?q=" + encodeURIComponent(query));
  const links = [...new Set([...html.matchAll(/href="(\/item\/[^"]+)"/g)].map((match) => match[1]))];
  const ranked = links.map((href) => ({ href, score: hwScore(query, href) }))
    .filter((row) => row.score >= 0.8)
    .filter((row) => !require || require.test(row.href))
    .sort((a, b) => b.score - a.score || slugYear(b.href) - slugYear(a.href));
  if (!ranked.length) return null;
  await sleep(80);
  const pageUrl = "https://hwpriceguide.com" + ranked[0].href;
  const page = await getText(pageUrl);
  const parsed = parseHwAverage(page);
  if (!parsed) return null;
  return {
    sold: parsed.sold,
    date: todayIso(),
    liquid: parsed.count >= 5,
    url: pageUrl,
    source: "HWPriceGuide last 30 days average $" + parsed.sold.toFixed(2) + " from " + parsed.count + " recent sales, observed " + todayIso() + ".",
  };
}

async function swappaComp(slug, filter) {
  const url = "https://swappa.com/xui/product/" + slug + "/sales";
  const html = await getText(url, { "HX-Request": "true", Referer: "https://swappa.com/prices/" + slug });
  if (/Not Found \(404\)/i.test(html)) return null;
  const rows = parseSwappaSales(html, todayIso());
  const picked = filter ? rows.filter(filter) : rows;
  const used = picked.length >= 3 ? picked : null;
  if (!used) return null;
  const avg = averageSales(used);
  const conditions = [...new Set(used.map((row) => row.condition))].join(", ");
  return {
    sold: avg.sold,
    date: avg.date,
    liquid: used.length >= 5,
    url,
    source: "Swappa recent sales, " + used.length + " rows (" + conditions + "), average $" + avg.sold.toFixed(2) + ", newest " + avg.date + ". Listing asks were not used.",
  };
}

function appleFilter(name) {
  const lower = name.toLowerCase();
  const storage = (lower.match(/(\d+)\s*gb/) || [])[1];
  const cellular = /cellular/.test(lower);
  const wifi = /wi-fi/.test(lower) && !cellular;
  return (row) => {
    const detail = (row.detail || "").toLowerCase();
    if (storage && detail.indexOf(storage) === -1) return false;
    if (wifi && detail.indexOf("wi-fi") === -1) return false;
    if (cellular && detail.indexOf("unlocked") === -1 && detail.indexOf("cellular") === -1) return false;
    return true;
  };
}

function appleSlug(name) {
  const lower = name.toLowerCase();
  if (/ipad mini 6/.test(lower)) return "apple-ipad-mini-6";
  if (/ipad mini/.test(lower) && /a17/.test(lower)) return "apple-ipad-mini-7";
  if (/ipad \(a16\)/.test(lower) || /ipad a16/.test(lower)) return "apple-ipad-11";
  if (/macbook neo/.test(lower)) return "apple-macbook-neo";
  if (/macbook pro/.test(lower) && /14-inch/.test(lower)) return "apple-macbook-pro-14-m5";
  if (/macbook pro/.test(lower) && /16-inch/.test(lower)) return "apple-macbook-pro-16-m5";
  return "";
}

function switchFilter(name) {
  if (!/nintendo switch/i.test(name) || !/system/i.test(name)) return null;
  return (row) => row.condition === "New";
}

async function funkoItems(Market) {
  const queries = ["exclusive chase", "funko shop exclusive", "target exclusive pop", "sdcc exclusive pop"];
  const seen = new Set();
  const candidates = [];
  for (const query of queries) {
    let rows = [];
    try {
      rows = await tcgSearch(query, "Funko");
    } catch (err) {
      continue;
    }
    for (const row of rows) {
      if (!row || !row.productId || seen.has(row.productId)) continue;
      const name = row.productName || "";
      if (!/exclusive|chase/i.test(name)) continue;
      seen.add(row.productId);
      candidates.push(row);
      if (candidates.length >= 16) break;
    }
    if (candidates.length >= 16) break;
  }
  const items = [];
  for (const row of candidates) {
      const name = row.productName || "";
      let comp = null;
      try {
        const window = await tcgWindow(row.productId);
        if (window) {
          comp = {
            sold: window.sold,
            date: window.date,
            liquid: window.count >= 5,
            url: tcgProductUrl(row.productId),
            source: "TCGplayer sales for " + name + ". Volume-weighted average $" + window.sold.toFixed(2) + " across " + window.count + " sales, last sale " + window.date + ".",
          };
        }
      } catch (err) {
        comp = null;
      }
      const photo = await tcgPhoto(row.productId);
      let item = Market.finalize({
        id: "funko-" + row.productId,
        section: "funko",
        name,
        photo,
        photoAlt: name,
        photoCredit: "TCGplayer",
        photoPage: "https://www.tcgplayer.com/product/" + row.productId,
        spot: "Funko exclusive or chase named on TCGplayer. Funko.com exclusives did not return a product list.",
        retail: null,
        retailLabel: "MSRP not on the source",
        retailSource: "TCGplayer",
        retailUrl: "https://www.tcgplayer.com/product/" + row.productId,
        feed: false,
        street: null,
        streetNote: comp ? "" : "No sale in the last month, so the market price was not stored as a sold.",
        sold: null,
        soldDate: "",
        soldSource: comp ? "" : "TCGplayer lists this exclusive. No sale in the last month.",
        soldUrl: "",
        sheetVerdict: "",
        liquid: false,
      });
      if (comp) item = Market.finalize(applyComp(item, comp));
      items.push(item);
      await sleep(60);
  }
  items.sort((a, b) => Number(b.sold != null) - Number(a.sold != null));
  return items.slice(0, 8);
}

function wantedExtra(row, kind) {
  const name = row.productName || "";
  if (/code card|digital bundle|divider/i.test(name)) return false;
  if (/\bcase\b/i.test(name)) return false;
  if (kind === "etb") return /elite trainer box/i.test(name) && /mega evolution/i.test(name);
  if (kind === "league") return /league battle deck/i.test(name);
  if (kind === "worlds") return /world championship deck/i.test(name) && /202[3-6]/.test(name);
  return false;
}

async function extraPokemon(Market, existing) {
  const plans = [
    ["mega evolution elite trainer box", "etb"],
    ["league battle deck", "league"],
    ["world championship deck", "worlds"],
  ];
  const items = [];
  const seen = new Set(existing.map((item) => item.name.toLowerCase()));
  for (const plan of plans) {
    let rows = [];
    try {
      rows = await tcgSearch(plan[0], "pokemon");
    } catch (err) {
      continue;
    }
    const picked = rows.filter((row) => wantedExtra(row, plan[1])).slice(0, 4);
    for (const row of picked) {
      if (seen.has(String(row.productName || "").toLowerCase())) continue;
      let comp = null;
      try { comp = await tcgWindow(row.productId); } catch (err) { comp = null; }
      const productUrl = "https://www.tcgplayer.com/product/" + row.productId + "/" + (row.productUrlName || "");
      let item = Market.finalize({
        id: "pk-tcg-" + row.productId,
        section: "pokemon",
        name: row.productName,
        photo: await tcgPhoto(row.productId),
        photoAlt: row.productName,
        photoCredit: "TCGplayer",
        photoPage: productUrl,
        spot: "Named on TCGplayer. A retailer MSRP was not on a page this refresh could read, so retail stays blank unless the sales comp can be compared.",
        retail: null,
        retailLabel: "MSRP not on a retailer page this refresh could read",
        retailSource: "TCGplayer product",
        retailUrl: productUrl,
        feed: false,
        street: null,
        streetNote: "Listing asks were not used.",
        sold: null,
        soldDate: "",
        soldSource: comp ? "" : "No TCGplayer sale in the last month.",
        soldUrl: "",
        sheetVerdict: "",
        liquid: false,
      });
      if (comp) {
        item = Market.finalize(applyComp(item, {
          sold: comp.sold,
          date: comp.date,
          liquid: comp.count >= 5,
          url: tcgProductUrl(row.productId),
          source: "TCGplayer sales for " + row.productName + ". Volume-weighted average $" + comp.sold.toFixed(2) + " across " + comp.count + " sales, last sale " + comp.date + ". Not a listing ask.",
        }));
      }
      items.push(item);
      seen.add(String(row.productName).toLowerCase());
      await sleep(70);
    }
  }
  return items;
}

export async function applyMarketComps(sections, prev, Market) {
  const previous = new Map();
  (prev.sections || []).forEach((section) => {
    (section.items || []).forEach((item) => previous.set(item.id, item));
  });
  const cache = { search: new Map(), history: new Map() };
  const tcgSections = new Set(["pokemon", "magic", "onepiece", "lorcana", "yugioh", "sports"]);
  for (const section of sections) {
    if (section.id === "funko") {
      try {
        const items = await funkoItems(Market);
        section.items = items;
        section.note = items.length
          ? "Funko.com exclusives did not return a list. These exclusives and chases are named on TCGplayer. A sold is stored only when that product has sales in the last month."
          : "Funko.com exclusives did not return a list, and TCGplayer had no exclusive with a recent sale. Nothing was invented.";
      } catch (err) {
        section.note = "Funko comp fetch failed. Showing the last copy. " + String(err.message || err).slice(0, 120);
        if (!section.items.length) section.items = (previous.size && [...previous.values()].filter((item) => item.section === "funko")) || [];
      }
      continue;
    }
    if (section.id === "pokemon") {
      try {
        const extras = await extraPokemon(Market, section.items);
        section.items = section.items.concat(extras);
        if (extras.length) section.note += " Mega Evolution ETBs, League Battle decks, and Worlds decks were added from TCGplayer when the product was named there.";
      } catch (err) {
        section.note += " Extra Pokémon products were not added (" + String(err.message || err).slice(0, 80) + ").";
      }
    }
    const next = [];
    for (const item of section.items) {
      let comp = null;
      let failed = false;
      try {
        if (tcgSections.has(section.id)) comp = await tcgComp(item, cache);
        else if (section.id === "lego") comp = await bricklinkComp(item);
        else if (section.id === "mattel" && !item.launchUnrevealed) comp = await hwComp(item, /rlc|elite|red-line/i);
        else if (section.id === "matchbox") comp = await hwComp(item, /matchbox|super-chase/i);
        else if (section.id === "apple") {
          const slug = appleSlug(item.name);
          comp = slug ? await swappaComp(slug, appleFilter(item.name)) : null;
          if (!comp && slug) item.soldSource = "No Swappa sales page matched this refurbished listing. Listing asks were not used.";
        } else if (section.id === "consoles") {
          const filter = switchFilter(item.name);
          comp = filter ? await swappaComp("nintendo-switch-2", filter) : null;
        } else if (section.id === "sneakers") {
          item.soldSource = "No verified resale average. StockX did not return a sold. KicksCrew and Flight Club prices are asks and were not used.";
          item.streetNote = "No verified StockX or GOAT average. Asks were not stored as a sold.";
        }
      } catch (err) {
        const message = String(err.message || err);
        comp = null;
        if (/^404\b/.test(message)) {
          if (section.id === "apple") item.soldSource = "No Swappa sales page matched this refurbished listing. Listing asks were not used.";
        } else {
          failed = true;
          process.stdout.write("comp fail " + section.id + " " + item.id + " " + message.slice(0, 140) + "\n");
        }
      }
      if (comp) process.stdout.write("comp " + section.id + " " + item.id + " " + comp.sold + "\n");
      let updated = item;
      if (comp) updated = applyComp(item, comp);
      else if (failed && previous.get(item.id) && previous.get(item.id).sold != null) updated = copyComp(item, previous.get(item.id));
      else {
        const keepNote = item.sold == null ? item.soldSource : "";
        updated = Object.assign({}, item, { sold: null, soldDate: "", soldUrl: "", net: null, liquid: false, soldSource: keepNote || "" });
      }
      next.push(Market.finalize(updated));
      if (section.id === "lego" || section.id === "mattel" || section.id === "matchbox" || section.id === "apple") await sleep(60);
    }
    if (section.id === "matchbox" && !next.some((row) => row.sold != null)) {
      section.note = "Matchbox Super Chase rows from the hunt sheet. HWPriceGuide did not list these cars. hotwheelstreasure.com publishes Hot Wheels carded estimates, not these solds, so no sold was stored.";
    }
    const soldCount = next.filter((row) => row.sold != null).length;
    if (soldCount) {
      section.note = String(section.note || "")
        .replace(/No sold was added\.?\s*/gi, "")
        .replace(/No secondary sold\.?\s*/gi, "")
        .replace(/No street price\.?\s*/gi, "")
        .replace(/no sold price\.?\s*/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      section.note += (section.note ? " " : "") + soldCount + " cards have a verified sold comp with a source URL and date.";
    }
    section.items = next;
  }
  return sections;
}
