"use strict";

const fs = require("fs");
const path = require("path");
const { leftoverCash, itemFitness } = require("../cash.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const first = html.split(/<script[\s>]/i)[0];

["Cars", "Sports", "Sneakers", "Tech", "Streetwear"].forEach((name) => {
  assert(first.includes(name), `home has ${name}`);
});
assert(!/Cuda/i.test(first), "home does not dump Cuda");
assert(app.includes("$122"), "car data has $122");
assert(app.includes("August 2026"), "car data has August 2026");
assert(app.includes("No settled sale"), "car data has No settled sale");
assert(app.includes("HW Price Guide"), "review source is named");
assert(html.includes("walmart.com/search"), "Walmart check search in HTML");
assert(html.includes("google.com/search"), "Google check search in HTML");
assert(
  html.includes("shopgoodwill.com/categories/search"),
  "ShopGoodwill categories search in HTML"
);
assert(app.includes('placeholder="Search this store"'), "store header search placeholder");
assert(html.includes("Dollar Tree"), "Dollar Tree in HTML");
assert(html.includes("Retail"), "Retail label in HTML");
assert(html.includes("Recommended resell"), "Recommended resell label in HTML");
assert(
  html.includes("dollartree.com/searchresults"),
  "confirmed Dollar Tree search in HTML"
);

assert(leftoverCash(null, 0) === null, "unknown cash without sold");
assert(Math.round(leftoverCash(122, 0)) === 106, "122 after 13% is about 106");
assert(itemFitness({ fitness: "Strong" }) === "Strong", "explicit Strong");
assert(itemFitness({ fitness: "Watch" }) === "Watch", "explicit Watch");
assert(itemFitness({ fitness: "Pass" }) === "Pass", "explicit Pass");

console.log("review-data.test.js OK");
