#!/usr/bin/env node
/* Builds data/market-history.json: every dated sold comp and sales-based guide value Hunt has published, per comp id
 * ("m:<market id>", "c:<catalog id>", the same ids lib/show-pricing.js uses). It only records values that were in
 * data/market.json or data/catalog.json; nothing is estimated. Run after each market refresh so history accumulates.
 *   node scripts/build-market-history.mjs            append today's values
 *   node scripts/build-market-history.mjs --from-git also replay every past commit of those files (first run) */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "data/market-history.json");
const V = (await import(path.join(root, "lib/valuation.js"))).default;

function num(v) { return V.num(v); }

function observations(market, catalog, observed) {
  const rows = [];
  for (const section of (market && market.sections) || []) {
    for (const item of section.items || []) {
      const sold = num(item.sold);
      if (sold == null) continue;
      rows.push({ id: "m:" + item.id, price: sold, date: item.soldDate || observed, source: item.soldSource || "", url: item.soldUrl || "", kind: V.parseGuide(item.soldSource) ? "guide" : "sold", observed });
    }
  }
  for (const list of Object.values(catalog || {})) {
    for (const item of Array.isArray(list) ? list : []) {
      const r = item.resale || {};
      let value = num(r.soldValue), source = r.soldSource || "", date = r.soldDate || "", url = r.soldUrl || "";
      if (value == null && num(item.soldNum) != null) { value = num(item.soldNum); source = [item.source, item.checkedNote].filter(Boolean).join(". "); date = item.date || ""; url = ""; }
      if (value == null) continue;
      rows.push({ id: "c:" + item.id, price: value, date: date || observed, source, url, kind: /guide/i.test(source) || V.parseGuide(source) ? "guide" : "sold", observed });
    }
  }
  return rows;
}

/* A guide value with only a month ("Oct 2026") is dated by the day it was observed, so repeated guide snapshots form a series. */
function add(series, row) {
  const d = V.parseDate(row.date);
  let date = d ? d.date : row.observed;
  if (d && d.approx && row.kind === "guide") date = row.observed;
  const list = series[row.id] || (series[row.id] = []);
  const prev = list[list.length - 1];
  if (prev && prev.price === row.price && (prev.date === date || (row.kind === "guide" && prev.source === row.source))) return;
  if (list.some((p) => p.date === date && p.price === row.price)) return;
  list.push({ date, price: row.price, kind: row.kind, source: String(row.source).slice(0, 160), url: /^https:\/\//.test(row.url) ? row.url : "" });
  list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

const history = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : { series: {} };
const series = history.series || {};

if (process.argv.includes("--from-git")) {
  const log = execFileSync("git", ["log", "--reverse", "--format=%H %cI", "--", "data/market.json", "data/catalog.json"], { cwd: root, encoding: "utf8" }).trim().split("\n").filter(Boolean);
  for (const line of log) {
    const [sha, when] = line.split(" ");
    const read = (p) => { try { return JSON.parse(execFileSync("git", ["show", sha + ":" + p], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] })); } catch { return null; } };
    for (const row of observations(read("data/market.json"), read("data/catalog.json"), when.slice(0, 10))) add(series, row);
  }
}

const today = new Date().toISOString().slice(0, 10);
const market = JSON.parse(fs.readFileSync(path.join(root, "data/market.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/catalog.json"), "utf8"));
for (const row of observations(market, catalog, today)) add(series, row);

const ids = Object.keys(series).sort();
const sorted = {};
for (const id of ids) sorted[id] = series[id];
const doc = {
  generatedAt: new Date().toISOString(),
  note: "Dated sold comps and sales-based guide values exactly as published in data/market.json and data/catalog.json over time. Nothing estimated. Used for trend and projection; thin series say 'not enough data'.",
  series: sorted,
};
fs.writeFileSync(out, JSON.stringify(doc) + "\n");
const counts = ids.map((id) => sorted[id].length);
console.log("market history:", ids.length, "series,", counts.reduce((a, b) => a + b, 0), "points, longest", Math.max(0, ...counts), "≥5 points:", counts.filter((c) => c >= 5).length);
