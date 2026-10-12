import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const HOTLINK = new Set([
  "tcgplayer-cdn.tcgplayer.com",
  "svgs.scryfall.io",
  "cards.scryfall.io",
  "c1.scryfall.io",
  "images.scrydex.com",
  "www.lego.com",
  "store.storeimages.cdn-apple.com",
]);

function isLogo(src) {
  return /\/logo(?:\/|\?|$)/i.test(src) ||
    /(?:^|\/)logo\.(?:svg|png|jpe?g|webp)(?:\?|$)/i.test(src) ||
    /calendar-logos|_logo|logo[-_]|[-_/]logo[-_.]/i.test(src) ||
    /(?:^|\/)og\.(?:svg|png|jpe?g|webp)(?:\?|$)/i.test(src);
}

const market = JSON.parse(fs.readFileSync(path.join(root, "data/market.json"), "utf8"));
const drops = JSON.parse(fs.readFileSync(path.join(root, "data/drops.json"), "utf8"));
const audit = JSON.parse(fs.readFileSync(path.join(root, "data/calendar-image-audit.json"), "utf8"));
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const rows = [];
for (const section of market.sections || []) {
  for (const item of section.items || []) rows.push(item);
}
for (const item of drops) rows.push(item);

let placeholder = 0;
let localWebp = 0;
let localOther = 0;
let hotlink = 0;
let hosted = 0;
for (const item of rows) {
  const src = String(item.photo || "").trim();
  assert(!src || !isLogo(src), "logo photo left on " + item.id);
  if (!src) {
    placeholder += 1;
    continue;
  }
  if (/^https?:\/\//i.test(src)) {
    const host = new URL(src).hostname;
    assert(HOTLINK.has(host), "unexpected remote photo host " + host + " on " + item.id);
    hotlink += 1;
    continue;
  }
  assert(fs.existsSync(path.join(root, src)), "missing photo file " + src);
  if (src.startsWith("images/hosted/")) hosted += 1;
  else if (/\.webp$/i.test(src)) localWebp += 1;
  else localOther += 1;
  if (/^photos\/([^/]+)\.(jpe?g|png)$/i.test(src)) {
    const thumb = src.replace(/^photos\/([^/]+)\.(jpe?g|png)$/i, "photos/thumbs/$1.webp");
    assert(fs.existsSync(path.join(root, thumb)), "missing webp thumb " + thumb);
  }
}

assert(audit.failed === 0, "image audit recorded failures");
assert(audit.referer === "https://barronstrikesgold-cyber.github.io/", "audit used the github.io referer");
assert(hosted === audit.hosted, "hosted count drifted");
assert(placeholder === audit.placeholder, "placeholder count drifted");
assert(hotlink === audit.hotlinkOk, "hotlink count drifted");
assert(rows.length === audit.total, "audit total drifted");
assert(hosted + localWebp + localOther + hotlink + placeholder === rows.length, "photo buckets do not add up");
assert(app.includes("function dropPhoto") && app.includes("dropPhoto(row, false, index)") && app.includes("dropPhoto(item, true)"), "drop rows and the detail card share dropPhoto");
assert(app.includes("marketPhoto(item, false, index)") && app.includes("marketPhoto(item, true)"), "market rows and the detail card share marketPhoto");
assert(app.includes('loading="lazy"') && app.includes('referrerpolicy="no-referrer"'), "calendar images lazy-load and omit the referrer");
assert(app.includes("function placeholderThumb"), "missing photos use a category placeholder");
assert(app.includes("function categoryArt") && app.includes("is-art"), "wide placeholders are branded category art");
assert(!/img \+= ' data-src=/.test(app), "lazy images are not left without a src");

console.log("calendar images ok", { total: rows.length, hosted, localWebp, localOther, hotlink, placeholder });
