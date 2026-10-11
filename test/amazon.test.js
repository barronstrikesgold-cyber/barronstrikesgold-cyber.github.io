"use strict";

const fs = require("fs");
const path = require("path");
const Amazon = require("../lib/amazon.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");
const sample = "B0TEST1234";
const clean = "https://www.amazon.com/dp/" + sample;
const tagged = clean + "?tag=hempsply02-20";

assert(Amazon.TAG === "hempsply02-20", "tracking id");
assert(Amazon.DISCLOSURE === "As an Amazon Associate I earn from qualifying purchases.", "disclosure sentence");
assert(Amazon.tagUrl("https://www.target.com/p/x/-/A-1") === "https://www.target.com/p/x/-/A-1", "other stores stay untouched");
assert(Amazon.tagUrl("https://www.amazon.com/s?k=hot+wheels") === "https://www.amazon.com/s?k=hot+wheels", "search is not a product link");
assert(!Amazon.isProductUrl("https://www.amazon.co.uk/dp/" + sample), "other Amazon sites are not tagged");
assert(Amazon.asinFromUrl("https://www.amazon.com/Hot-Wheels/dp/" + sample + "/ref=sr_1_1") === sample, "dp path yields the ASIN");
assert(Amazon.asinFromUrl("https://smile.amazon.com/gp/product/" + sample) === sample, "gp product path yields the ASIN");
assert(Amazon.asinFromUrl("https://www.amazon.com/gp/aw/d/" + sample) === sample, "mobile dp path yields the ASIN");
assert(Amazon.tagUrl("http://amazon.com/dp/" + sample).includes("tag=hempsply02-20"), "missing tag is added");
assert(Amazon.tagUrl("https://www.amazon.com/dp/" + sample + "?tag=other-20").includes("tag=hempsply02-20"), "a different tag is replaced");
assert(!Amazon.tagUrl("https://www.amazon.com/dp/" + sample + "?tag=other-20").includes("tag=other-20"), "the old tag does not remain");
assert(Amazon.tagUrl(tagged) === tagged, "a correct tag is left as written");
assert(Amazon.cleanProductUrl(sample) === clean, "stored form is a clean /dp/ URL");
assert(Amazon.productUrl(sample) === tagged, "ASIN builds a tagged product link");
assert(Amazon.searchUrl("Hot Wheels") === "https://www.amazon.com/s?k=Hot%20Wheels&tag=hempsply02-20", "search links carry the tracking id");
assert(Amazon.ebayUrl("Skyline", true).includes("LH_Sold=1") && Amazon.ebayUrl("Skyline", true).includes("LH_Complete=1"), "sold search is completed listings");
assert(!Amazon.ebayUrl("Skyline", false).includes("LH_Sold=1"), "active search is current listings");
assert(Amazon.productUrl("nope") === "", "a short code is not an ASIN");
assert(Amazon.buyHref({ asin: sample, verdict: "PASS" }, "PASS") === "", "PASS does not get a buy link");
assert(Amazon.buyHref({ asin: sample, verdict: "BUY" }) === tagged, "BUY with an ASIN gets a buy link");
assert(Amazon.buyHref({ buyUrl: "https://amazon.com/dp/" + sample }, "Check") === tagged, "CHECK with a product URL gets a buy link");
assert(Amazon.buyHref({ name: "Loose car", verdict: "CHECK" }) === "", "CHECK without an ASIN gets no link");

const fresh = Amazon.stampAssociates({
  sections: [{
    items: [
      { id: "buy", name: "Known", verdict: "BUY", asin: sample, retailUrl: "https://www.target.com/p/x" },
      { id: "check", name: "Listed", verdict: "CHECK", retailUrl: "http://www.amazon.com/dp/" + sample + "?tag=old-20" },
      { id: "pass", name: "Skip", verdict: "PASS", asin: sample },
      { id: "plain", name: "Peg", verdict: "CHECK" },
    ],
  }],
});
assert(fresh.tagged === 1, "one existing product link was rewritten to a clean /dp/ URL");
assert(fresh.added === 1, "one BUY card with an ASIN and no product link was added");
assert(fresh.value.sections[0].items[0].amazonUrl === clean, "added link is a clean /dp/ URL");
assert(fresh.value.sections[0].items[1].retailUrl === clean, "stored product link is a clean /dp/ URL");
assert(!fresh.value.sections[0].items[1].retailUrl.includes("tag="), "stored product link does not keep a tag");
assert(!fresh.value.sections[0].items[1].amazonUrl, "an existing product link is not duplicated");
assert(!fresh.value.sections[0].items[2].amazonUrl, "PASS keeps a bare ASIN off the buy link");
assert(!fresh.value.sections[0].items[3].amazonUrl, "a card without an ASIN is unchanged");
const again = Amazon.stampAssociates(fresh.value);
assert(again.tagged === 0 && again.added === 0, "a second stamp does not retag or add");

function jsonFiles(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "thumbs") return;
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) jsonFiles(full, out);
    else if (entry.name.endsWith(".json")) out.push(full);
  });
}

const files = [];
jsonFiles(root, files);
let productLinks = 0;
let taggedLinks = 0;
let addedLinks = 0;
files.forEach(function (file) {
  const text = fs.readFileSync(file, "utf8");
  if (text.indexOf("amazon.com") === -1 && text.indexOf('"asin"') === -1 && text.indexOf('"amazonAsin"') === -1) return;
  const data = JSON.parse(text);
  const stamped = Amazon.stampAssociates(data);
  productLinks += stamped.productLinks;
  taggedLinks += stamped.tagged;
  addedLinks += stamped.added;
  assert(stamped.tagged === 0, path.relative(root, file) + " is not stored as a clean /dp/ASIN URL");
  assert(stamped.added === 0, path.relative(root, file) + " has a BUY/CHECK ASIN without an Amazon link");
});

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(app.includes('rel = "sponsored noopener"'), "Amazon anchors use rel=sponsored noopener");
assert(app.includes('rel="sponsored noopener"'), "buy anchors use rel=sponsored noopener");
assert(app.includes("eBay sold") && app.includes("eBay active") && app.includes("detailBuyLinks"), "detail pages include eBay and Amazon buy links");
assert(app.includes("Buy on Amazon"), "buy link label");
assert(html.includes("<footer"), "footer element");
assert(html.includes(Amazon.DISCLOSURE), "footer disclosure");

console.log("amazon.test.js OK");
console.log("amazon product links " + productLinks + " tagged " + taggedLinks + " added " + addedLinks);
