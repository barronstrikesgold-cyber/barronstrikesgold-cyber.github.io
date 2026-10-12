import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hw = path.join(root, "data/hw");
const indexPath = path.join(hw, "index.json");
const current = JSON.parse(fs.readFileSync(indexPath, "utf8"));
if (!current.items) {
  process.stdout.write("index.json is already a stub\n");
  process.exit(0);
}

const byYear = new Map();
current.items.forEach((item) => {
  const year = String(item.y);
  if (!byYear.has(year)) byYear.set(year, []);
  byYear.get(year).push(item);
});

const idxDir = path.join(hw, "idx");
fs.mkdirSync(idxDir, { recursive: true });
let count = 0;
let photos = 0;
byYear.forEach((items, year) => {
  const yearFile = JSON.parse(fs.readFileSync(path.join(hw, year + ".json"), "utf8"));
  const images = new Map(yearFile.items.map((item) => [item.id, item.image || ""]));
  const rows = items.map((item) => {
    const row = { id: item.id, y: item.y, n: item.n, l: item.l || "mainline" };
    if (item.t) row.t = item.t;
    if (item.c) row.c = item.c;
    if (item.s) row.s = item.s;
    if (item.w) row.w = 1;
    if (item.v) row.v = item.v;
    const image = images.get(item.id);
    if (image) {
      row.i = image;
      photos += 1;
    }
    return row;
  });
  count += rows.length;
  fs.writeFileSync(path.join(idxDir, year + ".json"), JSON.stringify({ items: rows }));
});

fs.writeFileSync(indexPath, JSON.stringify({ chunked: true, count: count }) + "\n");
const sizes = fs.readdirSync(idxDir).map((name) => fs.statSync(path.join(idxDir, name)).size);
sizes.sort((a, b) => a - b);
process.stdout.write(
  "chunks " + byYear.size +
  " items " + count +
  " photos " + photos +
  " stub " + fs.statSync(indexPath).size +
  " median " + sizes[Math.floor(sizes.length / 2)] +
  " max " + sizes[sizes.length - 1] + "\n"
);
