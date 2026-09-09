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

["Cars", "Sports", "Sneakers", "Tech", "Streetwear"].forEach((name) => {
  assert(firstScreen.includes(name), `first screen has ${name}`);
});

assert(!/Cuda/i.test(firstScreen), "Cuda is not in first-screen markup");
assert(!/Aisle list/i.test(firstScreen), "Aisle list is not on first screen");
assert(!/<h1[^>]*>\s*Finds\s*<\/h1>/i.test(firstScreen), "Finds is not the title");
assert(!/_next/.test(html), "no Next.js assets");

console.log("first-screen.test.js OK");
