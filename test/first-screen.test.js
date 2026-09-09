"use strict";

const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const firstScreen = html.split(/<script[\s>]/i)[0];

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

assert(html.includes("<title>Reseller</title>"), "document title is Reseller");
assert(firstScreen.includes("<h1>Reseller</h1>"), "one title Reseller");
assert(
  firstScreen.includes("If it is not on this list, leave it."),
  "rule line on first screen"
);
assert(firstScreen.includes("Where are you?"), "store prompt on first screen");
assert(firstScreen.includes("Or browse"), "browse prompt on first screen");
assert(firstScreen.includes("Walmart"), "Walmart on first screen");

["Hunt", "Stores", "Dates", "Profit", "Bought"].forEach((name) => {
  assert(
    new RegExp(">" + name + "<").test(firstScreen),
    `tab labeled ${name}`
  );
});

["Cars", "Sports", "Sneakers", "Tech", "Streetwear"].forEach((name) => {
  assert(firstScreen.includes(name), `first screen has ${name}`);
});

assert(!/Cuda/i.test(firstScreen), "Cuda is not in first-screen markup");
assert(!/Aisle list/i.test(firstScreen), "Aisle list is not on first screen");
assert(!/_next/.test(html), "no Next.js assets");
assert(
  !/>Cash</.test(firstScreen),
  "Cash is not a tab name"
);
assert(
  !/>Books</.test(firstScreen),
  "Books is not a tab name"
);
assert(html.includes("walmart.com/search"), "walmart.com/search in HTML");
assert(html.includes("google.com/search"), "google.com/search in HTML");
assert(
  html.includes("shopgoodwill.com/categories/search"),
  "ShopGoodwill search URL in HTML"
);
assert(!/in stock/i.test(html), "HTML does not say In stock");
assert(!/in stock/i.test(firstScreen), "first screen does not say In stock");
assert(html.includes("$122"), "$122 in HTML");
assert(html.includes("September 16"), "September 16 in HTML");

console.log("first-screen.test.js OK");
