/* Build Hunt's own barcode / Mattel-code index: data/upc/codes-<shard>.json + manifest.json.
 * Sources: HW catalog chunks (data/hw/idx, toy numbers like JJK58), data/catalog.json, data/market.json, data/drops.json.
 * Any upc / barcode / ean / gtin / sku / code / toy / toyNo field is indexed. The scanner loads one shard per scan. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "data/upc");
const FIELDS = ["upc", "barcode", "ean", "gtin", "sku", "code", "toy", "toyNo", "t"];
const LISTS = ["upcs", "barcodes", "codes"];

function read(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function gtinCheck(body) {
  let sum = 0;
  for (let i = body.length - 1, k = 0; i >= 0; i--, k++) sum += (body.charCodeAt(i) - 48) * (k % 2 === 0 ? 3 : 1);
  return String((10 - (sum % 10)) % 10);
}

export function keyOf(raw) {
  const s = String(raw == null ? "" : raw).trim().toUpperCase().replace(/[\s-]/g, "");
  if (!s || s === "—" || s === "–" || s.length < 4 || s.length > 48) return null;
  if (/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(s) && gtinCheck(s.slice(0, -1)) === s.slice(-1)) {
    let g = s.padStart(14, "0");
    if (g.startsWith("00")) return g.slice(2);
    if (g.startsWith("0")) return g.slice(1);
    return g;
  }
  const m = /^([A-Z]{3}\d{2})[A-Z0-9]{4,6}$/.exec(s);
  if (m && /^[A-Z]{3}\d{2}-/.test(String(raw).toUpperCase())) return m[1];
  return s;
}

function codesOf(item) {
  const list = [];
  FIELDS.forEach((k) => { if (item && item[k] != null && typeof item[k] !== "object") list.push(item[k]); });
  if (item && item.resale) ["toyNo", "upc", "code"].forEach((k) => { if (item.resale[k]) list.push(item.resale[k]); });
  LISTS.forEach((k) => { if (item && Array.isArray(item[k])) item[k].forEach((v) => list.push(v)); });
  const keys = [];
  list.forEach((v) => { const k = keyOf(v); if (k && !keys.includes(k)) keys.push(k); });
  return keys;
}

function laneOf(category, name) {
  const c = String(category || "").toLowerCase();
  if (/matchbox/i.test(name || "") || c === "matchbox") return "matchbox";
  if (c === "cars" || c === "hot-wheels" || /hot wheels/i.test(name || "")) return "hot-wheels";
  if (c === "pokemon") return "pokemon";
  if (c === "funko") return "funko";
  if (c === "lego") return "lego";
  if (c === "sneakers") return "sneakers";
  return "other";
}

export function buildIndex() {
  const codes = new Map();
  const counts = { hw: 0, catalog: 0, market: 0, drops: 0 };
  function add(key, row, source) {
    if (!codes.has(key)) codes.set(key, []);
    const list = codes.get(key);
    const id = row.length === 4 ? "hw:" + row[1] + ":" + row[0] + ":" + row[2] + ":" + row[3] : row[0];
    if (list.some((r) => (r.length === 4 ? "hw:" + r[1] + ":" + r[0] + ":" + r[2] + ":" + r[3] : r[0]) === id)) return;
    list.push(row);
    counts[source] += 1;
  }
  const idxDir = path.join(root, "data/hw/idx");
  fs.readdirSync(idxDir).filter((f) => f.endsWith(".json")).sort().forEach((file) => {
    const part = JSON.parse(fs.readFileSync(path.join(idxDir, file), "utf8"));
    (part.items || []).forEach((it) => {
      const m = /^assets\/hw\/thumbs\/([0-9a-f]{2})\/(\1[0-9a-f]{18})\.webp$/.exec(it.i || "");
      /* compact HW row: [name, year, line, thumb hash or URL] */
      codesOf(it).forEach((key) => add(key, [it.n, it.y || "", it.l || "mainline", m ? m[2] : it.i || ""], "hw"));
    });
  });
  const catalog = read("data/catalog.json");
  Object.keys(catalog).forEach((cat) => {
    (Array.isArray(catalog[cat]) ? catalog[cat] : []).forEach((item) => {
      codesOf(item).forEach((key) => add(key, ["c:" + item.id, item.name, "", cat, item.photoMatched && item.photo ? item.photo : "", laneOf(cat, item.name), "catalog"], "catalog"));
    });
  });
  const market = read("data/market.json");
  (market.sections || []).forEach((section) => {
    (section.items || []).forEach((item) => {
      codesOf(item).forEach((key) => add(key, ["m:" + item.id, item.name, "", section.title || section.id, item.photo || "", laneOf(section.id, item.name), "market"], "market"));
    });
  });
  const drops = read("data/drops.json");
  const dropList = Array.isArray(drops) ? drops : drops.drops || drops.items || [];
  (Array.isArray(dropList) ? dropList : []).forEach((item) => {
    codesOf(item).forEach((key) => add(key, ["d:" + (item.id || item.name), item.name || item.title || "", "", "drop", item.photo || item.image || "", laneOf(item.category || item.lane, item.name), "drops"], "drops"));
  });
  return { codes, counts };
}

/* Six shards by first character, each about 50 KB gzipped. A scan loads one or two. Keep in sync with lib/upc-lookup.js. */
export function shardOf(key) {
  const c = String(key || "").charAt(0).toUpperCase();
  if (/[0-9]/.test(c)) return "0";
  if (/[A-F]/.test(c)) return "A";
  if (c === "G" || c === "H" || c === "J") return c;
  if (/[I-Z]/.test(c)) return "K";
  return "_";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { codes, counts } = buildIndex();
  const shards = {};
  [...codes.keys()].sort().forEach((key) => {
    const s = shardOf(key);
    if (!shards[s]) shards[s] = {};
    shards[s][key] = codes.get(key);
  });
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  Object.keys(shards).sort().forEach((s) => {
    fs.writeFileSync(path.join(out, "codes-" + s + ".json"), JSON.stringify({ codes: shards[s] }) + "\n");
  });
  const manifest = {
    note: "Hunt's own code index. HW rows = [name, year, line, thumb] where a 20-hex thumb means assets/hw/thumbs/<first 2>/<hash>.webp. Other rows = [id, name, year, section, photo, lane, source]. Keys are uppercased with spaces and dashes removed; retail barcodes are stored as 12-digit UPC-A when they start with 0, Mattel card-back codes as the 5-character toy number.",
    keys: codes.size,
    rows: Object.values(counts).reduce((a, b) => a + b, 0),
    counts,
    shards: Object.keys(shards).sort(),
  };
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify(manifest));
}
