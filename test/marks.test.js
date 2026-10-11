"use strict";

const fs = require("fs");
const path = require("path");
const Marks = require("../lib/marks.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");
const sources = JSON.parse(fs.readFileSync(path.join(root, "images/SOURCES.json"), "utf8"));
const coupons = JSON.parse(fs.readFileSync(path.join(root, "data/coupons.json"), "utf8"));
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert(Array.isArray(sources.licenses) && sources.licenses.length === 0, "no written photo license is on file");
assert(sources.operator === "Broken Beaker Labs LC", "operator is named without a logo notice");
assert(!/logo/i.test(JSON.stringify(sources.licenses)), "license list does not describe logos");

const imageDir = path.join(root, "images");
fs.readdirSync(imageDir).forEach((name) => {
  assert(name === "SOURCES.json", "images/ holds the license record only, not logo files");
});

assert(Marks.brandWord("  Hot   Wheels ") === "Hot Wheels", "wordmark is the plain name");
assert(Marks.chipWord("hot-wheels") === "Hot Wheels", "chip wordmark");
assert(Marks.chipWord("pokemon") === "Pokémon", "pokemon chip wordmark");
assert(Marks.dropBrand({ name: "Hot Wheels 2026 case P and Q", category: "Cars" }) === "Hot Wheels", "calendar brand");
assert(Marks.dropBrand({ name: "Matchbox Super Chase still landing", category: "Cars" }) === "Matchbox", "matchbox calendar brand");
assert(Marks.dropBrand({ name: "2026 Topps Football blaster", category: "Sports" }) === "Topps", "topps calendar brand");

assert(Marks.licensedProduct(sources, "coupon-hot-wheels") === null, "missing license uses no photo");
assert(Marks.licensedProduct({ licenses: [{ id: "x", written: false, kind: "product", src: "photos/cuda.jpg" }] }, "x") === null, "unwritten license is refused");
assert(Marks.licensedProduct({ licenses: [{ id: "x", written: true, kind: "logo", src: "assets/brand/mark.svg" }] }, "x") === null, "logo license is refused");
const granted = Marks.licensedProduct({
  licenses: [{ id: "x", written: true, kind: "product", src: "photos/cuda.jpg", width: 144, height: 108, alt: "Cuda" }],
}, "x");
assert(granted && granted.src === "photos/cuda.jpg" && granted.width === 144 && granted.height === 108, "written product license is the only photo");

assert(html.includes("lib/marks.js"), "marks helper is on the page");
assert(app.includes("class=\"brand-word\""), "chips and cards use a text wordmark");
assert(app.includes("HuntMarks.licensedProduct"), "product photos go through the license file");
assert(app.includes("data/coupons.json"), "coupons load from data");
assert(app.includes("images/SOURCES.json"), "license file loads with the hunt");
assert(app.includes("coupon-card"), "coupon cards exist");
assert(app.includes('src="assets/states/photo-needed.svg"'), "unlicensed slots use the existing placeholder");
assert(!app.includes("assets/logos/"), "no hosted logo path");
assert(!/brand-logo|logo-img/i.test(app), "no logo image slot");
assert(css.includes(".brand-word"), "wordmark is styled in the app font");
assert(css.includes(".coupon-card"), "coupon cards are styled");
assert(coupons.length >= 4, "coupon brands are listed");
coupons.forEach((row) => {
  assert(row.brand && row.detail && !row.photo && !row.src, row.id + " has no image of its own");
});

const listener = app.slice(app.indexOf('document.addEventListener("error"'), app.indexOf('document.addEventListener("click"'));
assert(listener.includes('img.closest(".hw-photo")') && listener.includes("assets/states/photo-needed.svg"), "card image fallback is unchanged");
assert(app.includes('class="hw-photo"'), "a licensed photo still uses the existing fallback hook");

console.log("marks.test.js OK");
