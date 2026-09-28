"use strict";

const fs = require("fs");
const path = require("path");
const Rules = require("../lib/rules.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/catalog.json"), "utf8"));
const items = Object.keys(catalog).flatMap((key) => catalog[key]);
const sports = ["topps-s1", "topps-fb", "fifa", "artifacts", "optic-fb", "chrome-fb", "select-fb", "wnba", "bowman-bb"];

items.forEach((item) => {
  const rule = Rules.cardRule(item.id);
  assert(rule, item.id + " is on the buy/pass card");
  assert(rule.verdict === "Buy" || rule.verdict === "Pass", item.id + " verdict is Buy or Pass");
  assert(Rules.priceLine(item) === "No sold data", item.id + " has no sourced comp");
  assert(Rules.compOf(item) === null, item.id + " comp stays hidden without a source URL");
});

assert(Rules.verdictFor({ id: "skyline" }) === "Pass", "regular TH is a pass");
assert(Rules.verdictFor({ id: "cuda" }) === "Buy", "gold-flame Super is a buy");
assert(/read the card/i.test(Rules.tellsFor({ id: "cuda" })), "supers teach read the card");
assert(Rules.verdictFor({ id: "matchbox" }) === "Buy", "super chase is a buy");
assert(/SUPER CHASE/.test(Rules.tellsFor({ id: "matchbox" })), "matchbox tell");
assert(Rules.verdictFor({ id: "etb" }) === "Buy" && /\$49\.99/.test(Rules.tellsFor({ id: "etb" })), "ETB only at printed 49.99");
assert(Rules.verdictFor({ id: "m6a" }) === "Buy" && /¥7200/.test(Rules.tellsFor({ id: "m6a" })), "M6a near 7200 yen");
sports.forEach((id) => assert(Rules.verdictFor({ id: id }) === "Pass", id + " blister is a pass"));
assert(Rules.laneFor({ id: "etb" }) === "pokemon", "ETB is a pokemon lane, not a car");
assert(Rules.storeLanes("goodwill").indexOf("golf") === 0, "Goodwill leads with golf");
assert(Rules.storeLanes("dollartree").join(",") === "hotwheels,matchbox", "Dollar Tree is the peg only");
assert(Rules.compOf({ compLabel: "$33", sourceUrl: "https://example.com/lotus-sold" }).label === "$33", "real source URL can show a comp");
assert(Rules.compOf({ compLabel: "$33", sourceUrl: "https://www.walmart.com/search?q=lotus" }) === null, "search URLs are not comps");
assert(Rules.compOf({ id: "f40", listPrice: "$122", soldNum: 122 }) === null, "a stored number without a URL is not a comp");
assert(Rules.dropVerdict("etb-cal").verdict === "Buy", "ETB drop stays on the buy calendar");
assert(Rules.dropVerdict("prizm-fb-cal").verdict === "Pass", "other drops pass");

console.log("rules.test.js OK");
