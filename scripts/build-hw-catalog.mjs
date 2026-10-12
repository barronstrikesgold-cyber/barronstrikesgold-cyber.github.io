#!/usr/bin/env node
/**
 * Rebuild data/hw from public read-only sources.
 *
 *   node scripts/build-hw-catalog.mjs
 *
 * Hot Wheels Wiki year lists (Fandom) supply every mainline release the wiki
 * has published, including Treasure Hunts on those pages and the Red Line era.
 * Extra series pages (Car Culture, Boulevard, RLC, and the rest) are pulled
 * when a year search finds them.
 *
 * Official photos come from Mattel Creations public product JSON and the
 * read-only UCP search_catalog tool. This script never creates a cart or a
 * checkout. Wiki thumbnails fill the gaps. After a rebuild, run
 * scripts/host-hw-thumbs.mjs so Fandom files are stored as local WebP thumbs.
 * Fandom returns a 404 placeholder when the request sends a GitHub Pages referrer.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data", "hw");
const cacheDir = path.join(root, "scripts", ".cache");
const wikiCache = path.join(cacheDir, "wiki");
const UA = "ResellerHuntCatalog/1.0 (read-only Hot Wheels catalog; +https://github.com/barronstrikesgold-cyber/barronstrikesgold-cyber.github.io)";
const FANDOM = "https://hotwheels.fandom.com/api.php";
const MATTEL = "https://creations.mattel.com";
const COLLECTIONS = [
  "hot-wheels-collectors",
  "hot-wheels-premium",
  "hot-wheels-car-culture",
  "hot-wheels-red-line-club",
  "hot-wheels-elite-64",
];
const FIRST_YEAR = 1968;
const LAST_YEAR = 2026;

const yearArg = process.env.HW_YEARS;
const ONLY_YEARS = yearArg ? yearArg.split(",").map((n) => Number(n.trim())).filter(Boolean) : null;
const SKIP_IMAGES = process.env.HW_SKIP_IMAGES === "1";
const SKIP_MATTEL = process.env.HW_SKIP_MATTEL === "1";
const SKIP_EXTRAS = process.env.HW_SKIP_EXTRAS === "1";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url, options = {}) {
  let last = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      ...options,
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });
    if (res.status === 429 || res.status >= 500) {
      last = new Error(res.status + " " + url);
      await sleep(800 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(res.status + " " + url + " " + text.slice(0, 180));
    }
    return res.json();
  }
  throw last;
}

export function parseCell(raw) {
  let file = "";
  let s = String(raw || "");
  s = s.replace(/\[\[(?:File|Image):\s*([^|\]]+)/gi, (_, name) => {
    if (!file) file = name.trim().replace(/_/g, " ");
    return "";
  });
  s = s.replace(/<br\s*\/?>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/\{\{[^{}]*\}\}/g, " ");
  s = s.replace(/\[\[(?:[^\]|]+\|)+([^\]]+)\]\]/g, "$1");
  s = s.replace(/\[\[([^\]]+)\]\]/g, "$1");
  s = s.replace(/'{2,5}/g, "");
  s = s.replace(/&nbsp;|&#160;/gi, " ");
  s = s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
  s = s.replace(/\u200b/g, "");
  const text = s.replace(/\s+/g, " ").trim();
  return { text, file };
}

function stripStyle(chunk) {
  const idx = chunk.indexOf("|");
  if (idx === -1) return chunk;
  const left = chunk.slice(0, idx);
  if (/bgcolor|style|color|class|align|colspan|rowspan|width|font/i.test(left)) return chunk.slice(idx + 1);
  return chunk;
}

function splitCells(rest, delim) {
  return rest.split(delim + delim).map((part) => parseCell(stripStyle(part).trim()));
}

export function headerKey(text) {
  const t = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.includes("toy")) return "toy";
  if (t.includes("col")) return "col";
  if (t.includes("model") || t.includes("casting") || t === "name" || t.includes("name")) return "name";
  if (t.includes("series #") || t.includes("series#") || t.includes("series no")) return "mix";
  if (t.includes("photo") || t.includes("image") || t.includes("picture")) return "photo";
  if (t.includes("case")) return "case";
  if (t.includes("color") || t.includes("colour") || t.includes("tampo") || t.includes("variation")) return "color";
  if (t.includes("series")) return "series";
  return "";
}

export function toyOf(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const bits = cleaned.split(/[/|,]/).map((s) => s.trim()).filter(Boolean);
  for (const bit of bits) {
    const t = bit.replace(/\s+/g, "");
    if (/^[A-Z]{0,5}\d{2,6}[A-Z]{0,2}$/i.test(t)) return t.toUpperCase();
  }
  const match = cleaned.toUpperCase().match(/\b([A-Z]{1,5}\d{2,5}[A-Z]?)\b/);
  if (match) return match[1];
  const digits = cleaned.match(/\b(\d{4,6})\b/);
  return digits ? digits[1] : "";
}

export function splitVariation(nameRaw) {
  const match = String(nameRaw || "").match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!match) return { name: String(nameRaw || "").trim(), variation: "" };
  const note = match[2].trim();
  if (/color|colour|exclusive|chase|zamac|spectra|metal|variation|error|edition|chase|tampo|wheel|interior|closed|open/i.test(note) || /^\d+(st|nd|rd|th)\b/i.test(note)) {
    return { name: match[1].trim(), variation: note };
  }
  return { name: String(nameRaw || "").trim(), variation: "" };
}

export function lineOf(year, blob) {
  const text = String(blob || "");
  if (/super treasure hunt/i.test(text)) return "sth";
  if (/treasure hunt/i.test(text)) return "th";
  if (/red line club|\brlc\b/i.test(text)) return "rlc";
  if (/elite\s*64/i.test(text)) return "elite";
  if (/team transport/i.test(text)) return "team-transport";
  if (/boulevard/i.test(text)) return "boulevard";
  if (/pop culture/i.test(text)) return "pop-culture";
  if (/car culture/i.test(text)) return "car-culture";
  if (/fast\s*(&|and)\s*furious/i.test(text)) return "ff";
  if (/premium/i.test(text)) return "premium";
  if (year >= 1968 && year <= 1977) return "redline";
  return "mainline";
}

function peelSeries(series) {
  const notes = [];
  let s = String(series || "");
  const patterns = [
    /super treasure hunts?/ig,
    /treasure hunts?/ig,
    /new for \d{4}!*/ig,
    /[a-z0-9.&'’ -]{0,40}\bexclusive\b/ig,
  ];
  patterns.forEach((pattern) => {
    s = s.replace(pattern, (hit) => {
      const clean = hit.replace(/\s+/g, " ").trim();
      if (clean && !/^new for/i.test(clean)) notes.push(clean);
      return " ";
    });
  });
  s = s.replace(/\s+/g, " ").trim().replace(/^[-·|,]+|[-·|,]+$/g, "").trim();
  return { series: s, notes };
}

