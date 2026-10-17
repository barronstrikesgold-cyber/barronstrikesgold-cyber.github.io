/* Build data/hw/cases-<year>.json: which Hot Wheels mainline cars ship in which case mix (A-Q, no I/O).
 * Source: Orange Track Diecast "Hot Wheels Basics <year> "<X>" case contents checklist for mainline" posts
 * (collector number, model, color, series, TH/STH, store exclusive), joined to Hunt's HW catalog
 * (data/hw/<year>.json, from the Hot Wheels Wiki: toy #, photo, TH/STH variation) by collector number.
 * Nothing is guessed: a car whose collector number has several catalog colors keeps every candidate toy #
 * and says the color is unconfirmed; a missing case stays missing. Quantities per case are not published.
 * Usage: node scripts/build-hw-cases.mjs [year]   (network) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q"];
const UA = "Mozilla/5.0 (compatible; HuntCaseBuilder/1.0; +https://barronstrikesgold-cyber.github.io/)";

function decode(s) {
  return String(s || "")
    .replace(/&#8217;|&#8216;|&rsquo;|&lsquo;/g, "'").replace(/&#8220;|&#8221;|&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/&#8211;|&#8212;/g, "-").replace(/&nbsp;|&#160;/g, " ").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)));
}

function norm(s) {
  return decode(s).toUpperCase().replace(/[’']/g, "").replace(/[^A-Z0-9]+/g, " ").trim();
}

/* one checklist post -> rows */
export function parseChecklist(html) {
  const rows = [];
  let section = "";
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>|<p[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] != null) { section = norm(m[1].replace(/<[^>]+>/g, "")); continue; }
    const p = m[2];
    const head = /^\s*(\d{3})\s*(?:•|&#8226;|·)\s*([\s\S]*?)<br\s*\/?>/i.exec(p);
    if (!head) continue;
    const parts = p.split(/<br\s*\/?>/i).map((x) => decode(x.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim());
    const detail = (parts[1] || "").split(/\s*•\s*/);
    const tagText = parts.slice(2).join(" ").toUpperCase();
    const tag = /SUPER TREASURE HUNT/.test(tagText) ? "STH" : /TREASURE HUNT/.test(tagText) ? "TH" : "";
    const store = /STORE EXCLUSIVE/.test(section) ? (parts.slice(2).join(" ").replace(/EXCLUSIVE/i, "").trim() || "store exclusive") : "";
    rows.push({
      col: head[1],
      name: decode(head[2].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(),
      color: detail[0] || "",
      series: (detail[1] || "").replace(/^HW (Screen Time)$/i, "$1"),
      tag,
      isNew: /NEW MODELS?/.test(tagText),
      store,
    });
  }
  return rows;
}

function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s'(-])([a-z])/g, (a, b, c) => b + c.toUpperCase());
}

/* join checklist rows to the catalog by collector number (and TH/STH) */
export function joinCase(rows, catalog) {
  const byCol = {};
  catalog.forEach((it) => { (byCol[it.col] = byCol[it.col] || []).push(it); });
  return rows.map((r) => {
    const all = byCol[r.col] || [];
    const wantTag = r.tag === "STH" ? /super treasure hunt/i : r.tag === "TH" ? /^treasure hunt$/i : null;
    let cands = all.filter((it) => (wantTag ? wantTag.test(it.variation || "") : !/treasure hunt/i.test(it.variation || "")));
    const named = cands.filter((it) => norm(it.name).split(" ").some((w) => w.length > 2 && norm(r.name).includes(w)));
    if (named.length) cands = named;
    const one = cands.length === 1 ? cands[0] : null;
    return {
      col: r.col,
      name: one ? one.name : cands[0] ? cands[0].name : titleCase(r.name),
      color: r.color,
      series: r.series,
      tag: r.tag,
      isNew: r.isNew || undefined,
      store: r.store || undefined,
      toy: one ? one.toy : null,
      toys: one ? undefined : cands.map((c) => c.toy).filter(Boolean),
      image: one ? one.image || "" : (cands[0] && cands[0].image) || "",
      colorConfirmed: !!one,
      worth: one && one.worth && one.worth.id ? one.worth.id : undefined,
    };
  });
}

