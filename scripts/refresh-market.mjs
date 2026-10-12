#!/usr/bin/env node
/**
 * Rebuild data/market.json from public feeds.
 * Retail comes from the official page. A sold price is stored only when this
 * repo already has a verified comp (URL, source, date). StockX and GOAT are
 * not guessed. A failed feed keeps the last good copy of that section.
 * Amazon.com product links are stored as clean /dp/ASIN URLs. The Associates
 * tag is applied at render. TODO: resolve ASINs with the Product Advertising API.
 *
 *   node scripts/refresh-market.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { applyMarketComps } from "./market-comps.mjs";
import {
  AUTH_DISCLAIMER,
  ASK_SOURCE,
  WATCHED_WITHOUT_DATES,
  addDays,
  labelDate as fashionLabel,
  parseSneakerCalendar,
  applyOfficialSneakerNotes,
  windowRows,
  designerPrograms,
  askFields,
} from "./fashion-calendar.mjs";

const require = createRequire(import.meta.url);
const Market = require("../lib/market.js");
const Amazon = require("../lib/amazon.js");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(root, "data", "market.json");
const UA = "ResellerHunt/1.0 (read-only market refresh)";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getText(url, accept) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: accept || "application/json,text/html" },
      signal: AbortSignal.timeout(25000),
    });
    if (res.status === 429 || res.status >= 500) {
      last = new Error(res.status + " " + url);
      await sleep(400 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(res.status + " " + url);
    return res.text();
  }
  throw last;
}

async function getJson(url) {
  return JSON.parse(await getText(url, "application/json"));
}

function isoDate(value) {
  const text = String(value || "");
  const match = text.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (!match) return "";
  return match[1] + "-" + match[2] + "-" + match[3];
}

function labelDate(iso) {
  if (!iso) return "";
  const parts = iso.split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function moneyLabel(value) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return "$" + Number(value).toFixed(2);
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&#8217;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

const MONTHS = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function usDateToIso(text) {
  const match = String(text || "").match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!match || !MONTHS[match[1].toLowerCase()]) return "";
  return match[3] + "-" + MONTHS[match[1].toLowerCase()] + "-" + String(match[2]).padStart(2, "0");
}

function slashDate(text) {
  const match = String(text || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return "";
  return match[3] + "-" + match[1] + "-" + match[2];
}

function absoluteUrl(origin, href) {
  if (!href) return "";
  if (/^https?:\/\//.test(href)) return href;
  if (href.indexOf("//") === 0) return "https:" + href;
  return origin.replace(/\/$/, "") + (href.charAt(0) === "/" ? href : "/" + href);
}

function blankSold(note) {
  return {
    sold: null,
    soldDate: "",
    soldSource: note || "",
    soldUrl: "",
    net: null,
    street: null,
  };
}

function baseItem(partial) {
  return Market.finalize(Object.assign({
    feed: false,
    retail: null,
    retailLabel: "",
    retailSource: "",
    retailUrl: "",
    release: "",
    releaseLabel: "",
    spot: "",
    photo: "",
    photoAlt: "",
    photoCredit: "",
    photoPage: "",
    streetNote: "",
    sheetVerdict: "",
  }, blankSold(""), partial));
}

function loadPrevious() {
  if (!fs.existsSync(outFile)) return { sections: [] };
  try {
    return JSON.parse(fs.readFileSync(outFile, "utf8"));
  } catch (err) {
    return { sections: [] };
  }
}

function keepAmazonUrls(sections, prev) {
  const urls = new Map();
  (prev.sections || []).forEach((section) => {
    (section.items || []).forEach((item) => {
      const asin = item && Amazon.asinFromUrl(item.amazonUrl);
      if (item && item.id && asin) urls.set(item.id, Amazon.cleanProductUrl(asin));
    });
  });
  sections.forEach((section) => {
    (section.items || []).forEach((item) => {
      const url = item && urls.get(item.id);
      if (url && !Amazon.asinFromUrl(item.amazonUrl)) item.amazonUrl = url;
    });
  });
}

function previousItems(prev, id) {
  const section = (prev.sections || []).find((row) => row.id === id);
  return section && section.items ? section.items : [];
}

async function safeSection(id, title, group, prev, load) {
  try {
    const result = await load();
    const items = result.items || [];
    const kept = items.length ? items : previousItems(prev, id);
    return {
      section: { id, title, group, note: result.note || "", items: items.length ? items : kept },
      source: { id, ok: true, count: (items.length ? items : kept).length, note: result.note || (items.length ? "" : "Feed was empty. Kept the last copy when one existed.") },
    };
  } catch (err) {
    const kept = previousItems(prev, id);
    return {
      section: { id, title, group, note: "The public feed failed. Showing the last copy on file. Nothing new was invented.", items: kept },
      source: { id, ok: false, count: kept.length, note: String(err.message || err).slice(0, 180) },
    };
  }
}

function pokemonFromBook() {
  const book = JSON.parse(fs.readFileSync(path.join(root, "data", "catalog.json"), "utf8"));
  const drops = JSON.parse(fs.readFileSync(path.join(root, "data", "drops.json"), "utf8"));
  const sealedIds = new Set(["etb", "bundle", "m6a", "knockout", "tech-sticker"]);
  const seen = new Set();
  const rows = [];
  Object.keys(book).forEach((key) => {
    (book[key] || []).forEach((item) => {
      if (!item || !item.id || seen.has(item.id)) return;
      if (sealedIds.has(item.id)) {
        seen.add(item.id);
        rows.push(item);
      }
    });
  });
  return rows.map((item) => {
    const drop = drops.find((row) => row.id === item.id || (item.id && String(row.id || "").indexOf(item.id) === 0) || row.name === item.name) || null;
    const retail = item.shelfNum != null ? Number(item.shelfNum) : null;
    return baseItem({
      id: "pk-" + item.id,
      section: "pokemon",
      name: item.name,
      photo: item.photoMatched && item.photo ? item.photo : "",
      photoAlt: item.photoAlt || item.name,
      photoCredit: item.photoMatched ? "Hunt book photo" : "",
      photoPage: "",
      spot: item.digest || "Sealed product. Read the box name before you pay.",
      retail: Number.isFinite(retail) ? retail : null,
      retailLabel: item.shelf || (Number.isFinite(retail) ? moneyLabel(retail) : "MSRP not on the source"),
      retailSource: "Printed price already on the hunt card. Not a sold comp.",
      retailUrl: item.buyUrl || "",
      release: drop ? isoDate(drop.iso) : "",
      releaseLabel: drop ? drop.dateLabel : "",
      feed: false,
      streetNote: "No verified street price. A shop ask is not a sold.",
      soldSource: "No settled sale fetched.",
    });
  });
}

async function pokemonSets() {
  const data = await getJson("https://api.pokemontcg.io/v2/sets?pageSize=250");
  const today = new Date().toISOString().slice(0, 10);
  return (data.data || []).map((set) => {
    const release = isoDate(String(set.releaseDate || "").replace(/\//g, "-"));
    return { set, release };
  }).filter((row) => row.release >= "2026-09-01").sort((a, b) => a.release.localeCompare(b.release)).slice(0, 12).map((row) => baseItem({
    id: "pkset-" + row.set.id,
    section: "pokemon",
    name: "Pokémon TCG · " + row.set.name,
    photo: row.set.id === "me55" ? "images/pokemon-etb.webp" : ((row.set.images && (row.set.images.logo || row.set.images.symbol)) || ""),
    photoAlt: row.set.id === "me55" ? "Representative Pokémon 30th Celebration Elite Trainer Box" : row.set.name,
    photoCredit: row.set.id === "me55" ? "Bundled product photo photos/etb.jpg, converted to WebP" : "Pokémon TCG API",
    photoPage: row.set.id === "me55" ? "https://www.pokemon.com/us/pokemon-tcg/30th-celebration" : "https://pokemontcg.io/",
    spot: "Set logo from the public set feed. This is not a sealed SKU, an ETB price, or a street price.",
    retail: null,
    retailLabel: "MSRP not on the set feed",
    retailSource: row.set.id === "me55" ? "Pokémon.com" : "Pokémon TCG API",
    retailUrl: row.set.id === "me55"
      ? "https://www.pokemon.com/us/pokemon-tcg/30th-celebration"
      : "https://api.pokemontcg.io/v2/sets/" + row.set.id,
    release: row.release,
    releaseLabel: labelDate(row.release),
    feed: row.release >= today,
    streetNote: "No verified street price.",
    soldSource: "No settled sale on the set feed.",
  }));
}

async function loadPokemon(prev) {
  const sealed = pokemonFromBook();
  let sets = [];
  let note = "Sealed rows are the hunt book's printed prices. No sold was added.";
  try {
    sets = await pokemonSets();
    if (sets.length) note += " Upcoming set names are from the Pokémon TCG API and have no MSRP.";
  } catch (err) {
    const oldSets = previousItems(prev, "pokemon").filter((item) => String(item.id).indexOf("pkset-") === 0);
    sets = oldSets;
    note += " The set feed failed (" + String(err.message || err).slice(0, 80) + ").";
  }
  note += " Mega Evolution, Worlds, and League Battle decks are included only when a public page names them. None of those prices were invented.";
  return { items: sealed.concat(sets), note };
}

function scryfallPage(set) {
  if (set && set.code === "nau") return "https://scryfall.com/search?q=" + encodeURIComponent("set:tnau or set:nau");
  return (set && set.scryfall_uri) || "";
}

async function loadMagic() {
  const data = await getJson("https://api.scryfall.com/sets");
  const today = new Date().toISOString().slice(0, 10);
  const want = new Set(["expansion", "commander", "draft_innovation", "masters"]);
  const items = (data.data || []).filter((set) => {
    if (!want.has(set.set_type)) return false;
    if (set.digital && set.set_type !== "expansion") return false;
    const release = set.released_at || "";
    return release >= "2026-10-01";
  }).sort((a, b) => String(a.released_at).localeCompare(String(b.released_at))).slice(0, 12).map((set) => baseItem({
    id: "magic-" + set.code,
    section: "magic",
    name: set.name,
    photo: set.icon_svg_uri || "",
    photoAlt: set.name + " set icon",
    photoCredit: "Scryfall",
    photoPage: scryfallPage(set),
    spot: "Scryfall set record (" + set.set_type + "). Not a sealed display price.",
    retail: null,
    retailLabel: "MSRP not on the Scryfall set feed",
    retailSource: "Scryfall",
    retailUrl: scryfallPage(set),
    release: set.released_at,
    releaseLabel: labelDate(set.released_at),
    feed: String(set.released_at) >= today,
    streetNote: "No verified street price.",
    soldSource: "No settled sale on the set feed.",
  }));
  return { items, note: "Release dates from Scryfall. No sealed MSRP and no sold price." };
}

function fashionItem(section, row) {
  const ask = askFields();
  return baseItem(Object.assign({}, ask, row, {
    section,
    releaseLabel: fashionLabel(row.release),
    streetNote: ask.streetNote,
    soldSource: ASK_SOURCE,
    photo: "",
    photoCredit: "",
    photoPage: "",
  }));
}

async function sneakerPages(today) {
  const months = ["october", "november", "december"];
  const year = today.slice(0, 4);
  const pages = [];
  const failed = [];
  for (const month of months) {
    const url = "https://justdrops.com/calendar/" + month + "-" + year;
    try {
      pages.push({ html: await getText(url, "text/html"), year });
    } catch (err) {
      failed.push(month + " " + String(err.message || err).slice(0, 60));
    }
    await sleep(80);
  }
  return { pages, failed };
}

async function loadSneakers() {
  const today = new Date().toISOString().slice(0, 10);
  const end = addDays(today, 70);
  const loaded = await sneakerPages(today);
  if (!loaded.pages.length) throw new Error("Sneaker calendar did not load. " + loaded.failed.join("; "));
  const rows = windowRows(applyOfficialSneakerNotes(parseSneakerCalendar(loaded.pages)), today, end);
  const items = rows.map((row) => fashionItem("sneakers", row));
  if (!items.length) throw new Error("Sneaker calendar had no dated adult rows in the next 70 days.");
  let note = "Dates and retail are the public Just Drops calendar for Nike, Jordan, adidas, New Balance, ASICS, and Puma, plus a Nike.com price where one was checked. Kids' sizes and cleats are left off. Travis Scott and Off-White had no dated adult row in this window. Photos stay off because those image hosts are not licensed. " + AUTH_DISCLAIMER;
  if (loaded.failed.length) note += " Some months failed: " + loaded.failed.join("; ") + ".";
  return { items, note };
}

async function loadDesigner() {
  const today = new Date().toISOString().slice(0, 10);
  const end = addDays(today, 70);
  const items = designerPrograms(today, end).map((row) => fashionItem("designer", row));
  const note = "Supreme Thursdays, the Kith Monday program, and Palace Friday drops for the next 70 days. " +
    WATCHED_WITHOUT_DATES.join(", ") +
    " had no dated public drop in that window, so no SKU was invented. " + AUTH_DISCLAIMER;
  return { items, note };
}

async function loadLego() {
  const html = await getText("https://www.lego.com/en-us/categories/retiring-soon", "text/html");
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("LEGO page had no product JSON");
  const state = JSON.parse(match[1]).props.pageProps.__APOLLO_STATE__ || {};
  const items = Object.keys(state).filter((key) => key.indexOf("SingleVariantProduct:") === 0).map((key) => {
    const product = state[key];
    const variant = state[(product.variant && product.variant.__ref) || ""] || {};
    const price = variant.price || {};
    const retail = price.centAmount != null ? price.centAmount / 100 : (typeof price === "number" ? price : null);
    const flags = ((variant.attributes || {}).featuredFlags || []).map((flag) => flag.label).filter(Boolean);
    const pieces = (variant.attributes || {}).pieceCount;
    return baseItem({
      id: "lego-" + product.productCode,
      section: "lego",
      name: product.productCode + " " + product.name,
      photo: product['primaryImage({"size":"THUMBNAIL"})'] || product.primaryImage || "",
      photoAlt: product.name,
      photoCredit: "LEGO.com",
      photoPage: "https://www.lego.com" + (product.pdpPath || ""),
      spot: [product.brandCategory && product.brandCategory.name, pieces ? pieces + " pieces" : "", flags.join(", ")].filter(Boolean).join(" · ") + ". Retiring-soon list on LEGO.com. Confirm the set number.",
      retail: Number.isFinite(Number(retail)) ? Number(retail) : null,
      retailLabel: Number.isFinite(Number(retail)) ? moneyLabel(retail) : "MSRP not on the retiring list",
      retailSource: "LEGO.com retiring soon",
      retailUrl: "https://www.lego.com" + (product.pdpPath || "/en-us/categories/retiring-soon"),
      release: "",
      feed: false,
      streetNote: "No verified secondary sold. LEGO's price is the shelf price, not a sold comp.",
      soldSource: "No settled sale fetched.",
    });
  });
  return { items, note: "LEGO.com retiring-soon assortment. Prices are LEGO's own. No secondary sold." };
}

async function loadMattel() {
  const handles = ["hot-wheels-red-line-club", "hot-wheels-elite-64"];
  const products = [];
  for (const handle of handles) {
    const data = await getJson("https://creations.mattel.com/collections/" + handle + "/products.json?limit=250");
    (data.products || []).forEach((product) => products.push(product));
    await sleep(120);
  }
  const seen = new Set();
  const items = products.filter((product) => {
    const blob = (product.title || "") + " " + (product.tags || []).join(" ");
    if (/membership|apparel|t-shirt|hoodie|hat\b|poster/i.test(blob)) return false;
    if (!/Category:\s*Vehicles/i.test((product.tags || []).join(" ")) && !/rlc|elite/i.test(blob)) return false;
    if (seen.has(product.handle)) return false;
    seen.add(product.handle);
    return true;
  }).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))).slice(0, 18).map((product) => {
    const variant = (product.variants || [])[0] || {};
    const retail = Number(variant.price);
    const image = (product.images || [])[0];
    let photo = image && image.src ? image.src : "";
    if (photo) {
      const url = new URL(photo);
      url.searchParams.set("width", "480");
      photo = url.toString();
    }
    const release = isoDate(product.published_at);
    const today = new Date().toISOString().slice(0, 10);
    return baseItem({
      id: "mattel-" + (variant.sku || product.handle),
      section: "mattel",
      name: product.title,
      photo,
      photoAlt: product.title,
      photoCredit: "Mattel Creations",
      photoPage: "https://creations.mattel.com/products/" + product.handle,
      spot: "Official Mattel Creations listing" + (variant.sku ? " · toy " + variant.sku : "") + ". Memberships and apparel are not listed.",
      retail: Number.isFinite(retail) ? retail : null,
      retailLabel: Number.isFinite(retail) ? moneyLabel(retail) : "Price not on the product JSON",
      retailSource: "Mattel Creations",
      retailUrl: "https://creations.mattel.com/products/" + product.handle,
      release,
      releaseLabel: release ? "Listed " + labelDate(release) : "",
      feed: Boolean(release) && release >= today,
      streetNote: "Mattel's price is the ask on their shop, not a secondary sold.",
      soldSource: "No settled sale fetched.",
    });
  });
  return { items, note: "Read-only Mattel Creations product JSON. No cart or checkout. No secondary sold." };
}

function loadMatchbox() {
  const cards = require("../lib/resale-cards.js");
  const book = JSON.parse(fs.readFileSync(path.join(root, "data", "catalog.json"), "utf8"));
  const names = new Map();
  Object.keys(book).forEach((key) => {
    (book[key] || []).forEach((item) => { if (item && item.id) names.set(item.id, item); });
  });
  const items = Object.entries(cards).filter(([, card]) => card.lane === "mbsc").map(([id, card]) => {
    const item = names.get(id) || {};
    const sold = card.lastSold == null ? null : Number(card.lastSold);
    return baseItem({
      id: "mb-" + id,
      section: "matchbox",
      name: item.name || id,
      photo: item.photoMatched ? item.photo : "",
      photoAlt: item.photoAlt || item.name || id,
      photoCredit: item.photo ? "Hunt book photo" : "",
      spot: card.tells || "The card must say SUPER CHASE.",
      retail: item.shelfNum != null ? Number(item.shelfNum) : null,
      retailLabel: card.pay || item.shelf || "About $1–$2",
      retailSource: "Hunt sheet",
      release: "",
      feed: false,
      sold: Number.isFinite(sold) ? sold : null,
      soldDate: card.soldDate || "",
      soldSource: card.soldSource || "",
      soldUrl: card.soldUrl || "",
      net: card.exactNet != null ? Number(card.exactNet) : null,
      sheetVerdict: card.resaleVerdict || "",
      streetNote: "",
    });
  });
  return { items, note: "Matchbox Super Chase rows already on the hunt sheet. Sold figures are the sheet comps, not new fetches." };
}

function loadSports() {
  const drops = JSON.parse(fs.readFileSync(path.join(root, "data", "drops.json"), "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  const items = drops.filter((row) => row.category && row.category !== "Cars" && !/pok[eé]mon/i.test(row.name || "")).map((row) => baseItem({
    id: "sport-" + row.id,
    section: "sports",
    name: row.name,
    photo: row.photoMatched ? row.photo : "",
    photoAlt: row.photoAlt || row.name,
    photoCredit: row.photoMatched ? "Hunt calendar photo" : "",
    spot: row.digest || row.format || "Retail box. A shop ask is not a sold.",
    retail: null,
    retailLabel: row.printed && row.printed !== "unknown" ? row.printed : "MSRP not on the source",
    retailSource: "Existing drops calendar",
    release: isoDate(row.iso),
    releaseLabel: row.dateLabel || labelDate(isoDate(row.iso)),
    feed: isoDate(row.iso) >= today,
    streetNote: "No verified street price.",
    soldSource: "No settled sale.",
  }));
  return { items, note: "Sports rows already on the drops calendar. Printed unknown stays blank. No street price was added." };
}

function imageField(image) {
  if (!image) return "";
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return imageField(image[0]);
  if (typeof image === "object" && typeof image.url === "string") return image.url;
  return "";
}

function pushProduct(products, entry) {
  if (!entry || typeof entry !== "object") return;
  const type = entry["@type"];
  const isProduct = type === "Product" || (Array.isArray(type) && type.indexOf("Product") !== -1);
  if (!isProduct) return;
  const offer = Array.isArray(entry.offers) ? entry.offers[0] : entry.offers;
  const price = offer && offer.price != null ? Number(offer.price) : null;
  products.push({
    name: decodeHtml(entry.name),
    url: entry.url || (offer && offer.url) || "",
    image: imageField(entry.image),
    price: Number.isFinite(price) ? price : null,
  });
}

function walkLd(entry, products) {
  if (!entry || typeof entry !== "object") return;
  if (Array.isArray(entry)) {
    entry.forEach((row) => walkLd(row, products));
    return;
  }
  pushProduct(products, entry);
  if (entry["@graph"]) walkLd(entry["@graph"], products);
  if (entry.itemListElement) walkLd(entry.itemListElement.map((row) => row.item || row), products);
}

function jsonLdProducts(html) {
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  const products = [];
  blocks.forEach((block) => {
    const raw = block.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
    let data;
    try { data = JSON.parse(raw); } catch (err) { return; }
    walkLd(data, products);
  });
  return products;
}

async function loadApple() {
  const pages = [
    "https://www.apple.com/shop/refurbished/ipad",
    "https://www.apple.com/shop/refurbished/mac",
    "https://www.apple.com/shop/refurbished/airpods",
  ];
  const picked = [];
  const seen = new Set();
  const failed = [];
  for (const page of pages) {
    try {
      const html = await getText(page, "text/html");
      const products = jsonLdProducts(html).filter((product) => product.name && Number.isFinite(product.price) && /iPad|MacBook|AirPods|Beats/i.test(product.name));
      const unique = [];
      const local = new Set();
      products.sort((a, b) => a.price - b.price).forEach((product) => {
        const key = product.name.toLowerCase().replace(/\s+[-–]\s+[^-–]+$/, "");
        if (local.has(key)) return;
        local.add(key);
        unique.push(product);
      });
      unique.slice(0, 3).forEach((product) => {
        const key = product.name.toLowerCase().replace(/\s+[-–]\s+[^-–]+$/, "");
        if (seen.has(key) || picked.length >= 8) return;
        seen.add(key);
        picked.push(product);
      });
    } catch (err) {
      failed.push(String(err.message || err).slice(0, 80));
    }
    await sleep(120);
  }
  const items = picked.map((product) => baseItem({
    id: "apple-" + product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
    section: "apple",
    name: product.name,
    photo: product.image,
    photoAlt: product.name,
    photoCredit: "Apple Refurbished",
    photoPage: product.url,
    spot: "Apple Refurbished listing. The price is Apple's current ask, not a sold comp on a secondary market.",
    retail: product.price,
    retailLabel: moneyLabel(product.price),
    retailSource: "Apple Refurbished",
    retailUrl: product.url || "https://www.apple.com/shop/refurbished",
    feed: false,
    streetNote: "No verified secondary sold.",
    soldSource: "No settled sale fetched.",
  }));
  let note = "Apple's own refurbished prices. Not a resale comp. The Beats refurbished path returned 404, so no Beats SKU was added.";
  if (failed.length) note += " Some Apple pages failed: " + failed.join("; ") + ".";
  if (!items.length) throw new Error(note);
  return { items, note };
}

function lastQuoted(slice, pattern) {
  let found = "";
  let match;
  const re = new RegExp(pattern, "g");
  while ((match = re.exec(slice))) found = match[1];
  return found;
}

function switch2Console(name) {
  if (!/switch/i.test(name) || !/2/.test(name)) return false;
  if (/controller|joy-con|joy con|case|cable|adapter|grip|dock|strap|cover|camera|charger|amiibo|screen protect|game card|stand|bracket|eyeshade|microsd|sd express|cardboard|playstand|replacement|stylus|battery|wheel|headset|keyboard|virtual boy/i.test(name)) return false;
  return /system|bundle|edition/i.test(name);
}

async function loadConsoles() {
  const html = await getText("https://www.nintendo.com/us/store/hardware/", "text/html");
  const marker = '"code":"HARDWARE"';
  const found = [];
  const seen = new Set();
  let from = 0;
  while (from < html.length) {
    const at = html.indexOf(marker, from);
    if (at < 0) break;
    const slice = html.slice(Math.max(0, at - 2800), at);
    const rawName = lastQuoted(slice, '"name":"((?:\\\\.|[^"\\\\])*)"');
    const price = lastQuoted(slice, '"regularPrice":([0-9.]+)');
    const publicId = lastQuoted(slice, '"publicId":"((?:\\\\.|[^"\\\\])*)"');
    const releaseRaw = lastQuoted(slice, '"releaseDate":"([^"]+)"');
    const urlKey = lastQuoted(slice, '"urlKey":"([^"]+)"');
    from = at + marker.length;
    if (!rawName || !price) continue;
    let name = rawName;
    let photoId = publicId;
    try { name = JSON.parse('"' + rawName + '"'); } catch (err) { name = rawName; }
    try { photoId = publicId ? JSON.parse('"' + publicId + '"') : ""; } catch (err) { photoId = publicId; }
    if (!switch2Console(name) || seen.has(name)) continue;
    seen.add(name);
    const release = isoDate(releaseRaw);
    const today = new Date().toISOString().slice(0, 10);
    const page = urlKey ? "https://www.nintendo.com/us/store/products/" + urlKey + "/" : "https://www.nintendo.com/us/store/hardware/";
    found.push(baseItem({
      id: "nsw-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 70),
      section: "consoles",
      name,
      photo: photoId ? "https://assets.nintendo.com/image/upload/f_auto/q_auto/c_scale,w_480/" + photoId.split("/").map(encodeURIComponent).join("/") : "",
      photoAlt: name,
      photoCredit: "Nintendo",
      photoPage: page,
      spot: "Nintendo store hardware record. The price is Nintendo's list price, not a sold comp.",
      retail: Number(price),
      retailLabel: moneyLabel(price),
      retailSource: "Nintendo eShop",
      retailUrl: page,
      release,
      releaseLabel: labelDate(release),
      feed: Boolean(release) && release >= today,
      streetNote: "No verified secondary sold.",
      soldSource: "No settled sale fetched.",
    }));
  }
  found.sort((a, b) => String(a.release).localeCompare(String(b.release)));
  const items = found.slice(0, 8);
  if (!items.length) throw new Error("Nintendo hardware page had no Switch 2 console price");
  return { items, note: "Nintendo store hardware JSON. Official price only." };
}

function onePieceLink(name) {
  return "https://www.tcgplayer.com/search/one-piece-card-game/product?q=" + encodeURIComponent(name) + "&view=grid";
}

function onePiecePhoto(id) {
  const shots = {
    "op-chinese-3rd-anniversary-set": ["images/op-chinese-3rd-anniversary-set.webp", "Chinese 3rd Anniversary Set"],
    "op-premium-card-collection-ace-sabo-luffy-": ["images/op-premium-card-collection-ace-sabo-luffy.webp", "Premium Card Collection Ace, Sabo, and Luffy"],
    "op-premium-card-collection-6-assort-vol-2-": ["images/op-premium-card-collection-6-assort-vol-2.webp", "Premium Card Collection 6 assort volume 2"],
    "op-playmat-card-set-luffy-bonney-": ["images/op-playmat-card-set-luffy-bonney.webp", "Playmat and card set, Luffy and Bonney"],
    "op-limited-card-sleeve-championship-26-27-kv": ["images/op-limited-card-sleeve-championship-26-27-kv.webp", "Limited card sleeve, Championship 26-27"],
    "op-limited-card-sleeve-one-piece-heroines-edition": ["images/op-limited-card-sleeve-one-piece-heroines-edition.webp", "Limited card sleeve, ONE PIECE Heroines Edition"],
    "op-booster-pack-the-dominance-of-god-op-18-": ["images/op-booster-pack-the-dominance-of-god-op-18.webp", "Booster pack The Dominance of God OP-18"],
    "op-gift-collection-one-piece-heroines-gc-2026-": ["images/op-gift-collection-one-piece-heroines-gc-2026.webp", "Gift Collection ONE PIECE Heroines GC-2026"],
    "op-premium-card-collection-live-action-edition-vol-2-baroque-wo": ["images/op-premium-card-collection-live-action-edition-vol-2-baroque-wo.webp", "Premium Card Collection Live Action Baroque Works"],
    "op-premium-card-collection-live-action-edition-vol-2-straw-hat-": ["images/op-premium-card-collection-live-action-edition-vol-2-straw-hat-.webp", "Premium Card Collection Live Action Straw Hat Crew"],
    "op-mini-case-set-luffy-shanks-hancock-ts-03-": ["images/op-mini-case-set-luffy-shanks-hancock-ts-03.webp", "Mini Case Set Luffy, Shanks, and Hancock"],
    "op-extra-booster-one-piece-heroines-edition-vol-2-eb-05-": ["images/op-extra-booster-one-piece-heroines-edition-vol-2-eb-05.webp", "Extra booster ONE PIECE Heroines Edition volume 2"],
  };
  const shot = shots[id];
  return shot ? { photo: shot[0], alt: shot[1] } : null;
}

async function loadOnePiece() {
  const html = await getText("https://en.onepiece-cardgame.com/products/", "text/html");
  const blocks = html.match(/<li class="linkListColBox"[\s\S]*?<\/li>/g) || [];
  const items = blocks.map((block) => {
    const name = decodeHtml((block.match(/linkListColTitle">([^<]+)/) || [])[1] || "");
    const price = Number((block.match(/USD \$([0-9.]+)/) || [])[1]);
    const cat = decodeHtml((block.match(/linkListColCat">([^<]+)/) || [])[1] || "");
    if (!name || !Number.isFinite(price)) return null;
    const page = onePieceLink(name);
    const id = "op-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const saved = onePiecePhoto(id);
    return baseItem({
      id,
      section: "onepiece",
      name,
      photo: saved ? saved.photo : "",
      photoAlt: saved ? saved.alt : name,
      photoCredit: saved ? "Official ONE PIECE CARD GAME product photo" : "TCGplayer",
      photoPage: page,
      spot: (cat ? cat + ". " : "") + "MSRP from the official list. The product photo is saved in the app. This opens a TCGplayer search.",
      retail: price,
      retailLabel: moneyLabel(price),
      retailSource: "TCGplayer",
      retailUrl: page,
      feed: false,
      streetNote: "No verified street price.",
      soldSource: "No settled sale fetched.",
    });
  }).filter(Boolean);
  if (!items.length) throw new Error("One Piece products page had no MSRP");
  return { items, note: "Official One Piece Card Game MSRP. No street price." };
}

async function loadLorcana() {
  const home = await getText("https://www.disneylorcana.com/en-US", "text/html");
  const links = [...new Set([...home.matchAll(/href="(\/en-US\/product\/[^"]+)"/g)].map((match) => match[1]))]
    .filter((href) => href.indexOf("/books") === -1)
    .slice(0, 14);
  const items = [];
  for (const href of links) {
    let html = "";
    try {
      html = await getText("https://www.disneylorcana.com" + href, "text/html");
    } catch (err) {
      continue;
    }
    const everywhere = html.match(/Everywhere:\s*([A-Z][a-z]+\s+\d{1,2},\s*\d{4})/);
    const prerelease = html.match(/Prerelease:\s*([A-Z][a-z]+\s+\d{1,2},\s*\d{4})/);
    const release = everywhere ? usDateToIso(everywhere[1]) : "";
    if (!release || release < "2026-10-01") continue;
    const title = decodeHtml((html.match(/<title>([^<|]+)/) || [])[1] || href.split("/").pop());
    const image = (html.match(/property="og:image" content="([^"]+)"/) || [])[1] || "";
    const today = new Date().toISOString().slice(0, 10);
    items.push(baseItem({
      id: "lor-" + href.split("/").pop(),
      section: "lorcana",
      name: title.replace(/\s+\|\s+Disney Lorcana.*$/i, "").trim() || title,
      photo: image,
      photoAlt: title,
      photoCredit: "Disney Lorcana",
      photoPage: "https://www.disneylorcana.com" + href,
      spot: "Official product page." + (prerelease ? " Prerelease " + prerelease[1] + "." : "") + " No MSRP was printed on the page.",
      retail: null,
      retailLabel: "MSRP not on the product page",
      retailSource: "Disney Lorcana",
      retailUrl: "https://www.disneylorcana.com" + href,
      release,
      releaseLabel: everywhere[1],
      feed: release >= today,
      streetNote: "No verified street price.",
      soldSource: "No settled sale fetched.",
    }));
    await sleep(80);
  }
  items.sort((a, b) => String(a.release).localeCompare(String(b.release)));
  return { items, note: items.length ? "Release dates from Disney Lorcana product pages. No MSRP and no street price." : "Lorcana pages had no upcoming dated product. Nothing was invented." };
}

async function loadYugioh() {
  const pages = [
    "https://www.yugioh-card.com/en/products/booster-pack/",
    "https://www.yugioh-card.com/en/products/structure-deck/",
    "https://www.yugioh-card.com/en/products/tins/",
    "https://www.yugioh-card.com/en/products/starter-deck/",
  ];
  const found = [];
  const seen = new Set();
  for (const page of pages) {
    let html = "";
    try {
      html = await getText(page, "text/html");
    } catch (err) {
      continue;
    }
    html.split("<li>").forEach((chunk) => {
      if (chunk.indexOf("Release Date:") === -1) return;
      const name = decodeHtml((chunk.match(/<h3>\s*<a[^>]*>([^<]+)/) || [])[1] || "");
      const release = slashDate((chunk.match(/Release Date:\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1] || "");
      const img = (chunk.match(/<img[^>]+src="([^"]+)"/) || [])[1] || "";
      const href = (chunk.match(/class="btn"[^>]+href="([^"]+)"/) || [])[1] || page;
      if (!name || !release || release < "2026-10-01" || seen.has(name)) return;
      seen.add(name);
      const today = new Date().toISOString().slice(0, 10);
      found.push(baseItem({
        id: "ygo-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
        section: "yugioh",
        name,
        photo: absoluteUrl("https://www.yugioh-card.com", img),
        photoAlt: name,
        photoCredit: "Yu-Gi-Oh! TCG",
        photoPage: absoluteUrl("https://www.yugioh-card.com", href),
        spot: "Official product index. Release date is on the page. MSRP was not.",
        retail: null,
        retailLabel: "MSRP not on the product index",
        retailSource: "Yu-Gi-Oh! TCG",
        retailUrl: absoluteUrl("https://www.yugioh-card.com", href),
        release,
        releaseLabel: labelDate(release),
        feed: release >= today,
        streetNote: "No verified street price.",
        soldSource: "No settled sale fetched.",
      }));
    });
    await sleep(80);
  }
  found.sort((a, b) => String(a.release).localeCompare(String(b.release)));
  return { items: found.slice(0, 12), note: found.length ? "Yu-Gi-Oh release dates from the official product index. No MSRP and no street price." : "Yu-Gi-Oh pages had no upcoming dated product. Nothing was invented." };
}

async function loadFunko() {
  try {
    const html = await getText("https://funko.com/new-featured/exclusives/", "text/html");
    if (/Just a moment|cf-browser-verification|Attention Required/i.test(html) || html.length < 20000) {
      return { items: [], note: "Funko exclusives did not return a product list. No exclusive or chase was invented." };
    }
    return { items: [], note: "Funko answered without a dated price list, so no exclusives were added." };
  } catch (err) {
    return { items: [], note: "Funko exclusives did not return a product list (" + String(err.message || err).slice(0, 80) + "). No exclusive or chase was invented." };
  }
}

async function main() {
  const prev = loadPrevious();
  const specs = [
    ["pokemon", "Pokémon", "TCG", (p) => loadPokemon(p)],
    ["magic", "Magic: The Gathering", "TCG", () => loadMagic()],
    ["onepiece", "One Piece", "TCG", () => loadOnePiece()],
    ["lorcana", "Disney Lorcana", "TCG", () => loadLorcana()],
    ["yugioh", "Yu-Gi-Oh", "TCG", () => loadYugioh()],
    ["sports", "Sports cards", "TCG", () => Promise.resolve(loadSports())],
    ["sneakers", "Sneakers", "Sneakers", () => loadSneakers()],
    ["designer", "Designer", "Designer", () => loadDesigner()],
    ["lego", "LEGO", "Brands", () => loadLego()],
    ["funko", "Funko", "Brands", () => loadFunko()],
    ["apple", "Apple / Beats", "Brands", () => loadApple()],
    ["consoles", "Consoles", "Brands", () => loadConsoles()],
    ["matchbox", "Matchbox", "Brands", () => Promise.resolve(loadMatchbox())],
    ["mattel", "Mattel Creations", "Brands", () => loadMattel()],
  ];
  const sections = [];
  const sources = [];
  for (const spec of specs) {
    const loaded = await safeSection(spec[0], spec[1], spec[2], prev, () => spec[3](prev));
    sections.push(loaded.section);
    sources.push(loaded.source);
    process.stdout.write(spec[0] + " " + loaded.source.ok + " " + loaded.source.count + " " + (loaded.source.note || "").slice(0, 100) + "\n");
  }
  await applyMarketComps(sections, prev, Market);
  sections.forEach((section) => {
    const source = sources.find((row) => row.id === section.id);
    if (!source) return;
    source.count = section.items.length;
    if (section.note) source.note = section.note;
  });
  const file = {
    generatedAt: new Date().toISOString(),
    formula: "net = sold × 0.87 − 5. BUY when that net beats retail × 1.09 by at least $15 and the comp is liquid. PASS when the net is under retail. CHECK otherwise.",
    sections,
    sources,
  };
  keepAmazonUrls(sections, prev);
  const stamped = Amazon.stampAssociates(file);
  fs.writeFileSync(outFile, JSON.stringify(stamped.value, null, 2) + "\n");
  process.stdout.write("amazon normalized " + stamped.tagged + " added " + stamped.added + "\n");
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);
  process.stdout.write("market items " + total + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