function parseTable(lines, heading, ctx) {
  const rows = [];
  let cur = [];
  function flush() {
    if (cur.length) rows.push(cur);
    cur = [];
  }
  lines.forEach((line) => {
    if (line.startsWith("|-") || line.startsWith("|+")) {
      flush();
      return;
    }
    if (line.startsWith("!")) {
      cur.push(...splitCells(line.slice(1), "!"));
      return;
    }
    if (line.startsWith("|")) cur.push(...splitCells(line.slice(1), "|"));
  });
  flush();
  const headerIdx = rows.findIndex((row) => row.some((cell) => headerKey(cell.text)));
  if (headerIdx < 0) return [];
  const keys = rows[headerIdx].map((cell) => headerKey(cell.text));
  if (!keys.includes("name")) return [];
  const out = [];
  rows.slice(headerIdx + 1).forEach((row) => {
    const rec = {};
    let photoFile = "";
    row.forEach((cell, index) => {
      const key = keys[index];
      if (!key) return;
      if (cell.file && !photoFile) photoFile = cell.file;
      if (key === "photo") return;
      if (!rec[key]) rec[key] = cell.text;
    });
    const nameRaw = rec.name || "";
    if (!nameRaw || /^(toy|model|photo|col|series)\b/i.test(nameRaw)) return;
    const split = splitVariation(nameRaw);
    if (!split.name || split.name.length < 2) return;
    const blob = [rec.series || "", heading || "", nameRaw, ctx.pageTitle || ""].join(" ");
    const line = lineOf(ctx.year, blob);
    const peeled = peelSeries(rec.series || "");
    let series = peeled.series;
    if (series.length < 2) series = (heading || "").replace(/\s+/g, " ").trim();
    const variation = [split.variation, rec.color, peeled.notes.join(" · ")].filter(Boolean).join(" · ");
    out.push({
      year: ctx.year,
      name: split.name,
      variation,
      series,
      toy: toyOf(rec.toy || ""),
      col: String(rec.col || "").replace(/[^\d]/g, "").slice(0, 4),
      mix: String(rec.mix || "").replace(/\s+/g, " ").trim(),
      caseCode: String(rec.case || "").replace(/\s+/g, " ").trim(),
      line,
      file: photoFile,
      wikiTitle: ctx.pageTitle,
    });
  });
  return out;
}

const MARKERS = [
  [/\{{\s*STH\b[^}]*\}\}/gi, " Super Treasure Hunt "],
  [/\{{\s*TH\b[^}]*\}\}/gi, " Treasure Hunt "],
  [/\{{\s*NM\b[^}]*\}\}/gi, " New Model "],
  [/\{{\s*WM\b[^}]*\}\}/gi, " Walmart Exclusive "],
  [/\{{\s*TG\b[^}]*\}\}/gi, " Target Exclusive "],
  [/\{{\s*KR\b[^}]*\}\}/gi, " Kroger Exclusive "],
  [/\{{\s*DG\b[^}]*\}\}/gi, " Dollar General Exclusive "],
  [/\{{\s*DT\b[^}]*\}\}/gi, " Dollar Tree Exclusive "],
  [/\{{\s*NIM\b[^}]*\}\}/gi, " New in Mainline "],
];

