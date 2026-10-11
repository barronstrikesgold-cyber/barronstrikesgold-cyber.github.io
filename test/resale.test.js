"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Rules = require("../lib/rules.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/catalog.json"), "utf8"));
const items = Object.keys(catalog).flatMap((key) => catalog[key]);
const resale = items.filter((item) => item.resale && item.resale.id);
assert(resale.length === 87, "87 resale rows, saw " + resale.length);

const lines = {};
const verdicts = {};
const hwIds = new Set();
resale.forEach((item) => {
  const row = item.resale;
  lines[row.line] = (lines[row.line] || 0) + 1;
  verdicts[row.verdict] = (verdicts[row.verdict] || 0) + 1;
  assert(!hwIds.has(row.id), "duplicate resale id " + row.id);
  hwIds.add(row.id);
  assert(row.howToSpot, item.id + " has how to spot");
  assert(row.verdict === "BUY" || row.verdict === "CHECK" || row.verdict === "LOT ONLY", item.id + " verdict");
  assert(item.photoMatched === true && item.photo && item.photo.endsWith(".jpg"), item.id + " photo");
  const file = path.join(root, item.photo);
  const bytes = fs.readFileSync(file);
  assert(bytes[0] === 0xff && bytes[1] === 0xd8, item.photo + " jpeg");
  const rule = Rules.cardRule(item.id);
  assert(rule && rule.resaleId === row.id, item.id + " card matches " + row.id);
  assert(Rules.laneFor(item) === row.lane, item.id + " lane");
  if (typeof row.soldValue === "number") {
    const net = Math.round((row.soldValue * 0.87 - 5) * 100) / 100;
    assert(Math.abs(row.net - net) < 0.02, item.id + " net " + row.net + " vs " + net);
    assert(Rules.moneyOf(item).net === "$" + Number(row.net).toFixed(2), item.id + " money net");
    assert(Rules.priceLine(item).indexOf("Last sold") === 0, item.id + " last sold line");
  } else {
    assert(row.verdict === "CHECK", item.id + " missing sold is CHECK");
    assert(Rules.priceLine({ id: item.id }) === "No sold data", item.id + " does not invent a sold");
    assert(row.soldSource, item.id + " still names the source");
  }
});

const expected = {
  "th-sth": 20,
  premium: 19,
  "premium-chase": 13,
  exclusive: 10,
  "matchbox-super-chase": 8,
  multipack: 8,
  mainline: 5,
  "ff-chase": 4,
};
Object.keys(expected).forEach((line) => {
  assert(lines[line] === expected[line], line + " count " + lines[line]);
});
assert(verdicts.BUY === 29 && verdicts.CHECK === 26 && verdicts["LOT ONLY"] === 32, "verdict counts " + JSON.stringify(verdicts));

const kept = ["cuda", "firebird", "f40", "civic", "lotus", "mustang", "impala", "porsche", "subaru", "drift", "sierra", "otto", "supra-tooned", "maxima", "ram", "belair", "datsun", "mb-integra", "mb-911", "mb-jag", "mb-bronco", "mb-gtr", "skyline"];
kept.forEach((id) => {
  const item = items.find((row) => row.id === id);
  assert(item && item.photo === "photos/" + id + ".jpg", id + " keeps the existing package photo");
});

function hash(rel) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, rel))).digest("hex");
}
assert(hash("photos/ff-supra.jpg") !== hash("photos/cuda.jpg"), "ff supra package photo is its own file");
assert(hash("photos/mb-356.jpg") !== hash("photos/mb-911.jpg"), "356 package photo is its own file");
const supra = items.find((row) => row.id === "ff-supra");
const porsche356 = items.find((row) => row.id === "mb-356");
assert(/Package photo|hwpriceguide|99diecast|image/i.test(supra.photoSource + supra.photoAlt), "ff supra photo source updated");
assert(porsche356.photo === "photos/mb-356.jpg" && porsche356.photoMatched === true, "356 keeps its path");

["lincoln", "m4", "d100", "starion", "db5", "ferrari12", "mb-vanquish", "mb-defender", "etb", "mainline", "exclusives", "boulevard", "zamac"].forEach((id) => {
  assert(items.some((row) => row.id === id), id + " existing entry remains");
});
assert(!items.some((row) => row.id === "ferrari12" && row.resale), "2027 Ferrari Super is not the mainline 12Cilindri");
assert(items.some((row) => row.resale && row.resale.id === "hw26-085" && row.resale.line === "mainline"), "mainline 12Cilindri was added");

console.log("resale.test.js OK");
console.log(JSON.stringify({ lines, verdicts }));
