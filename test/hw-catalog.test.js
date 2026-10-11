"use strict";

const fs = require("fs");
const path = require("path");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

async function main() {
  const { parseWikiPage, toyOf, lineOf, preprocessWiki } = await import("../scripts/build-hw-catalog.mjs");
  const sample = [
    "==HW City==",
    "{| class=\"wikitable\"",
    "! Toy #",
    "! Col.#",
    "! Model Name",
    "! Series",
    "! Photo",
    "|-",
    "|CFH27",
    "|001",
    "|[[Speed Dozer]]",
    "|HW City Works<br>{{TH|2015}}",
    "|[[File:SpeedDozer.jpg|75px]]",
    "|}",
    "==Club==",
    "<gallery>",
    "Image:Carabo.jpg|[[Carabo]]|link=Carabo",
    "File:Poster.jpg|Redline Era Wallpaper",
    "</gallery>",
  ].join("\n");
  const rows = parseWikiPage(sample, { year: 2015, pageTitle: "List of 2015 Hot Wheels" });
  assert(rows.length === 2, "parser keeps the table row and the gallery car");
  assert(rows[0].toy === "CFH27" && rows[0].line === "th" && rows[0].file === "SpeedDozer.jpg", "treasure hunt marker and file");
  assert(rows[1].name === "Carabo" && rows[1].file === "Carabo.jpg", "gallery car");
  assert(!rows.some((row) => /wallpaper/i.test(row.name)), "gallery wallpaper is not a car");
  const expanded = preprocessWiki("{{List00Green|16675|578|[['56 Flashsider]]|1997 Treasure Hunts|01/12|}}\n|[[File:Flash.jpg|75px]]");
  const templated = parseWikiPage("{|\n! Toy #\n! Col. #\n! Model Name\n! Series\n! Series #\n! Photo\n" + expanded + "\n|}", {
    year: 1997,
    pageTitle: "List of 1997 Hot Wheels",
  });
  assert(templated.length === 1 && templated[0].toy === "16675" && templated[0].name === "'56 Flashsider", "list template row");
  assert(templated[0].file === "Flash.jpg" && templated[0].line === "th", "template photo and treasure hunt line");
  assert(toyOf("14908 / 2015") === "14908", "first toy number");
  assert(lineOf(1969, "Custom Cougar") === "redline", "redline era");

  const root = path.join(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/hw/manifest.json"), "utf8"));
  const index = JSON.parse(fs.readFileSync(path.join(root, "data/hw/index.json"), "utf8"));
  const cards = require(path.join(root, "lib/resale-cards.js"));
  assert(manifest.years.length >= 59, "1968 through 2026 are in the manifest");
  const years = new Set(manifest.years.map((row) => row.year));
  for (let year = 1968; year <= 2026; year++) assert(years.has(year), "missing year " + year);
  let count = 0;
  let photos = 0;
  let mattel = 0;
  let worth = 0;
  manifest.years.forEach((row) => {
    const file = JSON.parse(fs.readFileSync(path.join(root, row.file), "utf8"));
    assert(file.year === row.year, "year file matches " + row.year);
    assert(file.items.length === row.count, "count matches " + row.year);
    if (row.year >= 2015 && row.year <= 2026) assert(row.count >= 400, row.year + " has the mainline book");
    if (row.year >= 2000 && row.year <= 2014) assert(row.count >= 200, row.year + " has a full list");
    if (row.year === 1968) assert(row.count >= 16, "1968 sweet sixteen");
    if (row.year === 1972) assert(row.count >= 7, "1972 wiki list");
    file.items.forEach((item) => {
      count += 1;
      assert(item.id && item.name && item.year === row.year, "item identity " + item.id);
      assert(!item.image || /^https:\/\//.test(item.image), "hotlinked image " + item.id);
      assert(!String(item.image || "").includes("/photos/"), "catalog does not use bundled hunt photos");
      if (item.image) photos += 1;
      if (item.imageSource === "mattel") {
        mattel += 1;
        assert(item.imageCredit === "Mattel Creations", "mattel credit");
        assert(/creations\.mattel\.com\/products\//.test(item.imagePage), "mattel product link");
        assert(/cdn\.shopify\.com/.test(item.image), "mattel cdn");
      }
      if (item.imageSource === "wiki") {
        assert(item.imageCredit === "Hot Wheels Wiki", "wiki credit");
        assert(/hotwheels\.fandom\.com/.test(item.imagePage + item.wiki), "wiki link");
      }
      if (item.worth) {
        worth += 1;
        assert(cards[item.worth.id], "worth id is on the hunt list " + item.worth.id);
      }
    });
  });
  assert(count === manifest.totals.count, "total count");
  assert(photos === manifest.totals.photos, "photo count");
  assert(mattel === manifest.totals.mattel, "mattel count");
  assert(index.items.length === count, "search index covers every car");
  assert(manifest.totals.photoPct >= 70, "photo coverage stays high");
  assert(mattel >= 50, "official Mattel photos are matched");
  assert(worth >= 40, "hunt list cars are flagged in the catalog");
  const shell = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert(!shell.includes("data/hw/"), "year files stay out of the precache");
  assert(fs.readFileSync(path.join(root, "app.js"), "utf8").includes('data-tab="archive"') || fs.readFileSync(path.join(root, "index.html"), "utf8").includes('data-tab="archive"'), "catalog tab");
  console.log("hw-catalog.test.js OK", count, "photos", manifest.totals.photoPct + "%", "mattel", manifest.totals.mattelPct + "%", "worth", worth);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