function splitPipes(body) {
  const parts = [];
  let cur = "";
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    if (body.startsWith("[[", i)) depth += 1;
    if (body.startsWith("]]", i)) depth = Math.max(0, depth - 1);
    if (body[i] === "|" && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += body[i];
  }
  parts.push(cur);
  return parts;
}

export function expandListTemplates(text) {
  return String(text || "").replace(/\{\{(List[A-Za-z0-9]*)\|([\s\S]*?)\}\}/g, (full, _name, body) => {
    const params = splitPipes(body).map((part) => part.trim()).filter((part, index) => part || index < 5);
    if (params.length < 3 || !toyOf(params[0])) return full;
    return "\n|-\n" + params.slice(0, 6).map((part) => "|" + part).join("\n") + "\n";
  });
}

export function preprocessWiki(text) {
  let next = String(text || "");
  MARKERS.forEach(([pattern, words]) => {
    next = next.replace(pattern, words);
  });
  return expandListTemplates(next);
}

function galleryCar(line, heading, ctx) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("<") || !trimmed.includes("[[")) return null;
  const pipe = trimmed.indexOf("|");
  if (pipe < 1) return null;
  let file = trimmed.slice(0, pipe).replace(/^(?:File|Image):/i, "").trim().replace(/_/g, " ");
  if (!/\.(jpe?g|png|gif|webp)$/i.test(file)) return null;
  const caption = parseCell(trimmed.slice(pipe + 1).replace(/\|link=.*$/i, ""));
  const split = splitVariation(caption.text);
  if (!split.name || split.name.length < 2) return null;
  if (/wallpaper|store stand|catalogue|catalog|logo|poster|box art|display/i.test(split.name)) return null;
  return {
    year: ctx.year,
    name: split.name,
    variation: split.variation,
    series: heading || "",
    toy: "",
    col: "",
    mix: "",
    caseCode: "",
    line: lineOf(ctx.year, (heading || "") + " " + split.name + " " + split.variation),
    file,
    wikiTitle: ctx.pageTitle,
  };
}

export function parseWikiPage(wikitext, ctx) {
  const lines = preprocessWiki(wikitext).split("\n");
  const items = [];
  let heading = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("==")) heading = parseCell(line.replace(/=/g, " ")).text;
    if (/^<gallery\b/i.test(line.trim())) {
      i += 1;
      while (i < lines.length && !/^<\/gallery>/i.test(lines[i].trim())) {
        const car = galleryCar(lines[i], heading, ctx);
        if (car) items.push(car);
        i += 1;
      }
      continue;
    }
    if (!line.startsWith("{|")) continue;
    const table = [];
    i += 1;
    while (i < lines.length && !lines[i].startsWith("|}")) {
      table.push(lines[i]);
      i += 1;
    }
    items.push(...parseTable(table, heading, ctx));
  }
  return items;
}

function wikiTitleUrl(title) {
  return "https://hotwheels.fandom.com/wiki/" + encodeURIComponent(String(title).replace(/ /g, "_"));
}

function filePage(file) {
  return "https://hotwheels.fandom.com/wiki/File:" + encodeURIComponent(String(file).replace(/ /g, "_"));
}

async function wikiPost(params) {
  const body = new URLSearchParams({ format: "json", maxlag: "5", ...params });
  return getJson(FANDOM, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });
}

async function fetchWikitext(title) {
  fs.mkdirSync(wikiCache, { recursive: true });
  const file = path.join(wikiCache, encodeURIComponent(title) + ".txt");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const data = await wikiPost({ action: "parse", page: title, prop: "wikitext", redirects: "1" });
  if (data.error) {
    if (data.error.code === "missingtitle") return "";
    throw new Error(title + " " + data.error.code);
  }
  const text = data.parse && data.parse.wikitext ? data.parse.wikitext["*"] : "";
  fs.writeFileSync(file, text);
  await sleep(120);
  return text;
}

async function searchTitles(query) {
  const data = await wikiPost({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "12",
    srnamespace: "0",
  });
  await sleep(80);
  return ((data.query && data.query.search) || []).map((hit) => hit.title);
}

