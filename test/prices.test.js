"use strict";

const { settledSale, resellLabel, allowsInvented, TRUSTED } = require("../lib/prices.js");
const { refreshPlan, applyRefreshResult, providerById } = require("../lib/providers.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

assert(settledSale("f40").sold === 122 && settledSale("f40").source === "HW Price Guide" && settledSale("f40").sales === 8, "F40 snapshot");
assert(settledSale("civic").sold === 61 && settledSale("civic").sales === 36, "Civic snapshot");
assert(settledSale("lotus").sold === 33 && settledSale("lotus").sales === 23, "Lotus tracked sale is separate from the inventory target");
assert(settledSale("impala").sold === 45 && settledSale("impala").date === "July 2026", "Impala snapshot");
assert(settledSale("mustang").sold === 53 && settledSale("mustang").date === "May 2026", "Mustang snapshot");
const topps = settledSale("topps-s1");
assert(topps.low === 13.2 && topps.high === 16.8 && topps.sold === null, "Topps is a range, not one recommendation");
assert(topps.fitness === "Pass" && topps.printed === "Often $24.99", "Topps pass at printed retail");

["cuda", "firebird", "skyline", "porsche", "matchbox", "fifa", "jordan-1", "iphone", "supreme"].forEach((id) => {
  assert(settledSale(id) === null, id + " has no settled sale");
  assert(resellLabel({ id, soldNum: 999, listPrice: "$50" }) === "none", id + " ignores an invented number");
});

assert(resellLabel({ id: "f40" }) === "$122", "trusted resell label");
assert(resellLabel({ id: "topps-s1" }) === "$13.20–$16.80", "topps range label");
assert(allowsInvented({ id: "cuda" }) === false, "invented prices are refused");
assert(TRUSTED.length === 6, "only the six trusted rows");

const snapshot = refreshPlan(providerById("hw-price-guide"));
const live = refreshPlan("dollar-tree");
assert(snapshot.updatesPrice === false && snapshot.status === "snapshot", "guide refresh keeps the snapshot");
assert(live.updatesPrice === false && live.status === "attempt", "store attempt does not update a price");
assert(applyRefreshResult("$122", snapshot) === "$122", "apply leaves the current price");
let threw = false;
try {
  applyRefreshResult("$1", { updatesPrice: true, status: "live" });
} catch (err) {
  threw = true;
}
assert(threw, "a refresh that would replace a price is rejected");

console.log("prices.test.js OK");