/* card codes read off real cards (toy # - suffix ending in the case letter); owner's cards, 2026-10-17 */
export const CARD_CODES = { "JJK58-N9C0N": "N", "JJL74-N9C0P": "P" };

/* pin a toy # to a case from a real card, then settle the casting's other case by elimination
 * (only when the catalog has exactly two colors of that collector number) */
export function applyCardCodes(cases, catalog, codes) {
  const byToy = {};
  catalog.forEach((it) => { byToy[it.toy] = it; });
  const pin = (car, toy, basis) => {
    const it = byToy[toy];
    car.toy = toy;
    delete car.toys;
    car.colorConfirmed = true;
    car.basis = basis;
    if (it && it.image) car.image = it.image;
    if (it && it.worth && it.worth.id) car.worth = it.worth.id;
  };
  Object.keys(codes).forEach((code) => {
    const toy = code.split("-")[0];
    const L = codes[code];
    const c = cases[L];
    if (!c || !c.cars) return;
    const car = c.cars.find((x) => x.toy === toy || (x.toys || []).includes(toy));
    if (!car) return;
    const others = (car.toys || []).filter((t) => t !== toy);
    pin(car, toy, "card " + code);
    if (others.length !== 1) return;
    Object.keys(cases).forEach((K) => {
      if (K === L || !cases[K].cars) return;
      cases[K].cars.forEach((x) => {
        if (x.col === car.col && !x.tag && (x.toys || []).length === 2 && x.toys.includes(toy) && x.toys.includes(others[0])) pin(x, others[0], "the other color of " + car.col + " (card " + code + " pins " + toy + " to case " + L + ")");
      });
    });
  });
  return cases;
}

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(url + " -> " + res.status);
  return res.text();
}

async function findPosts(year) {
  const urls = {};
  for (const page of [1, 2, 3]) {
    const html = await get("https://orangetrackdiecast.com/" + (page > 1 ? "page/" + page + "/" : "") + "?s=" + encodeURIComponent(year + " case contents checklist mainline")).catch(() => "");
    const re = new RegExp("https://orangetrackdiecast\\.com/\\d{4}/\\d{2}/\\d{2}/hot-wheels-basics-" + year + "-([a-z])-case-contents-checklist-for-mainline/", "g");
    let m;
    while ((m = re.exec(html))) urls[m[1].toUpperCase()] = m[0];
  }
  return urls;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const year = Number(process.argv[2] || 2026);
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/hw/" + year + ".json"), "utf8")).items.filter((it) => ["mainline", "th", "sth"].includes(it.line) && /^\d{3}$/.test(it.col || ""));
  const posts = await findPosts(year);
  const cases = {};
  for (const L of LETTERS) {
    if (!posts[L]) { cases[L] = { status: "unknown", note: "No published checklist found for this case yet." }; continue; }
    const rows = parseChecklist(await get(posts[L]));
    const cars = joinCase(rows, catalog);
    cases[L] = {
      status: cars.length ? "listed" : "unknown",
      source: posts[L],
      sth: cars.filter((c) => c.tag === "STH").map((c) => c.name),
      th: cars.filter((c) => c.tag === "TH").map((c) => c.name),
      cars,
    };
    console.log(year, L, cars.length, "cars; STH:", cases[L].sth.join(", "), "TH:", cases[L].th.join(", "));
  }
  if (year === 2026) applyCardCodes(cases, catalog, CARD_CODES);
  const out = {
    year,
    note: "Case mix -> cars. Mainline 72-car cases: US long card L2593, international long card C4982, short card 5785; the last letter of the mix code on the box (e.g. L2593-973N, C4982-99NL) is the case letter, and the same letter ends the code after the toy # on a card (JJK58-N9C0N = case N). Cars per case from Orange Track Diecast checklists (source per case), toy # and photos from the Hot Wheels Wiki via Hunt's catalog. Quantities per case are not published by Mattel. A checklist is a guide: a case can hold all or some of these cars; TH/STH are random inserts.",
    assortments: { L2593: "US long card (mainline, 72 cars)", C4982: "International long card (mainline, 72 cars)", "5785": "Short card (mainline)" },
    cases,
  };
  fs.writeFileSync(path.join(root, "data/hw/cases-" + year + ".json"), JSON.stringify(out) + "\n");
}