function yearFromTitle(title) {
  const match = String(title).match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function norm(text) {
  return String(text || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function slug(text) {
  return norm(text).replace(/ /g, "-").slice(0, 48) || "car";
}

function tokens(text) {
  return norm(text).split(" ").filter((word) => word.length > 2 && !["hot", "wheels", "the", "and", "with", "series"].includes(word));
}

function scoreRow(row, cardName, cardSeries) {
  const rowTokens = new Set(tokens(row.name + " " + row.series + " " + row.variation));
  let score = 0;
  tokens(cardName).forEach((word) => {
    if (rowTokens.has(word)) score += 2;
  });
  tokens(cardSeries).forEach((word) => {
    if (rowTokens.has(word)) score += 1;
  });
  if (row.year >= 2025) score += 1;
  return score;
}

function cardToys(toy) {
  return String(toy || "")
    .toUpperCase()
    .split(/[/|,]+/)
    .map((part) => part.replace(/[^A-Z0-9]/g, ""))
    .filter((part) => /^[A-Z]{0,6}\d{1,6}[A-Z0-9]{0,3}$/.test(part));
}

function loadWorthCards() {
  const cards = require(path.join(root, "lib", "resale-cards.js"));
  const book = JSON.parse(fs.readFileSync(path.join(root, "data", "catalog.json"), "utf8"));
  const names = new Map();
  Object.keys(book).forEach((key) => {
    (book[key] || []).forEach((item) => {
      if (item && item.id) names.set(item.id, item.name || "");
    });
  });
  const list = [];
  Object.entries(cards).forEach(([id, card]) => {
    const name = names.get(id) || "";
    const series = card.series || "";
    list.push({
      id,
      verdict: card.resaleVerdict || card.verdict || "",
      name,
      series,
      toys: cardToys(card.toyNo),
      matchbox: /matchbox/i.test(name + " " + series + " " + id),
    });
  });
  const byToy = new Map();
  list.forEach((card) => {
    card.toys.forEach((toy) => {
      if (!byToy.has(toy)) byToy.set(toy, []);
      byToy.get(toy).push(card);
    });
  });
  return { byToy, list };
}

const WORTH_STOP = new Set(["hot", "wheels", "the", "and", "with", "for", "series", "super", "chase", "gold", "black", "blue", "teal", "white", "regular", "treasure", "hunt", "mainline", "edition", "target", "zamac", "boulevard", "premium", "anniversary", "pack", "packs", "display", "collector", "chrome", "brown", "pink", "red", "from", "car", "culture"]);

function worthWords(text) {
  return norm(text).split(" ").filter((word) => word.length > 2 && !WORTH_STOP.has(word));
}

function wantedLine(card) {
  const blob = card.name + " " + card.series;
  if (/super/i.test(card.name) && !/super chase/i.test(blob)) return "sth";
  if (/treasure hunt|\bth\b/i.test(blob)) return "th";
  if (/boulevard/i.test(blob)) return "boulevard";
  if (/pop culture/i.test(blob)) return "pop-culture";
  if (/team transport/i.test(blob)) return "team-transport";
  if (/car culture/i.test(blob)) return "car-culture";
  if (/monster truck/i.test(blob)) return "mainline";
  return "";
}

function nameScore(row, card) {
  const have = new Set(worthWords(row.name));
  const need = worthWords(card.name);
  if (!need.length) return 0;
  let score = 0;
  let hits = 0;
  need.forEach((word) => {
    if (!have.has(word)) return;
    hits += 1;
    score += word.length >= 5 ? 3 : 2;
  });
  if (hits < Math.min(2, need.length)) return 0;
  if (hits < need.length / 2) return 0;
  const line = wantedLine(card);
  if (line && row.line !== line) score -= 3;
  if (row.year >= 2026) score += 1;
  return score;
}

function flagWorth(row, card) {
  if (!row.worth) row.worth = { id: card.id, verdict: card.verdict };
}

function applyWorth(items, book) {
  const byToy = book.byToy;
  const flagged = new Set();
  const groups = new Map();
  items.forEach((item) => {
    const toy = String(item.toy || "").toUpperCase();
    if (!toy || !byToy.has(toy)) return;
    if (!groups.has(toy)) groups.set(toy, []);
    groups.get(toy).push(item);
  });
  groups.forEach((rows, toy) => {
    byToy.get(toy).forEach((card) => {
      const ranked = rows.map((row) => ({ row, score: scoreRow(row, card.name, card.series) }));
      ranked.sort((a, b) => b.score - a.score);
      const best = ranked[0] ? ranked[0].score : 0;
      const picks = best > 0 ? ranked.filter((entry) => entry.score === best).slice(0, 2) : ranked.slice(0, 1);
      picks.forEach((entry) => {
        flagWorth(entry.row, card);
        flagged.add(card.id);
      });
    });
  });
  const recent = items.filter((item) => item.year >= 2025);
  book.list.forEach((card) => {
    if (card.matchbox || flagged.has(card.id)) return;
    const ranked = recent.map((row) => ({ row, score: nameScore(row, card) })).filter((entry) => entry.score >= 4);
    ranked.sort((a, b) => b.score - a.score);
    if (!ranked.length) return;
    const best = ranked[0].score;
    const picks = ranked.filter((entry) => entry.score === best).slice(0, 2);
    if (ranked.filter((entry) => entry.score === best).length > 2) return;
    picks.forEach((entry) => {
      flagWorth(entry.row, card);
      flagged.add(card.id);
    });
  });
  const missed = book.list.filter((card) => !card.matchbox && !flagged.has(card.id)).map((card) => card.id + " " + card.name);
  if (missed.length) process.stdout.write("worth unmatched " + missed.length + "\n" + missed.join("\n") + "\n");
  else process.stdout.write("worth matched every hot wheels hunt card\n");
}

function skuOk(sku) {
  return /^[A-Z]{1,5}\d{2,5}[A-Z]?$/.test(sku);
}

function isVehicleProduct(product) {
  const title = product.title || "";
  const tags = (product.tags || []).join(" ");
  const blob = title + " " + tags;
  if (/apparel|t-shirt|tee\b|hoodie|poster|playmat|gift card|digital membership|membership|sticker|hat\b|cap\b|socks|backpack|lunchbox|mug\b|blanket/i.test(blob)) return false;
  if (/\br\/?c\b|remote control|1:10/i.test(title)) return false;
  if (/Category:\s*Vehicles/i.test(tags)) return true;
  if (/category:\s*apparel/i.test(tags)) return false;
  return /hot wheels/i.test(title) && /vehicle|car culture|boulevard|rlc|elite|premium|mainline/i.test(blob);
}

function releaseYearFromProduct(product) {
  const tags = product.tags || [];
  const years = [];
  tags.forEach((tag) => {
    const full = String(tag).match(/\b(20\d{2})\b/);
    if (full) years.push(Number(full[1]));
    const short = String(tag).match(/(?:REOFFER|OFFER|SUMMER|FALL|WINTER|SPRING|MAY|MAR|APRIL|JAN|FEB|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[^0-9]{0,12}(\d{2})\b/i);
    if (short) {
      const yy = Number(short[1]);
      if (yy >= 0 && yy <= 40) years.push(2000 + yy);
    }
  });
  const titleYear = String(product.title || "").match(/\b(20\d{2})\b/);
  if (titleYear) years.push(Number(titleYear[1]));
  const inRange = years.filter((year) => year >= 1995 && year <= LAST_YEAR + 1);
  if (inRange.length) return Math.min(...inRange);
  const published = Date.parse(product.published_at || product.created_at || "");
  if (Number.isFinite(published)) {
    const year = new Date(published).getUTCFullYear();
    if (year >= 1995 && year <= LAST_YEAR + 1) return year;
  }
  return null;
}

function lineFromProduct(product, collection) {
  const blob = [product.title, (product.tags || []).join(" "), collection].join(" ");
  return lineOf(releaseYearFromProduct(product) || 2020, blob);
}

function shopifyThumb(src) {
  if (!src) return "";
  try {
    const url = new URL(src);
    url.searchParams.set("width", "480");
    return url.toString();
  } catch (err) {
    return src;
  }
}

function rememberProduct(index, product, collection) {
  if (!product || !product.handle || !isVehicleProduct(product)) return;
  const images = product.images || [];
  const byId = new Map(images.map((img) => [img.id, img.src]));
  const productSrc = images[0] && images[0].src;
  (product.variants || []).forEach((variant) => {
    const sku = String(variant.sku || "").toUpperCase().replace(/\s+/g, "");
    if (!skuOk(sku)) return;
    const src = (variant.featured_image && variant.featured_image.src) || byId.get(variant.image_id) || productSrc;
    if (!src) return;
    const entry = {
      sku,
      title: product.title || "",
      handle: product.handle,
      src: shopifyThumb(src),
      url: MATTEL + "/products/" + product.handle,
      tags: product.tags || [],
      year: releaseYearFromProduct(product),
      line: lineFromProduct(product, collection),
      published_at: product.published_at || "",
    };
    if (!index.has(sku)) index.set(sku, entry);
  });
}

function rememberUcp(index, product) {
  const tags = product.tags || [];
  const adapted = {
    title: product.title,
    handle: product.handle,
    tags,
    images: (product.media || []).filter((media) => media && media.url).map((media, i) => ({ id: i, src: media.url })),
    variants: (product.variants || []).map((variant) => ({
      sku: variant.sku,
      image_id: null,
      featured_image: variant.media && variant.media.url ? { src: variant.media.url } : (variant.media && variant.media[0] ? { src: variant.media[0].url } : null),
    })),
    published_at: "",
  };
  if (!adapted.images.length && product.media && product.media[0]) adapted.images = [{ id: 0, src: product.media[0].url }];
  (product.variants || []).forEach((variant, indexVariant) => {
    const media = variant.media;
    const url = media && !Array.isArray(media) ? media.url : media && media[0] && media[0].url;
    if (url) adapted.variants[indexVariant].featured_image = { src: url };
  });
  rememberProduct(index, adapted, "search_catalog");
}

async function pullCollection(handle, index) {
  let page = 1;
  let count = 0;
  while (page <= 30) {
    const data = await getJson(MATTEL + "/collections/" + handle + "/products.json?limit=250&page=" + page);
    const products = data.products || [];
    products.forEach((product) => rememberProduct(index, product, handle));
    count += products.length;
    process.stdout.write("  collection " + handle + " page " + page + " +" + products.length + "\n");
    if (products.length < 250) break;
    page += 1;
    await sleep(150);
  }
  return count;
}

async function searchCatalog(index) {
  let cursor = "";
  for (let page = 0; page < 25; page++) {
    const payload = {
      jsonrpc: "2.0",
      id: page + 1,
      method: "tools/call",
      params: {
        name: "search_catalog",
        arguments: {
          meta: { "ucp-agent": { profile: "https://creations.mattel.com/.well-known/ucp" } },
          catalog: {
            query: "Hot Wheels",
            filters: { available: false },
            pagination: { limit: 50, ...(cursor ? { cursor } : {}) },
          },
        },
      },
    };
    const data = await getJson(MATTEL + "/api/ucp/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const content = data.result && data.result.content && data.result.content[0] && data.result.content[0].text;
    if (!content) break;
    const parsed = JSON.parse(content);
    (parsed.products || []).forEach((product) => rememberUcp(index, product));
    process.stdout.write("  search_catalog page " + (page + 1) + " +" + ((parsed.products || []).length) + "\n");
    if (!parsed.pagination || !parsed.pagination.has_next_page || !parsed.pagination.cursor) break;
    cursor = parsed.pagination.cursor;
    await sleep(120);
  }
}

async function searchSuggest(index) {
  const queries = ["hot wheels", "red line club", "car culture", "elite 64", "boulevard"];
  for (const query of queries) {
    const url = MATTEL + "/search/suggest.json?q=" + encodeURIComponent(query) + "&resources[type]=product&resources[limit]=10";
    try {
      const data = await getJson(url);
      const products = (((data.resources || {}).results || {}).products) || [];
      for (const hit of products) {
        if (!hit || !hit.handle || indexHasHandle(index, hit.handle)) continue;
        try {
          const detail = await getJson(MATTEL + "/products/" + hit.handle + ".json");
          if (detail.product) rememberProduct(index, detail.product, "search");
          await sleep(80);
        } catch (err) {
          process.stdout.write("  suggest miss " + hit.handle + "\n");
        }
      }
      process.stdout.write("  storefront search “" + query + "” " + products.length + "\n");
    } catch (err) {
      process.stdout.write("  storefront search skipped " + query + "\n");
    }
  }
}

function indexHasHandle(index, handle) {
  for (const entry of index.values()) {
    if (entry.handle === handle) return true;
  }
  return false;
}

async function resolveImages(files) {
  const cacheFile = path.join(cacheDir, "images.json");
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};
  const pending = [...files].filter((file) => file && !cache[file]);
  process.stdout.write("images " + files.size + " unique, " + pending.length + " to resolve\n");
  for (let i = 0; i < pending.length; i += 40) {
    const batch = pending.slice(i, i + 40);
    const titles = batch.map((file) => "File:" + file).join("|");
    let data;
    try {
      data = await wikiPost({
        action: "query",
        titles,
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: "360",
        redirects: "1",
      });
    } catch (err) {
      process.stdout.write("  image batch failed " + err.message + "\n");
      await sleep(1000);
      continue;
    }
    const pages = (data.query && data.query.pages) || {};
    const urlByTitle = new Map();
    Object.values(pages).forEach((page) => {
      if (!page || !page.title || page.missing != null) return;
      const info = (page.imageinfo || [])[0];
      const url = info && (info.thumburl || info.url);
      if (!url) return;
      urlByTitle.set(page.title, url);
      urlByTitle.set(page.title.replace(/_/g, " "), url);
    });
    const aliases = []
      .concat((data.query && data.query.normalized) || [])
      .concat((data.query && data.query.redirects) || []);
    aliases.forEach((row) => {
      if (!row || !row.from || !row.to) return;
      const url = urlByTitle.get(row.to) || urlByTitle.get(String(row.to).replace(/_/g, " "));
      if (url) urlByTitle.set(row.from, url);
    });
    batch.forEach((file) => {
      const url = urlByTitle.get("File:" + file)
        || urlByTitle.get("File:" + file.replace(/ /g, "_"))
        || urlByTitle.get("File:" + file.replace(/_/g, " "))
        || "";
      cache[file] = url;
    });
    if ((i / 40) % 5 === 0) process.stdout.write("  image batch " + (i + batch.length) + "/" + pending.length + "\n");
    fs.writeFileSync(cacheFile, JSON.stringify(cache));
    await sleep(150);
  }
  return cache;
}

function assignIds(items) {
  const seen = new Map();
  items.forEach((item) => {
    const base = ["hw", item.year || "na", item.toy || "na", slug(item.name), slug(item.variation || item.line)].join("-");
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    item.id = count ? base + "-" + (count + 1) : base;
  });
}

function dedupe(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = [item.year, item.toy, norm(item.name), norm(item.variation), item.line].join("|");
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      return;
    }
    if (!prev.file && item.file) map.set(key, item);
  });
  return [...map.values()];
}

function applyMattelImages(items, bySku) {
  const byToy = new Map();
  items.forEach((item) => {
    const toy = String(item.toy || "").toUpperCase();
    if (!toy || !bySku.has(toy)) return;
    if (!byToy.has(toy)) byToy.set(toy, []);
    byToy.get(toy).push(item);
  });
  let matched = 0;
  byToy.forEach((rows, toy) => {
    const product = bySku.get(toy);
    const ranked = rows.map((row) => ({ row, score: scoreRow(row, product.title, product.line) }));
    const best = Math.max(...ranked.map((entry) => entry.score));
    const picks = best > 0 ? ranked.filter((entry) => entry.score === best) : ranked;
    picks.forEach((entry) => {
      entry.row.image = product.src;
      entry.row.imageSource = "mattel";
      entry.row.imageCredit = "Mattel Creations";
      entry.row.imagePage = product.url;
      entry.row.mattelHandle = product.handle;
      matched += 1;
    });
  });
  return matched;
}

function mattelOnlyItems(items, bySku) {
  const used = new Set(items.map((item) => String(item.toy || "").toUpperCase()).filter(Boolean));
  const extra = [];
  bySku.forEach((product, sku) => {
    if (used.has(sku)) return;
    if (!product.year) return;
    const name = String(product.title || "").replace(/^hot wheels\s+/i, "").trim();
    extra.push({
      year: product.year,
      name: name || product.title,
      variation: "Mattel Creations",
      series: product.line,
      toy: sku,
      col: "",
      mix: "",
      caseCode: "",
      line: product.line,
      file: "",
      image: product.src,
      imageSource: "mattel",
      imageCredit: "Mattel Creations",
      imagePage: product.url,
      mattelHandle: product.handle,
      wikiTitle: "",
      yearNote: "Mattel listing year",
    });
  });
  return extra;
}

function publicItem(item) {
  return {
    id: item.id,
    year: item.year,
    name: item.name,
    series: item.series || "",
    toy: item.toy || "",
    col: item.col || "",
    mix: item.mix || "",
    caseCode: item.caseCode || "",
    variation: item.variation || "",
    line: item.line || "mainline",
    image: item.image || "",
    imageSource: item.image ? (item.imageSource || "wiki") : "",
    imageCredit: item.image ? (item.imageCredit || "Hot Wheels Wiki") : "",
    imagePage: item.imagePage || "",
    wiki: item.wikiTitle ? wikiTitleUrl(item.wikiTitle) : "",
    worth: item.worth || null,
  };
}

async function main() {
  fs.mkdirSync(cacheDir, { recursive: true });
  const bySku = new Map();
  if (!SKIP_MATTEL) {
    process.stdout.write("Mattel Creations read-only catalog\n");
    for (const handle of COLLECTIONS) {
      await pullCollection(handle, bySku);
    }
    await searchCatalog(bySku);
    await searchSuggest(bySku);
    process.stdout.write("mattel vehicle skus " + bySku.size + "\n");
    fs.writeFileSync(path.join(cacheDir, "mattel-skus.json"), JSON.stringify([...bySku.values()]));
  } else if (fs.existsSync(path.join(cacheDir, "mattel-skus.json"))) {
    JSON.parse(fs.readFileSync(path.join(cacheDir, "mattel-skus.json"), "utf8")).forEach((entry) => {
      bySku.set(entry.sku, entry);
    });
  }

  const years = [];
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) years.push(year);
  const wanted = new Set(ONLY_YEARS || years);
  const pages = [];
  for (const year of years) {
    if (!wanted.has(year)) continue;
    pages.push({ title: "List of " + year + " Hot Wheels", year });
  }

  if (!SKIP_EXTRAS) {
    const seen = new Set(pages.map((page) => page.title));
    for (const year of years) {
      if (!wanted.has(year) || year < 2012) continue;
      const queries = [
        year + " Car Culture",
        year + " Hot Wheels Boulevard",
        year + " Pop Culture",
        year + " Treasure Hunts Series",
        year + " Team Transport",
        year + " Red Line Club",
        year + " Fast & Furious Premium",
      ];
      for (const query of queries) {
        let titles = [];
        try {
          titles = await searchTitles(query);
        } catch (err) {
          process.stdout.write("  search failed " + query + "\n");
        }
        titles.forEach((title) => {
          if (seen.has(title)) return;
          if (!title.includes(String(year))) return;
          if (/^list of \d{4} hot wheels$/i.test(title)) return;
          if (/category:|file:|template:|user:|talk:/i.test(title)) return;
          seen.add(title);
          pages.push({ title, year: yearFromTitle(title) || year });
        });
      }
    }
  }

  process.stdout.write("wiki pages " + pages.length + "\n");
  let raw = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    let text = "";
    try {
      text = await fetchWikitext(page.title);
    } catch (err) {
      process.stdout.write("  miss " + page.title + " " + err.message + "\n");
      continue;
    }
    const parsed = parseWikiPage(text, { year: page.year, pageTitle: page.title });
    raw.push(...parsed);
    if (i % 15 === 0 || parsed.length === 0) {
      process.stdout.write("  " + (i + 1) + "/" + pages.length + " " + page.title + " -> " + parsed.length + "\n");
    }
  }
  raw = dedupe(raw);
  process.stdout.write("wiki rows " + raw.length + "\n");

  const files = new Set(raw.map((item) => item.file).filter(Boolean));
  const imageCache = SKIP_IMAGES ? {} : await resolveImages(files);
  raw.forEach((item) => {
    const url = item.file ? imageCache[item.file] || imageCache[item.file.replace(/_/g, " ")] || "" : "";
    if (url) {
      item.image = url;
      item.imageSource = "wiki";
      item.imageCredit = "Hot Wheels Wiki";
      item.imagePage = filePage(item.file);
    } else {
      item.image = "";
      item.imageSource = "";
      item.imageCredit = "";
      item.imagePage = "";
    }
  });

  const overlay = applyMattelImages(raw, bySku);
  const extra = mattelOnlyItems(raw, bySku);
  process.stdout.write("mattel overlays " + overlay + " mattel-only " + extra.length + "\n");
  const items = raw.concat(extra);
  applyWorth(items, loadWorthCards());
  assignIds(items);

  const byYear = new Map();
  items.forEach((item) => {
    const year = item.year;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(publicItem(item));
  });
  fs.mkdirSync(outDir, { recursive: true });
  const yearStats = [];
  [...byYear.keys()].sort((a, b) => a - b).forEach((year) => {
    const list = byYear.get(year).sort((a, b) => {
      const col = String(a.col).padStart(4, "0").localeCompare(String(b.col).padStart(4, "0"));
      if (col) return col;
      return a.name.localeCompare(b.name);
    });
    const photos = list.filter((item) => item.image).length;
    const mattel = list.filter((item) => item.imageSource === "mattel").length;
    const file = "data/hw/" + year + ".json";
    fs.writeFileSync(path.join(root, file), JSON.stringify({ year, items: list }));
    yearStats.push({ year, count: list.length, photos, mattel, file });
    process.stdout.write(year + " " + list.length + " photos " + photos + " mattel " + mattel + "\n");
  });

  const idxDir = path.join(outDir, "idx");
  fs.mkdirSync(idxDir, { recursive: true });
  let indexed = 0;
  yearStats.forEach((stat) => {
    const list = JSON.parse(fs.readFileSync(path.join(root, stat.file), "utf8")).items;
    const rows = list.map((item) => {
      const row = { id: item.id, y: item.year, n: item.name, l: item.line || "mainline" };
      if (item.toy) row.t = item.toy;
      if (item.col) row.c = item.col;
      if (item.series) row.s = item.series;
      if (item.worth) row.w = 1;
      if (item.worth && item.worth.verdict) row.v = item.worth.verdict;
      if (item.image) row.i = item.image;
      return row;
    });
    indexed += rows.length;
    fs.writeFileSync(path.join(idxDir, stat.year + ".json"), JSON.stringify({ items: rows }));
  });
  const totals = yearStats.reduce((sum, stat) => {
    sum.count += stat.count;
    sum.photos += stat.photos;
    sum.mattel += stat.mattel;
    return sum;
  }, { count: 0, photos: 0, mattel: 0 });
  totals.photoPct = totals.count ? Math.round((totals.photos / totals.count) * 1000) / 10 : 0;
  totals.mattelPct = totals.count ? Math.round((totals.mattel / totals.count) * 1000) / 10 : 0;
  const manifest = {
    generatedAt: new Date().toISOString(),
    phase: "1968–" + LAST_YEAR + " Hot Wheels Wiki year lists, plus series pages found for 2012–" + LAST_YEAR + ". Mattel Creations images hotlinked when the toy number matches. No image files are stored in the repo.",
    attribution: "Release tables: Hot Wheels Wiki (Fandom), CC BY-SA. Official photos: Mattel Creations CDN, hotlinked, for items matched by toy number or name. Other photos: Hot Wheels Wiki file thumbs, hotlinked, with a link to the file page.",
    sources: {
      wiki: "https://hotwheels.fandom.com/wiki/Category:Lists_of_Hot_Wheels_by_year",
      mattel: "https://creations.mattel.com/collections/hot-wheels-collectors",
    },
    totals,
    years: yearStats,
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify({ chunked: true, count: indexed }) + "\n");
  process.stdout.write("TOTAL " + totals.count + " photos " + totals.photoPct + "% mattel " + totals.mattelPct + "% (" + totals.mattel + ")\n");
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
