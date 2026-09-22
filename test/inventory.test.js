"use strict";

const fs = require("fs");
const path = require("path");
const Inv = require("../lib/inventory.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

function memory(initial) {
  const map = Object.assign({}, initial || {});
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
    },
    setItem(key, value) {
      map[key] = String(value);
    },
    removeItem(key) {
      delete map[key];
    },
  };
}

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/inventory-seed.json"), "utf8"));
assert(seed.count === 78 && seed.items.length === 78, "seed has 78 packages");
assert(seed.retailBand[0] === 125 && seed.retailBand[1] === 155, "invested band");
assert(seed.resaleBand[0] === 285 && seed.resaleBand[1] === 415, "target band");

const lotus = seed.items.find((item) => item.id === "inv-73");
assert(lotus && lotus.tag === "sth" && lotus.status === "STH", "Lotus is STH");
assert(lotus.resaleLow === 20 && lotus.resaleHigh === 40, "Lotus target stays 20-40");
assert(/Mix H Super/.test(lotus.notes), "Lotus Mix H");
assert(/Spectraflame orange/.test(lotus.notes) && /Real Riders/.test(lotus.notes) && /gold flame/.test(lotus.notes), "Lotus tells");

["inv-5", "inv-6"].forEach((id) => {
  const row = seed.items.find((item) => item.id === id);
  assert(row && row.tag === "verify-sth" && row.status === "Verify STH", id + " stays Verify STH");
  assert(/spectraflame blue/i.test(row.notes), id + " spectraflame blue");
  assert(/Real Riders/.test(row.notes), id + " Real Riders");
  assert(/hood scoop/.test(row.notes), id + " hood scoop");
  assert(/gold flame circle/.test(row.notes), id + " gold flame circle");
  assert(row.resaleHigh <= 8, id + " is not priced as a confirmed Super");
});

["inv-49", "inv-54"].forEach((id) => {
  const row = seed.items.find((item) => item.id === id);
  assert(/Dirt ATV/.test(row.name) && row.tag === "duplicate", id + " duplicate Dirt ATV");
});
assert(seed.items.find((item) => item.id === "inv-52").tag === "duplicate", "third ATV marked duplicate");
assert(seed.items.find((item) => item.id === "inv-61").tag === "duplicate", "extra 7-Eleven marked duplicate");
assert(seed.items.find((item) => item.id === "inv-14").tag !== "duplicate", "first Dirt ATV is not the extra");
assert(seed.items.every((item) => item.photoMatched === false && !item.photo), "inventory photos are not invented");

const empty = memory();
const first = Inv.load(empty, seed);
assert(first.ok && first.seeded, "empty storage seeds");
assert(Inv.visible(first.state).length === 78, "seed shows 78");
const port = Inv.portfolio(first.state, seed);
assert(port.packages === 78, "portfolio count");
assert(port.investedLabel === "$125–$155", "portfolio invested");
assert(port.targetLabel === "$285–$415", "portfolio target");
assert(port.verifiedSupers === 1 && port.toVerify === 2, "one Super and two to verify");

const lotusRow = first.state.items.find((item) => item.id === "inv-73");
lotusRow.cost = 9;
lotusRow.notes = "user note";
lotusRow.soldHistory.push({ at: "2026-09-01T00:00:00.000Z", price: 25 });
Inv.write(empty, first.state);
const second = Inv.load(empty, seed);
const kept = second.state.items.find((item) => item.id === "inv-73");
assert(kept.cost === 9 && kept.notes === "user note", "merge keeps edits");
assert(kept.soldHistory.length === 1 && kept.soldHistory[0].price === 25, "merge keeps sold history");
assert(kept.tag === "sth", "untouched tag remains");

Inv.markRemoved(second.state, "inv-1");
Inv.write(empty, second.state);
const third = Inv.load(empty, seed);
assert(!third.state.items.some((item) => item.id === "inv-1"), "removed id is not reseeded");
assert(Inv.visible(third.state).length === 77, "visible count drops after remove");

const broken = memory();
broken.setItem(Inv.KEY, "{");
const refused = Inv.load(broken, seed);
assert(refused.ok === false, "corrupt storage is rejected");
assert(broken.getItem(Inv.KEY) === "{", "corrupt storage is not wiped");

const bought = memory();
bought.setItem("reseller-bought", JSON.stringify([{ id: "old-1", name: "Manual buy", cost: "4", store: "Target", date: "2026-09-01", size: "10" }]));
const withBought = Inv.load(bought, seed);
assert(withBought.state.items.some((item) => item.name === "Manual buy"), "old bought rows migrate once");
assert(Inv.visible(withBought.state).length === 79, "migration adds to the seed");
const again = Inv.load(bought, seed);
assert(again.state.items.filter((item) => item.name === "Manual buy").length === 1, "migration does not duplicate");

const csv = Inv.toCsv(seed.items);
assert(csv.split("\n")[0].includes("name") && csv.includes("Lotus Sport Elise STH"), "csv export");
const imported = Inv.importJson({ version: 2, items: [], tombstones: [] }, { items: [{ id: "inv-73", name: "Lotus Sport Elise STH", cost: 3, notes: "edited import", soldHistory: [{ at: "x", price: 30 }] }] });
assert(imported.ok && imported.state.items[0].cost === 3, "import json by id");
assert(imported.state.items[0].photoMatched === false, "import cannot attach a fake photo");

console.log("inventory.test.js OK");
