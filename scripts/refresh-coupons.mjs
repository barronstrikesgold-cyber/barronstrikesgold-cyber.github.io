// Refresh owner-only promo offers from official pages.
// Live code strings are never written. REQUIREMENTS.md keeps them out of this public repo.
// A page is fetched only when that site's robots.txt allows it.
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = "HuntCoupons/1.0 (+https://barronstrikesgold-cyber.github.io/; official promo check)";

export const STORES = [
  { id: "mattel", store: "Mattel Creations", page: "https://creations.mattel.com/" },
  { id: "target", store: "Target", page: "https://www.target.com/c/top-deals/-/N-4xw74" },
  { id: "walmart", store: "Walmart", page: "https://www.walmart.com/shop/deals" },
  { id: "amazon", store: "Amazon", page: "https://www.amazon.com/deals" },
  { id: "gamestop", store: "GameStop", page: "https://www.gamestop.com/deals" },
  { id: "bestbuy", store: "Best Buy", page: "https://www.bestbuy.com/site/top-deals/pcmcat1563299782894.c?id=pcmcat1563299782894" },
  { id: "pokemon", store: "Pokémon Center", page: "https://www.pokemoncenter.com/" },
  { id: "lego", store: "LEGO", page: "https://www.lego.com/en-us/categories/deals" },
  { id: "nike", store: "Nike", page: "https://www.nike.com/w/sale-3yaep" },
  { id: "footlocker", store: "Foot Locker", page: "https://www.footlocker.com/category/sale.html" },
  { id: "nordstrom", store: "Nordstrom", page: "https://www.nordstrom.com/browse/sale" },
  { id: "saks", store: "Saks", page: "https://www.saksfifthavenue.com/c/sale" },
];

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

export function redactCodes(text) {
  return String(text || "")
    .replace(/\b(?:promo|coupon|use)\s+codes?\s*[:#-]?\s*[A-Z0-9][A-Z0-9-]{3,}\b/gi, "a code on the source page")
    .replace(/\bcode\s*[:#]\s*[A-Z0-9][A-Z0-9-]{3,}\b/gi, "a code on the source page");
}

function plainText(html) {
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

function findExpiry(windowText, now) {
  const iso = windowText.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const named = windowText.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}\b/i);
  if (named) {
    const parsed = new Date(named[0]);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return addDays(now, 2);
}

export function extractOffers(html, source, now) {
  const text = plainText(html);
  const re = /\b(\d{1,2}\s*%\s*off|\$\d[\d,]*\s*off)\b/gi;
  const offers = [];
  const seen = new Set();
  let match;
  while ((match = re.exec(text)) && offers.length < 3) {
    const discount = match[0].replace(/\s+/g, " ");
    const key = discount.toLowerCase();
    if (seen.has(key)) continue;
    const at = match.index;
    const windowText = text.slice(Math.max(0, at - 50), Math.min(text.length, at + 90));
    const redacted = redactCodes(windowText).replace(/\s+/g, " ").trim();
    if (redacted.length < 6) continue;
    seen.add(key);
    const label = redacted.length <= 90 ? redacted : source.store + " · " + discount;
    offers.push({
      id: source.id + "-" + (offers.length + 1),
      store: source.store,
      label: label,
      discount: discount,
      sourceUrl: source.page,
      expires: findExpiry(windowText, now),
      lastChecked: now,
      active: true,
    });
  }
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
      headers: { "User-Agent": UA, Accept: "text/html,application/json;q=0.8,*/*;q=0.5" },
      timeout: 20000,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => {
        if (chunks.reduce((sum, part) => sum + part.length, 0) < 800000) chunks.push(chunk);
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

export async function refreshCoupons(previous, now, fetcher) {
  const get = fetcher || request;
  const offers = [];
  const checked = [];
  const sources = STORES.slice();
  if (process.env.COUPON_FEED_URL) {
    sources.push({ id: "affiliate", store: "Affiliate feed", page: process.env.COUPON_FEED_URL });
  }
  for (const source of sources) {
    let host = "";
    let targetPath = "/";
    try {
      const parsed = new URL(source.page);
      host = parsed.hostname;
      targetPath = parsed.pathname || "/";
    } catch (err) {
      checked.push({ store: source.store, url: source.page, allowed: false, reason: "bad-url" });
      continue;
    }
    const robots = await get("https://" + host + "/robots.txt", 0);
    const allowed = robotsAllows(robots.body || "", robots.status, targetPath);
    if (!allowed) {
      checked.push({
        store: source.store,
        url: source.page,
        allowed: false,
        reason: robots.status === 200 ? "robots" : "robots-unreadable",
        status: robots.status,
      });
      continue;
    }
    const page = await get(source.page, 0);
    if (page.status < 200 || page.status >= 300) {
      checked.push({ store: source.store, url: source.page, allowed: true, reason: "http-" + (page.status || page.error || "bad"), offers: 0 });
      continue;
    }
    const found = extractOffers(page.body, source, now);
    offers.push(...found);
    checked.push({ store: source.store, url: source.page, allowed: true, reason: "ok", offers: found.length });
  }
  const priorCodes = (previous && previous.codes) || [];
  return {
    audience: "owner",
    note: "Live coupon codes are not stored in this public repository. Offers link to the official page. Code strings found on a page are redacted before anything is written.",
    updatedAt: now,
    checked,
    offers,
    codes: priorCodes,
  };
}

async function main() {
  const file = path.join(root, "data", "coupons.json");
  const previous = JSON.parse(fs.readFileSync(file, "utf8"));
  const now = new Date().toISOString();
  const next = await refreshCoupons(previous, now);
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  const active = next.offers.filter((row) => row && row.active !== false && row.expires >= now.slice(0, 10) && !row.code);
  console.log(JSON.stringify({ updatedAt: now, activeOffers: active.length, checked: next.checked }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
