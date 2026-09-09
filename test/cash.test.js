"use strict";

const { cashLeft, beatsShelfAfterFees, itemVerdict } = require("../cash.js");

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

assert(
  beatsShelfAfterFees({ sold: null, shelf: 80, shipping: 0 }) === false,
  "missing sold does not beat shelf"
);
assert(
  beatsShelfAfterFees({ sold: 100, shelf: 80, shipping: 5 }) === true,
  "82 net beats $80 shelf"
);
assert(
  beatsShelfAfterFees({ sold: 100, shelf: 90, shipping: 5 }) === false,
  "82 net does not beat $90 shelf"
);

assert(itemVerdict({ rule: "buy" }) === "Buy", "forced buy");
assert(itemVerdict({ rule: "leave" }) === "Leave it", "forced leave");
assert(
  itemVerdict({ rule: "sold-beats-shelf", sold: null, shelf: 120, shipping: 8 }) ===
    "Leave it",
  "sneakers/tech/streetwear leave without stored sold"
);
assert(
  itemVerdict({
    rule: "sold-beats-shelf",
    sold: 200,
    shelf: 80,
    shipping: 10,
  }) === "Buy",
  "stored sold that clears fees and ship is Buy"
);

console.log("cash.test.js OK");
