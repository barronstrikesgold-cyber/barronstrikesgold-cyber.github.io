// Refresh public promotions from official store and brand pages.
// A code is stored only when that official page, or an affiliate feed, prints it.
// Leaked and private codes are never written. robots.txt is respected.
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = "HuntCoupons/1.0 (+https://barronstrikesgold-cyber.github.io/; official promo check)";

export const STORES = [
  { id: "walmart", store: "Walmart", page: "https://www.walmart.com/shop/deals", sourceKind: "official", covers: ["walmart"] },
  { id: "target", store: "Target", page: "https://www.target.com/c/top-deals/-/N-4xw74", sourceKind: "official", covers: ["target"] },
  { id: "goodwill", store: "Goodwill", page: "https://shopgoodwill.com/", sourceKind: "official", covers: ["goodwill"] },
  { id: "bestbuy", store: "Best Buy", page: "https://www.bestbuy.com/site/top-deals/pcmcat1563299782894.c?id=pcmcat1563299782894", sourceKind: "official", covers: ["bestbuy"] },
  { id: "dollartree", store: "Dollar Tree", page: "https://www.dollartree.com/", sourceKind: "official", covers: ["dollartree"] },
  { id: "amazon", store: "Amazon", page: "https://www.amazon.com/deals", sourceKind: "official", covers: ["amazon"] },
  { id: "gamestop", store: "GameStop", page: "https://www.gamestop.com/deals", sourceKind: "official", covers: ["gamestop"] },
  { id: "mattel", store: "Mattel Creations", page: "https://creations.mattel.com/", sourceKind: "official", covers: ["mattel", "matchbox"] },
  { id: "pokemon", store: "Pokémon Center", page: "https://www.pokemoncenter.com/", sourceKind: "official", covers: ["pokemon"] },
  { id: "magic", store: "Magic: The Gathering", page: "https://magic.wizards.com/en", sourceKind: "official", covers: ["magic"] },
  { id: "onepiece", store: "One Piece Card Game", page: "https://en.onepiece-cardgame.com/", sourceKind: "official", covers: ["onepiece"] },
  { id: "lorcana", store: "Disney Lorcana", page: "https://www.disneylorcana.com/en-US", sourceKind: "official", covers: ["lorcana"] },
  { id: "yugioh", store: "Yu-Gi-Oh", page: "https://www.yugioh-card.com/en/", sourceKind: "official", covers: ["yugioh"] },
  { id: "topps", store: "Topps", page: "https://www.topps.com/", sourceKind: "official", covers: ["sports"] },
  { id: "panini", store: "Panini", page: "https://www.paniniamerica.net/", sourceKind: "official", covers: ["sports"] },
  { id: "nike", store: "Nike", page: "https://www.nike.com/w/sale-3yaep", sourceKind: "official", covers: ["sneakers"] },
  { id: "jordan", store: "Jordan", page: "https://www.nike.com/jordan", sourceKind: "official", covers: ["sneakers"] },
  { id: "adidas", store: "adidas", page: "https://www.adidas.com/us/sale", sourceKind: "official", covers: ["sneakers"] },
  { id: "newbalance", store: "New Balance", page: "https://www.newbalance.com/sale/", sourceKind: "official", covers: ["sneakers"] },
  { id: "asics", store: "ASICS", page: "https://www.asics.com/us/en-us/sale/", sourceKind: "official", covers: ["sneakers"] },
  { id: "puma", store: "Puma", page: "https://us.puma.com/us/en/sale", sourceKind: "official", covers: ["sneakers"] },
  { id: "footlocker", store: "Foot Locker", page: "https://www.footlocker.com/category/sale.html", sourceKind: "official", covers: ["sneakers"] },
  { id: "nordstrom", store: "Nordstrom", page: "https://www.nordstrom.com/browse/sale", sourceKind: "official", covers: ["designer"] },
  { id: "saks", store: "Saks", page: "https://www.saksfifthavenue.com/c/sale", sourceKind: "official", covers: ["designer"] },
  { id: "supreme", store: "Supreme", page: "https://www.supremenewyork.com/", sourceKind: "official", covers: ["designer"] },
  { id: "kith", store: "Kith", page: "https://kith.com/", sourceKind: "official", covers: ["designer"] },
  { id: "palace", store: "Palace", page: "https://shop.palaceskateboards.com/", sourceKind: "official", covers: ["designer"] },
  { id: "lego", store: "LEGO", page: "https://www.lego.com/en-us/categories/deals", sourceKind: "official", covers: ["lego"] },
  { id: "funko", store: "Funko", page: "https://funko.com/", sourceKind: "official", covers: ["funko"] },
  { id: "apple", store: "Apple", page: "https://www.apple.com/shop/browse/home/specialdeals", sourceKind: "official", covers: ["apple"] },
  { id: "nintendo", store: "Nintendo", page: "https://www.nintendo.com/us/store/sales-and-deals/", sourceKind: "official", covers: ["consoles"] },
  { id: "playstation", store: "PlayStation", page: "https://www.playstation.com/en-us/", sourceKind: "official", covers: ["consoles"] },
  { id: "xbox", store: "Xbox", page: "https://www.xbox.com/en-US/promotions", sourceKind: "official", covers: ["consoles"] },
];

