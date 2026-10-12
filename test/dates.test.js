"use strict";

const fs = require("fs");
const path = require("path");
const { APP_TODAY, releaseState, dropCountdown } = require("../lib/dates.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

assert(APP_TODAY === "2026-09-22", "product clock is 22 September 2026");
assert(releaseState("2026-08-21") === "Released", "August football is released");
assert(releaseState("2026-09-08") === "Released", "case P/Q date is released");
assert(releaseState("2026-09-16") === "Released", "September 16 is released");
assert(releaseState("2026-09-17") === "Released", "September 17 is released");
assert(releaseState("2026-09-23") === "Upcoming", "September 23 is still upcoming");
assert(releaseState("2026-11-06") === "Upcoming", "November Prizm is upcoming");
assert(releaseState("") === "TBA", "a missing day is TBA");

const drops = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/drops.json"), "utf8"));
assert(drops.length >= 8, "known release rows remain");
drops.forEach((row) => {
  assert(row.sold === "No settled sale", row.id + " does not invent a sold");
  if (row.iso && row.iso < APP_TODAY) assert(releaseState(row.iso) === "Released", row.id + " past row is Released");
  if (!row.iso) assert(row.dateLabel === "TBA" || row.dateLabel, row.id + " without a day names TBA or a window");
  if (row.buyUrl) assert(String(row.buyUrl).startsWith("https://"), row.id + " link is https");
  if (!row.photoMatched) assert(!row.photo, row.id + " unmatched drop has no photo");
});
assert(drops.some((row) => /Pok[eé]mon/.test(row.name) && row.iso === "2026-09-16"), "Pokémon stays on September 16");
assert(dropCountdown("2026-10-15T16:00:00.000Z", new Date("2026-10-12T13:00:00.000Z")) === "Drops in 75 hours", "countdown uses hours inside a week");
assert(dropCountdown("2026-10-12T16:00:00.000Z", new Date("2026-10-12T17:00:00.000Z")) === "", "a past launch has no countdown");
assert(dropCountdown("2026-11-20T16:00:00.000Z", new Date("2026-10-12T16:00:00.000Z")) === "Drops in 39 days", "a far launch counts in days");

console.log("dates.test.js OK");
