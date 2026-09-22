"use strict";

const fs = require("fs");
const path = require("path");
const { searchRecords, sortByFitness, sortInventory } = require("../lib/search.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/inventory-seed.json"), "utf8"));
const records = seed.items.map((item) => ({
  name: item.name,
  notes: item.notes,
  category: item.category,
  store: item.store,
  grade: item.grade,
  status: item.status,
  tag: item.tag,
  fitness: item.tag === "sth" ? "STH" : item.tag === "verify-sth" ? "Verify STH" : "Watch",
}));

assert(searchRecords(records, "spectraflame blue").length === 2, "notes search finds both Subarus");
assert(searchRecords(records, "Verify STH").every((row) => row.status === "Verify STH"), "status search");
assert(searchRecords(records, "Goodwill").length === 0, "store field is searchable when present");
assert(searchRecords(records, "Inventory").length === 78, "store Inventory matches the book");
assert(searchRecords(records, "not-a-real-car").length === 0, "empty search result");

const mixed = [
  { name: "B", fitness: "Pass" },
  { name: "A", fitness: "Strong" },
  { name: "C", fitness: "Watch" },
  { name: "D", status: "Verify STH", fitness: "Verify STH" },
];
const sorted = sortByFitness(mixed).map((row) => row.name);
assert(sorted.join(",") === "A,C,D,B", "Strong, then Verify/Watch, then Pass");

const invSorted = sortInventory(seed.items);
const tags = invSorted.map((item) => item.tag);
function firstIndex(tag) {
  return tags.indexOf(tag);
}
assert(firstIndex("sth") < firstIndex("verify-sth"), "STH before Verify STH");
assert(firstIndex("verify-sth") < firstIndex("priority"), "Verify STH before priority");
assert(firstIndex("priority") < firstIndex("multipack"), "priority before multipacks");
assert(firstIndex("multipack") < firstIndex("duplicate"), "multipacks before duplicates");
assert(firstIndex("duplicate") < tags.indexOf("mainline"), "duplicates before the rest");
assert(invSorted[0].id === "inv-73", "Lotus leads the inventory sort");

console.log("search.test.js OK");