const CODE_BLOCK = new Set(["CODE", "PROMO", "COUPON", "OFFER", "SALE", "FREE", "SAVE", "ONLY", "ONLINE", "STORE", "STORES", "NIKE", "LEGO", "ITEM", "CARD", "HTTP", "HTTPS", "HTML", "JSON", "NULL", "TRUE", "FALSE", "WITH", "YOUR", "THIS", "THAT", "FROM", "SITE", "SHOP", "DEAL"]);

export function robotsAllows(text, status, targetPath) {
  if (status === 404) return true;
  if (status !== 200) return false;
  const lines = String(text || "").split(/\r?\n/);
  let inGroup = false;
  let star = false;
  let groupRules = [];
  const rules = [];
  function flush() {
    if (star) rules.push(...groupRules);
    groupRules = [];
  }
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const match = line.match(/^([^:]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (key === "user-agent") {
      if (inGroup) flush();
      inGroup = true;
      star = value === "*";
      continue;
    }
    if (!inGroup || !star) continue;
    if (key === "allow" || key === "disallow") groupRules.push({ allow: key === "allow", path: value });
  }
  flush();
  let winner = null;
  for (const rule of rules) {
    if (!rule.path) continue;
    if (targetPath.startsWith(rule.path)) {
      if (!winner || rule.path.length >= winner.path.length) winner = rule;
    }
  }
  if (!winner) return true;
  return !!winner.allow;
}

export function plainText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&#x([0-9a-f]+);/gi, function (_, hex) {
      const code = parseInt(hex, 16);
      return code > 31 && code < 127 ? String.fromCharCode(code) : " ";
    })
    .replace(/&#(\d+);/g, function (_, num) {
      const code = Number(num);
      return code > 31 && code < 127 ? String.fromCharCode(code) : " ";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function addDays(iso, days) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const MONTHS = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";

function toIso(value) {
  const named = String(value || "").match(new RegExp("\\b(" + MONTHS + ")\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b", "i"));
  if (named) {
    const parsed = new Date(named[1] + " " + named[2] + ", " + named[3] + " UTC");
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  const iso = String(value || "").match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return iso ? iso[1] : "";
}

export function readDates(windowText) {
  const text = String(windowText || "");
  const found = [];
  const named = new RegExp("\\b(?:" + MONTHS + ")\\s+\\d{1,2},?\\s+20\\d{2}\\b", "gi");
  let match;
  while ((match = named.exec(text))) found.push({ iso: toIso(match[0]), index: match.index });
  const isoRe = /\b20\d{2}-\d{2}-\d{2}\b/g;
  while ((match = isoRe.exec(text))) found.push({ iso: match[0], index: match.index });
  found.sort((a, b) => a.index - b.index);
  let starts = "";
  let ends = "";
  found.forEach((row) => {
    if (!row.iso) return;
    const cue = text.slice(Math.max(0, row.index - 28), row.index).toLowerCase();
    if (/through|until|ends|expires|thru/.test(cue)) {
      if (!ends) ends = row.iso;
    } else if (/from|starts|begins/.test(cue)) {
      if (!starts) starts = row.iso;
    }
  });
  const isos = found.map((row) => row.iso).filter(Boolean).sort();
  if (!starts && !ends && isos.length >= 2) {
    starts = isos[0];
    ends = isos[isos.length - 1];
  } else if (!ends && isos.length === 1 && !starts) {
    ends = isos[0];
  }
  return { starts: starts, ends: ends, expiryStated: !!ends };
}

function clip(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trim() + "…";
}

export function publicCode(windowText) {
  const text = plainText(windowText);
  const patterns = [
    /\b(?:promo|coupon|offer)\s+code\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,19})\b/i,
    /\buse\s+code\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,19})\b/i,
    /\bcode\s*[:#]\s*([A-Z0-9][A-Z0-9-]{3,19})\b/i,
  ];
  for (const re of patterns) {
    const found = text.match(re);
    if (!found) continue;
    const code = found[1].toUpperCase();
    if (CODE_BLOCK.has(code)) continue;
    if (!/\d/.test(code) && code.length < 6) continue;
    return code;
  }
  return "";
}

