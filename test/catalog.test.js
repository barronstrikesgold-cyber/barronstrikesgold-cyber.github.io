"use strict";

const fs = require("fs");
const path = require("path");
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
  } else {
    assert(!item.photo, item.id + " does not show an unmatched image");
  }
});
assert(!items.some((item) => item.id === "palace" || item.id === "nb-991"), "unphotographed models stay off the list");
assert(items.some((item) => item.id === "f40" && item.fitness === "Strong"), "F40 remains Strong");
assert(items.some((item) => item.id === "topps-s1" && item.fitness === "Pass"), "Topps remains Pass");

console.log("catalog.test.js OK");
