"use strict";

const fs = require("fs");
const path = require("path");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const first = html.split(/<script[\s>]/i)[0];

assert(/>Refresh</.test(html) || /data-refresh/.test(html), "Refresh control in HTML");
assert(app.includes("Refresh"), "Refresh in app.js");
assert(!app.includes("dollartree.svg"), "no dollartree.svg product photo");
assert(!html.includes("dollartree.svg"), "no dollartree.svg in HTML");
assert(!/id: "palace"/.test(app), "Palace is not a tracked product");
assert(!/id: "nb-991"/.test(app), "NB 991 is not tracked without a unique photo");

const items = [
  ...app.matchAll(/id: "([^"]+)",\s*name: "([^"]+)",\s*photo: "([^"]+)"/g),
].map((m) => ({ id: m[1], name: m[2], photo: m[3] }));

assert(items.length > 20, "tracked products remain");
const seen = new Map();
items.forEach((item) => {
  assert(item.photo.endsWith(".jpg"), `${item.id} photo is a JPEG`);
  const file = path.join(__dirname, "..", item.photo);
  assert(fs.existsSync(file), `${item.photo} exists`);
  const bytes = fs.readFileSync(file);
  assert(bytes[0] === 0xff && bytes[1] === 0xd8, `${item.photo} is a real JPEG`);
  assert(!seen.has(item.photo), `unique photo for ${item.id}, not shared with ${seen.get(item.photo)}`);
  seen.set(item.photo, item.id);
});

assert(html.includes("buy-json"), "purchase links are listed");
assert(html.includes("https://"), "https purchase links in HTML");
assert(first.includes("Dollar Tree"), "Dollar Tree store card remains");
assert(!/Cuda/i.test(first), "no car dump on first screen");
assert(app.includes("Grade"), "Grade control in app");
assert(app.includes("On shelf"), "On shelf stock in app");
assert(app.includes("Price history"), "price history in app");
assert(app.includes("GOLF_LOOK"), "golf look-for list in app");
assert(!/id: "palace"/.test(app), "Palace still not tracked");
assert(app.includes("$61"), "Civic sold unchanged");

console.log("tracked.test.js OK");