function contextAt(text, index) {
  return text.slice(Math.max(0, index - 180), Math.min(text.length, index + 320));
}

function readTerms(windowText) {
  const text = String(windowText || "");
  let minimum = "";
  const spend = text.match(/(?:minimum|min\.?)\s+(?:purchase|spend|order)?\s*(?:of\s*)?\$(\d[\d,]*)|orders?\s+(?:of|over|above)\s+\$(\d[\d,]*)|\$(\d[\d,]*)\s+(?:minimum|min)\b/i);
  if (spend) minimum = "$" + (spend[1] || spend[2] || spend[3]);
  let exclusions = "";
  const excluded = text.match(/\bexclud(?:e|es|ing)\s+([^.]{3,80})/i);
  if (excluded) exclusions = clip(excluded[1], 80);
  let eligible = "";
  if (/\bsitewide\b/i.test(text)) eligible = "Sitewide";
  else {
    const on = text.match(/\b(?:valid|good|applies)\s+on\s+([^.]{3,80})/i) || text.match(/\bon\s+(sneakers|shoes|apparel|sale|select items|cards|toys|clearance)\b/i);
    if (on) eligible = clip(on[1], 80);
  }
  let stacking = "";
  const stack = text.match(/\b(?:cannot be combined|not combinable|does not stack|stackable|one per order|one code)[^.]{0,40}/i);
  if (stack) stacking = clip(stack[0], 80);
  let channel = "";
  if (/online and in[-\s]?store|in[-\s]?store and online/i.test(text)) channel = "Online and in-store";
  else if (/in[-\s]?store only/i.test(text)) channel = "In-store";
  else if (/online only/i.test(text)) channel = "Online";
  else if (/in[-\s]?store/i.test(text)) channel = "In-store";
  else if (/\bonline\b/i.test(text)) channel = "Online";
  return { minimum, exclusions, eligible, stacking, channel };
}

