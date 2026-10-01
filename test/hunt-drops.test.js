"use strict";

const fs = require("fs");
const path = require("path");
const Rules = require("../lib/rules.js");
const Dates = require("../lib/dates.js");
const Hunt = require("../lib/hunt-drops.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const drops = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/drops.json"), "utf8"));

function verdict(row) {
  return Rules.dropVerdict(row.id).verdict;
}

const picked = Hunt.pickHuntDrops(drops, Dates.APP_TODAY, verdict);
assert(picked.next && picked.next.id === "mb-sc-2026", "next strip row is the next buy drop, saw " + (picked.next && picked.next.id));
assert(picked.fresh && picked.fresh.id === "etb-cal", "new strip row is the latest released buy, saw " + (picked.fresh && picked.fresh.id));

const none = Hunt.pickHuntDrops([], Dates.APP_TODAY, verdict);
assert(none.next === null && none.fresh === null, "empty calendar has no strip rows");

const passesOnly = Hunt.pickHuntDrops(
  [
    { id: "x", iso: "2026-10-01" },
    { id: "y", iso: "2026-09-01" },
  ],
  Dates.APP_TODAY,
  function () { return "Pass"; }
);
assert(passesOnly.next.id === "x", "next falls back to the soonest upcoming date");
assert(passesOnly.fresh.id === "y", "new falls back to the latest released date");

const ties = Hunt.pickHuntDrops(
  [
    { id: "a", iso: "2026-12-01" },
    { id: "b", iso: "2026-12-01" },
  ],
  Dates.APP_TODAY,
  function () { return "Buy"; }
);
assert(ties.next.id === "a", "same-day buys keep calendar order");
assert(ties.fresh === null, "future rows are not treated as new");

assert(Hunt.dataStatusLabel("checking") === "Checking…", "checking copy");
assert(Hunt.dataStatusLabel("fresh") === "Updated just now", "fresh copy");
assert(Hunt.dataStatusLabel("error") === "Could not update. Showing the last copy on this phone.", "error copy");
assert(Hunt.shouldRefreshOnReturn(2000, 1500, "visible") === true, "return refreshes after the quiet window");
assert(Hunt.shouldRefreshOnReturn(1000, 1500, "visible") === false, "boot burst does not double-fetch");
assert(Hunt.shouldRefreshOnReturn(5000, 0, "hidden") === false, "hidden page does not refresh");

console.log("hunt-drops.test.js OK");
