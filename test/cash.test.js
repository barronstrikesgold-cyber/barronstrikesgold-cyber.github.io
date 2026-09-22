"use strict";

const { cashLeft, beatsShelfAfterFees, itemVerdict, itemFitness, netProfit, roi, breakEven, feeAmount, targetMid } = require("../cash.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

assert(cashLeft(null, 4) === null, "no sold number is Unknown");
assert(cashLeft("", 4) === null, "empty sold is Unknown");
assert(cashLeft(100, 5) === 82, "100 sold minus 13% fees minus $5 ship is $82");
assert(cashLeft(50, 0) === 43.5, "50 sold minus 13% fees is $43.50");
assert(Math.round(cashLeft(122, 0) * 100) / 100 === 106.14, "122 after 13%");

assert(beatsShelfAfterFees({ sold: null, shelf: 80, shipping: 0 }) === false, "missing sold does not beat shelf");
assert(beatsShelfAfterFees({ sold: 100, shelf: 80, shipping: 5 }) === true, "82 net beats $80 shelf");
assert(beatsShelfAfterFees({ sold: 100, shelf: 90, shipping: 5 }) === false, "82 net does not beat $90 shelf");

assert(itemVerdict({ rule: "buy" }) === "Buy", "forced buy");
assert(itemVerdict({ rule: "leave" }) === "Leave it", "forced leave");
assert(itemVerdict({ sold: null, shelf: 120, shipping: 8 }) === "Leave it", "no sold is not a buy");
assert(itemFitness({ fitness: "Strong" }) === "Strong", "explicit Strong");
assert(itemFitness({ fitness: "Pass" }) === "Pass", "explicit Pass");
assert(itemFitness({ sold: null }) === "Watch", "missing sold stays Watch");

assert(feeAmount(100) === 13, "13% of 100");
assert(feeAmount(null) === null, "no fee without a sold");
assert(netProfit({ sold: null, cost: 10, shipping: 4, tax: 1 }) === null, "net is Unknown without a sold");
assert(netProfit({ sold: 100, cost: 40, shipping: 5, tax: 0 }) === 42, "100 sold, 13 fee, 5 ship, 40 cost");
assert(netProfit({ sold: 100, cost: 40, shipping: 5, tax: 2 }) === 40, "optional tax comes off net");
assert(Math.abs(roi(42, 40) - 1.05) < 1e-9, "ROI is net over cost");
assert(roi(null, 40) === null, "ROI unknown without net");
assert(roi(10, 0) === null, "ROI unknown without cost");
assert(Math.abs(breakEven({ cost: 40, shipping: 5, tax: 0 }) - 45 / 0.87) < 1e-9, "break-even covers cost and ship after fees");
assert(targetMid(20, 40) === 30, "lotus target midpoint");
assert(targetMid(null, 40) === null, "missing target has no midpoint");

console.log("cash.test.js OK");
