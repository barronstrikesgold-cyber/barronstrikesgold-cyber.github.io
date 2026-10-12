"use strict";

const assert = require("assert");
const Rules = require("../lib/rules.js");
const catalog = require("../data/catalog.json");
const market = require("../data/market.json");
const golf = require("../data/golf.json");
const drops = require("../data/drops.json");

function allCatalog() {
  const list = [];
  Object.keys(catalog).forEach((key) => {
    (catalog[key] || []).forEach((item) => {
      item.category = item.category || key;
      list.push(item);
    });
  });
  return list;
}

function chipOf(rec) {
  if (!rec) return "other";
  if (rec.kind === "golf" || rec.category === "golf") return "golf";
  if (rec.kind === "market") {
    const section = String(rec.category || "");
    if (section === "magic") return "mtg";
    if (section === "mattel") return "hot-wheels";
      if (section === "games") return "video-games";
      if (["matchbox", "pokemon", "onepiece", "lorcana", "yugioh", "sports", "sneakers", "designer", "lego", "funko", "apple", "consoles"].includes(section)) return section;
    return "other";
  }
  if (rec.kind === "catalog") {
    const lane = String(rec.category || "");
    const id = rec.ref && rec.ref.id;
    if (lane === "pokemon") return "pokemon";
    if (lane === "mbsc" || id === "mb-regular") return "matchbox";
    if (lane === "sports" || lane === "sneakers" || lane === "tech" || lane === "streetwear") return "other";
    return "hot-wheels";
  }
  return "other";
}

const records = [];
allCatalog().forEach((item) => {
  records.push({ kind: "catalog", category: Rules.laneFor(item), ref: item });
});
(golf.look || []).forEach((name) => {
  records.push({ kind: "golf", category: "golf", name, ref: { id: name } });
});
(market.sections || []).forEach((section) => {
  (section.items || []).forEach((item) => {
    records.push({ kind: "market", category: section.id, ref: item });
  });
});

const counts = {};
records.forEach((rec) => {
  const chip = chipOf(rec);
  counts[chip] = (counts[chip] || 0) + 1;
});

const expected = {
  mtg: 8,
  onepiece: 12,
  lorcana: 1,
  yugioh: 3,
  sports: 6,
  sneakers: 99,
  designer: 31,
  lego: 22,
  funko: 8,
  apple: 6,
  consoles: 4,
  pokemon: 26,
  matchbox: 19,
  golf: 7,
  "video-games": 25,
};
Object.keys(expected).forEach((chip) => {
  assert.strictEqual(counts[chip], expected[chip], chip + " chip count");
});
assert.strictEqual(drops.length, 37, "calendar drops");
assert.strictEqual(drops.filter((row) => row.category === "Video games").length, 25, "video game calendar rows");

const lanes = {
  sth: 26,
  cc: 13,
  ff: 4,
  mbsc: 10,
  exclusive: 10,
  premium: 19,
  multipack: 8,
  "hw-main": 5,
  leave: 5,
  selective: 5,
  pokemon: 7,
};
Object.keys(lanes).forEach((lane) => {
  const n = allCatalog().filter((item) => Rules.laneFor(item) === lane).length;
  assert.strictEqual(n, lanes[lane], lane + " hunt section size");
});

console.log("chips.test.js OK");
