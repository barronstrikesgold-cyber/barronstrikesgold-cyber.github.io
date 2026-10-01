"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { settledSale } = require("../lib/prices.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/catalog.json"), "utf8"));
const items = Object.keys(catalog).flatMap((key) => catalog[key]);
assert(items.length >= 39, "tracked catalog remains");
const seen = new Map();
items.forEach((item) => {
  if (item.soldNum != null) assert(settledSale(item.id), item.id + " sold number is a trusted snapshot");
  if (item.photoMatched) {
    assert(item.photo && item.photo.endsWith(".jpg"), item.id + " matched photo path");
    const file = path.join(root, item.photo);
    const bytes = fs.readFileSync(file);
    assert(bytes[0] === 0xff && bytes[1] === 0xd8, item.photo + " is a jpeg");
    assert(!seen.has(item.photo), "unique matched photo " + item.photo);
    seen.set(item.photo, item.id);
    assert(item.photoAlt && item.photoSource, item.id + " has alt and source");
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    assert(!seen.has("hash:" + hash), item.id + " reuses another casting's photo bytes");
    seen.set("hash:" + hash, item.id);
  } else {
    assert(!item.photo, item.id + " does not show an unmatched image");
  }
});
const byId = Object.fromEntries(items.map((item) => [item.id, item]));
const ownPackage = {
  cuda: "photos/cuda.jpg",
  firebird: "photos/firebird.jpg",
  f40: "photos/f40.jpg",
  civic: "photos/civic.jpg",
  lotus: "photos/lotus.jpg",
  mustang: "photos/mustang.jpg",
  impala: "photos/impala.jpg",
  porsche: "photos/porsche.jpg",
  subaru: "photos/subaru.jpg",
  drift: "photos/drift.jpg",
  sierra: "photos/sierra.jpg",
  otto: "photos/otto.jpg",
  "supra-tooned": "photos/supra-tooned.jpg",
  maxima: "photos/maxima.jpg",
  ram: "photos/ram.jpg",
  lincoln: "photos/lincoln.jpg",
  m4: "photos/m4.jpg",
  d100: "photos/d100.jpg",
  starion: "photos/starion.jpg",
  db5: "photos/db5.jpg",
  ferrari12: "photos/ferrari12.jpg",
  belair: "photos/belair.jpg",
  datsun: "photos/datsun.jpg",
  "ff-supra": "photos/ff-supra.jpg",
  "mb-integra": "photos/mb-integra.jpg",
  "mb-911": "photos/mb-911.jpg",
  "mb-jag": "photos/mb-jag.jpg",
  "mb-bronco": "photos/mb-bronco.jpg",
  "mb-gtr": "photos/mb-gtr.jpg",
};
Object.entries(ownPackage).forEach(([id, photo]) => {
  assert(byId[id] && byId[id].photo === photo && byId[id].photoMatched === true, id + " keeps its own package photo");
});
["mb-356", "mb-vanquish", "mb-defender", "mainline", "boulevard", "matchbox"].forEach((id) => {
  assert(byId[id] && byId[id].photoMatched === false && !byId[id].photo, id + " stays unmatched");
});
assert(!items.some((item) => item.id === "palace" || item.id === "nb-991"), "unphotographed models stay off the list");
assert(items.some((item) => item.id === "f40" && item.fitness === "Strong"), "F40 remains Strong");
assert(items.some((item) => item.id === "topps-s1" && item.fitness === "Pass"), "Topps remains Pass");

console.log("catalog.test.js OK");
