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
const games = JSON.parse(fs.readFileSync(path.join(root, "data/games.json"), "utf8"));
const drops = JSON.parse(fs.readFileSync(path.join(root, "data/drops.json"), "utf8"));
const market = JSON.parse(fs.readFileSync(path.join(root, "data/market.json"), "utf8"));
const gta = (games.items || []).find((item) => item.id === "gta6");
const drop = drops.find((item) => item.id === "gta6");
const section = (market.sections || []).find((item) => item.id === "games");
const card = section && (section.items || []).find((item) => item.id === "gta6");

assert(gta && gta.release === "2026-11-19", "GTA VI is stored as November 19, 2026");
assert(drop && drop.iso === "2026-11-19" && drop.category === "Video games", "GTA VI is on the calendar");
assert(card && card.release === "2026-11-19" && card.retail === 79.99, "GTA VI keeps the published $79.99");
assert((games.items || []).some((item) => item.id === "persona6" && item.dateLabel === "TBA" && !item.release), "an undated game stays TBA");

async function main() {
  const res = await fetch("https://www.rockstargames.com/VI", {
    headers: { "User-Agent": "HuntReleaseCheck/1.0" },
    signal: AbortSignal.timeout(20000),
  });
  assert(res.ok, "Rockstar GTA VI page status " + res.status);
  const text = await res.text();
  assert(/November 19,\s*2026/.test(text), "Rockstar page no longer says November 19, 2026");
  console.log("games-release.test.js OK");
}

main().catch((err) => {
  console.error("FAIL:", err && err.message ? err.message : err);
  process.exit(1);
});
