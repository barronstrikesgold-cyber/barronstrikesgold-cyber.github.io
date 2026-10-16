"use strict";

const fs = require("fs");
const path = require("path");
const D = require("../lib/stock.js");
const P = require("../lib/show-pricing.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

/* fields */
const item = D.normalize({ name: "'23 Ram 1500 Super", lane: "hot-wheels", variant: "sth", qty: 2, cost: 1.25, purchaseDate: "2026-10-15", store: "Walmart", bin: "A3", condition: "Mint card" });
assert(item.taxPct === 9.7, "default tax is 9.7% St. Louis");
assert(item.status === "in-stock", "new items start in stock");
["lane", "name", "variant", "grade", "qty", "cost", "taxPct", "purchaseDate", "store", "condition", "photo", "bin", "status", "sales"].forEach(function (k) {
  assert(k in item, "item keeps field " + k);
});
assert(D.unitCost(item) === 1.37, "unit cost includes tax: " + D.unitCost(item));
assert(D.ebayNet(100) === 82, "eBay net is sold*0.87-5");
assert(D.STATUSES.map((s) => s[0]).join() === "in-stock,listed,at-show,held-grading,sold", "status list");
assert(D.LANES.map((s) => s[0]).join() === "hot-wheels,matchbox,pokemon,funko,sneakers,lego,other", "lane list");

/* sales */
let r = D.recordSale(item, { price: 80, channel: "show", pay: "cash", date: "2026-10-18" });
assert(r.ok && item.qty === 1, "show sale decrements qty");
assert(D.saleProfit(r.sale) === 78.63, "show profit is price minus cost: " + D.saleProfit(r.sale));
r = D.recordSale(item, { price: 5, qty: 3 });
assert(!r.ok, "cannot sell more than on hand");
r = D.recordSale(item, { price: 100, channel: "ebay", date: "2026-10-18" });
assert(r.ok && item.qty === 0 && item.status === "sold", "last unit marks sold");
assert(D.saleNet(r.sale) === 82, "eBay sale books at net");
assert(D.undoSale(item, r.sale.id) && item.qty === 1 && item.status !== "sold", "undo puts the unit back");

const other = D.normalize({ name: "No cost thing", qty: 3 });
const t = D.totals([item, other], function (i) { return i === item ? { value: 80 } : null; });
assert(t.units === 4 && t.costBasis === 1.37 && t.costUnknown === 3 && t.estValue === 80 && t.unvalued === 3, "totals: " + JSON.stringify(t));
assert(t.realized === 78.63, "realized profit");
const day = D.dailySummary([item], "2026-10-18", "show");
assert(day.count === 1 && day.cash === 80 && day.card === 0 && day.profit === 78.63, "daily show summary");

/* csv round trip */
const csv = D.toCsv([item, other]);
const back = D.fromCsv(csv);
assert(back.ok && back.items.length === 2, "CSV import reads rows back");
assert(back.items[0].name === item.name && back.items[0].sales.length === 1 && back.items[0].bin === "A3", "CSV keeps sales and bin");
assert(D.fromCsv('name,qty\n"Comma, name",2\n').items[0].name === "Comma, name", "CSV handles quoted commas");

/* shopify csv */
const shop = D.toShopifyCsv([D.normalize({ name: "Pokémon 30th ETB", lane: "pokemon", variant: "sealed", qty: 2, cost: 69.99, photo: "photos/etb.jpg" }), D.normalize({ name: "Gone", qty: 0, status: "sold" })], function () { return 140; });
const rows = D.parseCsv(shop);
const head = rows[0];
["Handle", "Title", "Vendor", "Product Type", "Tags", "Variant SKU", "Variant Price", "Variant Inventory Qty", "Cost per item", "Image Src"].forEach(function (col) {
  assert(head.indexOf(col) !== -1, "Shopify CSV has " + col);
});
assert(rows.length === 2, "sold-out rows are not exported to Shopify");
const row = {};
head.forEach((h, i) => { row[h] = rows[1][i]; });
assert(row["Variant Inventory Qty"] === "2" && row["Variant Price"] === "140.00" && row["Cost per item"] === "76.78", "Shopify row values " + JSON.stringify(row));
assert(row["Image Src"] === "https://barronstrikesgold-cyber.github.io/photos/etb.jpg", "Shopify image is a public URL");
assert(row.Status === "draft" && row.Published === "FALSE", "Shopify import lands as drafts");
const noPrice = D.parseCsv(D.toShopifyCsv([D.normalize({ name: "X", qty: 1, photo: "data:image/jpeg;base64,AAA" })], function () { return null; }));
assert(noPrice[1][head.indexOf("Variant Price")] === "" && noPrice[1][head.indexOf("Image Src")] === "", "no invented price, no data-URL images");

/* adapters */
["list", "put", "bulkPut", "remove", "getMeta", "setMeta", "clear"].forEach(function (m) {
  assert(typeof D.memoryAdapter()[m] === "function", "memory adapter has " + m);
  assert(typeof D.shopifyAdapter({})[m] === "function", "shopify adapter stub has " + m);
});

/* pricing agent */
const none = P.suggest(null, 1.37, { lane: "hot-wheels" });
assert(none.hasComp === false && none.market === null && none.ticket === null && none.ebayNet === null, "no comp means no invented price");
assert(none.notes.join(" ").indexOf("No verified comp") !== -1, "says No verified comp");
const etb = P.suggest({ value: 163.21, source: "TCGplayer", date: "2026-10-11" }, 76.78);
assert(etb.ebayNet === 136.99 && etb.ticket === 140 && etb.floor === 130, "ETB show pricing " + JSON.stringify(etb));
assert(etb.ticket < etb.market && etb.ticket >= etb.market * 0.8, "ticket sits ~10-15% under market");
assert(etb.source === "TCGplayer" && etb.date === "2026-10-11", "pricing keeps source and date");
const under = P.suggest({ value: 10 }, 12);
assert(under.floor >= 12 * 1.15 && under.ticket >= under.floor, "floor never below cost + margin");
const common = P.suggest({ value: 2 }, 1.37);
assert(common.lot && common.lot.qty === 3 && common.lot.price === 5, "commons lot 3 for $5");

const market = JSON.parse(read("data/market.json"));
const catalog = JSON.parse(read("data/catalog.json"));
const cat = [];
Object.keys(catalog).forEach((k) => catalog[k].forEach((i) => { i.category = i.category || k; cat.push(i); }));
const comps = P.buildComps({ market: market, catalog: cat });
assert(comps.length > 100, "comps build from market + catalog");
comps.forEach(function (c) {
  if (c.value != null) assert(c.source, c.name + " has a value with no source");
  else assert(c.kind === "none", c.name + " has no value and must say so");
});

/* app wiring */
const app = read("app.js");
const html = read("index.html");
const sw = read("sw.js");
assert(app.includes('["tracker", "Tracker"]') && app.includes('["show", "Show Mode"]'), "My Stuff has Tracker and Show Mode");
["lib/stock.js", "lib/show-pricing.js", "lib/stock-ui.js"].forEach(function (f) {
  assert(html.includes(f), "index.html loads " + f);
  assert(sw.includes("./" + f), "service worker caches " + f + " for offline shows");
});
assert(app.includes("scanFor: scanForStock"), "Scan feeds the tracker");
console.log("stock.test.js OK");
