"use strict";

const fs = require("fs");
const path = require("path");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const rules = fs.readFileSync(path.join(root, "lib/rules.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const manifest = fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8");
const first = html.split(/<script[\s>]/i)[0];

assert(html.includes("<title>Reseller</title>"), "title");
assert(first.includes("Reseller"), "wordmark on the shell");
["Hunt", "Stores", "Drops", "Inventory", "Profit"].forEach((name) => {
  assert(first.includes(">" + name + "<"), "tab " + name);
});
assert(!/>Dates</.test(first), "Dates is not a tab");
assert(!/>Bought</.test(first), "Bought is not a tab");
assert(!/>Cash</.test(first), "Cash is not a tab");
assert(!/Cuda/i.test(first), "home shell is not a product dump");
assert(html.includes('rel="manifest"'), "manifest linked");
assert(html.includes("apple-touch-icon"), "apple touch icon");
assert(manifest.includes("Reseller") && manifest.includes("standalone"), "manifest");
assert(app.includes("Photo needed"), "photo needed state is explicit");
assert(app.includes("No settled sale"), "missing sales stay unnamed");
assert(app.includes("No sold data"), "unsourced comps stay blank");
assert(app.includes("Where are you?"), "hunt starts at the store");
assert(app.includes("Read the card") || rules.includes("Read the card"), "supers teach the card");
assert(rules.includes("SUPER CHASE"), "matchbox tell");
assert(html.includes("lib/rules.js"), "rules script is on the page");
assert(app.includes("Golf"), "golf category");
assert(/\.peg-photo\.is-hero\s*\{[^}]*height:\s*auto/.test(css), "hunt photo frame follows the package");
assert(/\.peg-photo\.is-hero\s*\{[^}]*aspect-ratio:\s*auto/.test(css), "hunt photo keeps the source aspect");
assert(/\.peg-photo\.is-hero img\s*\{[^}]*object-fit:\s*contain/.test(css), "hunt photo contains the car");
assert(/\.peg-photo\.is-hero img\s*\{[^}]*object-position:\s*center center/.test(css), "hunt photo is centered");
assert(!/\.peg-photo\.is-hero\s*\{[^}]*height:\s*168px/.test(css), "hunt photo is not a short crop");
assert(css.includes("prefers-reduced-motion"), "reduced motion");
assert(css.includes("safe-area-inset-bottom"), "safe area");
assert(css.includes("min-height: 44px"), "44px targets");
assert(!/in stock/i.test(html + app), "no invented in-stock claim");
assert(fs.readFileSync(path.join(root, "lib/providers.js"), "utf8").includes("walmart.com/search"), "Walmart search");
assert(fs.readFileSync(path.join(root, "lib/providers.js"), "utf8").includes("shopgoodwill.com/categories/search"), "ShopGoodwill search");
assert(fs.readFileSync(path.join(root, "lib/providers.js"), "utf8").includes("dollartree.com/searchresults"), "Dollar Tree search");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
assert(sw.includes("reseller-shell-20261001b"), "service worker cache name is bumped");
const shellPaths = [...sw.matchAll(/"(\.\/[^"]+)"/g)].map((match) => match[1]);
shellPaths.forEach((rel) => {
  assert(fs.existsSync(path.join(root, rel.replace(/^\.\//, ""))), rel + " exists for the shell cache");
});

console.log("shell.test.js OK");