export function extractOffers(html, source, now) {
  const text = plainText(html);
  const re = /\b(\d{1,2}\s*%\s*off|\$\d[\d,]*\s*off|buy one get one(?: free)?|bogo)\b/gi;
  const offers = [];
  const seen = new Set();
  let match;
  while ((match = re.exec(text))) {
    const pretty = match[0].replace(/\s+/g, " ");
    const windowText = contextAt(text, match.index);
    const code = publicCode(windowText);
    const key = (pretty + "|" + code).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const dates = readDates(windowText);
    const terms = readTerms(windowText);
    const kind = source.sourceKind === "affiliate" ? "affiliate" : "official";
    if (!/^https:\/\//.test(source.page || "")) continue;
    offers.push({
      id: source.id + "-" + (offers.length + 1),
      sourceId: source.id,
      store: source.store,
      label: source.store + " · " + pretty + (code ? " · " + code : ""),
      offer: pretty,
      discount: pretty,
      code: code,
      minimum: terms.minimum,
      exclusions: terms.exclusions,
      eligible: terms.eligible,
      starts: dates.starts,
      expires: dates.ends || addDays(now, 2),
      expiryStated: dates.expiryStated,
      stacking: terms.stacking,
      channel: terms.channel,
      sourceUrl: source.page,
      sourceKind: kind,
      lastChecked: now,
      active: true,
      rank: (code ? 5 : 0) + (/code|coupon|promo|sitewide|orders?\s+over|minimum/i.test(windowText) ? 2 : 0) + (/20\d{2}/.test(windowText) ? 1 : 0),
    });
  }
  offers.sort((a, b) => b.rank - a.rank);
  return offers.slice(0, 8).map((row, index) => {
    const next = Object.assign({}, row, { id: source.id + "-" + (index + 1) });
    delete next.rank;
    return next;
  });
}

function httpsUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch (err) {
    return "";
  }
}

export function parseAffiliate(body, now) {
  let data;
  try { data = JSON.parse(body); } catch (err) { return []; }
  const rows = Array.isArray(data) ? data : (data && Array.isArray(data.offers) ? data.offers : []);
  const offers = [];
  rows.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const sourceUrl = httpsUrl(row.sourceUrl || row.url || "");
    if (!sourceUrl) return;
    const code = publicCode("code: " + String(row.code || ""));
    const offer = clip(row.offer || row.discount || "", 80);
    if (!offer && !code) return;
    const dates = readDates([row.starts, row.expires, row.ends].filter(Boolean).join(" through "));
    const expires = toIso(row.expires || row.ends || "") || dates.ends || addDays(now, 2);
    offers.push({
      id: "affiliate-" + (offers.length + 1),
      sourceId: "affiliate",
      store: clip(row.store || "Affiliate", 40),
      label: clip((row.store || "Affiliate") + " · " + (offer || code), 90),
      offer: offer,
      discount: offer,
      code: code,
      minimum: clip(row.minimum || "", 40),
      exclusions: clip(row.exclusions || "", 80),
      eligible: clip(row.eligible || "", 80),
      starts: toIso(row.starts || "") || dates.starts || "",
      expires: expires,
      expiryStated: !!(toIso(row.expires || row.ends || "") || dates.ends),
      stacking: clip(row.stacking || "", 80),
      channel: clip(row.channel || "", 40),
      sourceUrl: sourceUrl,
      sourceKind: "affiliate",
      lastChecked: now,
      active: true,
    });
  });
  return offers;
}

function request(url, redirects) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); } catch (err) { resolve({ status: 0, body: "", error: "bad-url" }); return; }
    const lib = parsed.protocol === "http:" ? http : https;
    const req = lib.request({
      method: "GET",
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: { "User-Agent": UA, Accept: "text/html,application/json;q=0.9,*/*;q=0.5" },
      timeout: 12000,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => {
        if (chunks.reduce((sum, part) => sum + part.length, 0) < 900000) chunks.push(chunk);
      });
      res.on("end", () => {
        const status = res.statusCode || 0;
        const loc = res.headers.location || "";
        if ([301, 302, 303, 307, 308].includes(status) && loc && redirects < 3) {
          resolve(request(new URL(loc, url).toString(), redirects + 1));
          return;
        }
        resolve({ status, body: Buffer.concat(chunks).toString("utf8") });
      });
    });
    req.on("error", (err) => resolve({ status: 0, body: "", error: err.message }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "", error: "timeout" }); });
    req.end();
  });
}

async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await worker(items[index], index);
    }
  }
  const runners = [];
  for (let i = 0; i < Math.min(limit, items.length); i += 1) runners.push(run());
  await Promise.all(runners);
  return out;
}

