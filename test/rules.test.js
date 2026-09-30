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
  const line = Rules.priceLine(item);
  if (rule.lastSold == null) assert(line === "No sold data", item.id + " has no sheet sold");
  else {
    assert(line.indexOf("Last sold") === 0, item.id + " shows a sheet last sold");
    assert(line.indexOf("Net") !== -1, item.id + " shows net");
  }
  assert(Rules.compOf(item) === null, item.id + " comp stays hidden without a source URL");
});

const alwaysBuy = ["cuda", "firebird", "subaru", "f40", "civic", "lotus", "mustang", "impala", "porsche", "drift", "sierra", "otto", "supra-tooned", "maxima", "ram", "lincoln", "m4", "d100", "starion", "db5", "ferrari12", "belair", "datsun", "ff-supra", "mb-integra", "mb-911", "mb-jag", "mb-bronco", "mb-gtr", "mb-356", "mb-vanquish", "mb-defender"];
alwaysBuy.forEach((id) => assert(Rules.verdictFor({ id }) === "Buy", id + " is a peg buy"));
["skyline", "mainline", "boulevard", "tt-msrp", "mb-regular", "cars-movie", "matchbox", "red-supra", "tt-under", "rlc"].forEach((id) => {
  assert(Rules.verdictFor({ id }) === "Pass", id + " stays a pass");
});
assert(Rules.netOf(100) === 82 && Rules.moneyOf({ id: "cuda" }).net === "~$82", "cuda net uses sold × 0.87 − $5");
assert(Rules.moneyOf({ id: "firebird" }).sold.indexOf("sparse") !== -1, "firebird sold is sparse");
assert(Rules.moneyOf({ id: "f40" }).net === "~$124", "f40 card uses the sheet, not the $122 snapshot");
assert(Rules.priceLine({ id: "lincoln" }) === "No sold data", "early 2027 has no sold");
assert(Rules.priceLine({ id: "mb-integra" }) === "No sold data", "integra has no solid solds");
assert(Rules.priceLine({ id: "mb-gtr" }) === "No sold data", "gtr stays unconfirmed");
assert(/Not the Skyline/.test(Rules.tellsFor({ id: "subaru" })), "impreza is not the skyline");
assert(Rules.laneFor({ id: "belair" }) === "cc" && Rules.laneFor({ id: "ff-supra" }) === "ff" && Rules.laneFor({ id: "mb-911" }) === "mbsc", "chase lanes");
assert(Rules.laneFor({ id: "skyline" }) === "leave" && Rules.laneFor({ id: "red-supra" }) === "selective", "pass lanes");

assert(Rules.verdictFor({ id: "skyline" }) === "Pass", "regular TH is a pass");
assert(Rules.verdictFor({ id: "cuda" }) === "Buy", "gold-flame Super is a buy");
assert(/read the card/i.test(Rules.tellsFor({ id: "cuda" })), "supers teach read the card");
assert(Rules.verdictFor({ id: "mb-911" }) === "Buy", "super chase is a buy");
assert(/SUPER CHASE/.test(Rules.tellsFor({ id: "mb-911" })), "matchbox tell");
assert(Rules.verdictFor({ id: "etb" }) === "Buy" && /\$49\.99/.test(Rules.tellsFor({ id: "etb" })), "ETB only at printed 49.99");
assert(Rules.verdictFor({ id: "m6a" }) === "Buy" && /¥7200/.test(Rules.tellsFor({ id: "m6a" })), "M6a near 7200 yen");
sports.forEach((id) => assert(Rules.verdictFor({ id: id }) === "Pass", id + " blister is a pass"));
assert(Rules.laneFor({ id: "etb" }) === "pokemon", "ETB is a pokemon lane, not a car");
assert(Rules.storeLanes("goodwill").indexOf("golf") === 0, "Goodwill leads with golf");
assert(Rules.storeLanes("dollartree").join(",") === "sth,cc,ff,mbsc,leave,selective", "Dollar Tree is the peg only");
assert(Rules.dropVerdict("hw-sth-2027").verdict === "Buy" && Rules.dropVerdict("mb-sc-2027").verdict === "Buy", "2027 drops stay on the buy calendar");
assert(Rules.compOf({ compLabel: "$33", sourceUrl: "https://example.com/lotus-sold" }).label === "$33", "real source URL can show a comp");
assert(Rules.compOf({ compLabel: "$33", sourceUrl: "https://www.walmart.com/search?q=lotus" }) === null, "search URLs are not comps");
assert(Rules.compOf({ id: "f40", listPrice: "$122", soldNum: 122 }) === null, "a stored number without a URL is not a comp");
assert(Rules.dropVerdict("etb-cal").verdict === "Buy", "ETB drop stays on the buy calendar");
assert(Rules.dropVerdict("prizm-fb-cal").verdict === "Pass", "other drops pass");

console.log("rules.test.js OK");
