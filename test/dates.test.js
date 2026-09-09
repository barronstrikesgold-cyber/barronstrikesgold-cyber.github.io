"use strict";

const fs = require("fs");
const path = require("path");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert(html.includes("Dates"), "Dates tab in HTML");
assert(html.includes("September 16, 2026"), "September 16, 2026 in HTML");
assert(/Pok[eé]mon/.test(html), "Pokémon in HTML");
assert(html.includes("No settled sale"), "does not invent a sold");
assert(!html.includes("live ticker"), "not a fake ticker");

const json = html.slice(
  html.indexOf(">", html.indexOf('id="dates-json"')) + 1,
  html.indexOf("</script>", html.indexOf('id="dates-json"'))
);
const dates = JSON.parse(json);
assert(Array.isArray(dates) && dates.length >= 6, "calendar has dated rows");
dates.forEach((row) => {
  assert(row.sold === "No settled sale", `${row.id} has no invented sold`);
  if (row.buyUrl) {
    assert(row.buyUrl.startsWith("https://"), `${row.id} buy link is https`);
  }
});
assert(
  dates.some((row) => /Pok[eé]mon/.test(row.name) && row.dateLabel === "September 16, 2026"),
  "Pokémon is on September 16, 2026"
);

console.log("dates.test.js OK");