function stillCurrent(row, today) {
  if (!row || row.example === true || row.active === false) return false;
  const kind = String(row.sourceKind || "");
  if (kind !== "official" && kind !== "affiliate") return false;
  if (!/^https:\/\//.test(String(row.sourceUrl || ""))) return false;
  const expires = String(row.expires || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(expires) && expires >= today;
}

export async function refreshCoupons(previous, now, fetcher) {
  const get = fetcher || request;
  const today = String(now).slice(0, 10);
  const offers = [];
  const checked = [];
  const sources = STORES.slice();
  if (process.env.COUPON_FEED_URL) {
    sources.push({ id: "affiliate", store: "Affiliate feed", page: process.env.COUPON_FEED_URL, sourceKind: "affiliate", covers: [] });
  }
  const results = await pool(sources, 4, async (source) => {
    let host = "";
    let targetPath = "/";
    try {
      const parsed = new URL(source.page);
      host = parsed.hostname;
      targetPath = parsed.pathname || "/";
    } catch (err) {
      return { source, check: { id: source.id, store: source.store, url: source.page, allowed: false, reason: "bad-url" }, found: [] };
    }
    const robots = await get("https://" + host + "/robots.txt", 0);
    const allowed = robotsAllows(robots.body || "", robots.status, targetPath);
    if (!allowed) {
      return {
        source,
        check: { id: source.id, store: source.store, url: source.page, allowed: false, reason: robots.status === 200 ? "robots" : "robots-unreadable", status: robots.status },
        found: [],
      };
    }
    const page = await get(source.page, 0);
    if (!page.status) {
      return { source, check: { id: source.id, store: source.store, url: source.page, allowed: true, reason: "transport", error: page.error || "unreachable" }, found: [], keepPrior: true };
    }
    if (page.status < 200 || page.status >= 300) {
      return { source, check: { id: source.id, store: source.store, url: source.page, allowed: true, reason: "http-" + page.status, offers: 0 }, found: [] };
    }
    const found = source.sourceKind === "affiliate" && /^\s*[\[{]/.test(page.body || "")
      ? parseAffiliate(page.body, now)
      : extractOffers(page.body, source, now);
    return { source, check: { id: source.id, store: source.store, url: source.page, allowed: true, reason: "ok", offers: found.length }, found };
  });
  const keepIds = new Set();
  results.forEach((result) => {
    checked.push(result.check);
    offers.push(...result.found);
    if (result.keepPrior) keepIds.add(result.source.id);
  });
  (previous && previous.offers || []).forEach((row) => {
    if (!keepIds.has(row.sourceId)) return;
    if (!stillCurrent(row, today)) return;
    if (offers.some((item) => item.sourceId === row.sourceId && item.offer === row.offer && item.code === row.code)) return;
    offers.push(row);
  });
  const codes = offers.filter((row) => row && String(row.code || "").trim() && stillCurrent(row, today));
  return {
    audience: "public",
    note: "Public promotions from official store and brand pages, and from affiliate feeds when a feed URL is configured. A code is stored only when that source prints it. Leaked and private codes are not stored. Expired offers are removed on each check.",
    updatedAt: now,
    checked,
    offers: offers.filter((row) => stillCurrent(row, today)),
    codes,
  };
}

async function main() {
  const file = path.join(root, "data", "coupons.json");
  const previous = JSON.parse(fs.readFileSync(file, "utf8"));
  const now = new Date().toISOString();
  const next = await refreshCoupons(previous, now);
  const transportOnly = next.checked.length > 0 && next.checked.every((row) => row.reason === "transport" || row.reason === "bad-url");
  if (transportOnly) {
    console.error("every source failed transport; coupons.json was left unchanged");
    process.exit(1);
  }
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  console.log(JSON.stringify({
    updatedAt: now,
    offers: next.offers.length,
    codes: next.codes.length,
    checked: next.checked.map((row) => ({ store: row.store, reason: row.reason, offers: row.offers || 0 })),
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
