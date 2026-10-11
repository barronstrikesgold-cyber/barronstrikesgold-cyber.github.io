"use strict";

const Flow = require("../lib/flow.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

function memory() {
  var data = {};
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem: function (key, value) {
      data[key] = String(value);
    },
  };
}

const defaults = Flow.loadSettings(memory());
assert(defaults.feePercent === 13, "default fee is 13%");
assert(defaults.shipping === 5, "default shipping is $5");
assert(defaults.minProfit === 5, "default minimum profit is $5");
assert(defaults.minSales === 5, "default minimum sales is 5");

const skyline = Flow.breakdown(
  { sold: 27.5, cost: 1.25, sales: 23 },
  defaults
);
assert(skyline.fees === 3.58, "13% of 27.50 rounds to $3.58");
assert(skyline.profit === 17.67, "profit is sold minus fees, shipping, and cost");
assert(skyline.verdict === "BUY", "profit at least $5 and at least 5 sales is BUY");

const few = Flow.breakdown({ sold: 14, cost: 1.25, sales: 2 }, defaults);
assert(few.profit > 0 && few.verdict === "CHECK", "few sales stay CHECK");

const thin = Flow.breakdown({ sold: 12, cost: 1.25, sales: 20 }, defaults);
assert(thin.profit >= 0 && thin.profit < 5 && thin.verdict === "CHECK", "profit under $5 is CHECK");

const loss = Flow.breakdown({ sold: 4, cost: 1.25, sales: 30 }, defaults);
assert(loss.profit < 0 && loss.verdict === "PASS", "a loss is PASS");

const edge = Flow.breakdown({ sold: 11.5, cost: 1, sales: 5 }, { feePercent: 13, shipping: 5, minProfit: 5, minSales: 5 });
assert(edge.profit === 4, "11.50 minus 1.50 fees minus $5 minus $1 is $4");
const exact = Flow.breakdown({ sold: 12.65, cost: 1, sales: 5 }, defaults);
assert(exact.verdict === "BUY" && exact.profit >= 5, "the buy bar is inclusive");

const blank = Flow.breakdown({ sold: null, cost: 1.25, sales: 0 }, defaults);
assert(blank.verdict === "CHECK" && blank.profit === null, "missing sold stays CHECK");

const zero = Flow.breakdown({ sold: 7.18, cost: 1.25, sales: 9 }, defaults);
assert(zero.profit === 0 && zero.verdict === "CHECK", "zero profit is CHECK");

const store = memory();
const saved = Flow.saveSettings(store, { feePercent: 10, shipping: 4, minProfit: 8, minSales: 3 });
assert(saved.feePercent === 10 && saved.minSales === 3, "settings save what the user typed");
const loaded = Flow.loadSettings(store);
assert(loaded.shipping === 4 && loaded.minProfit === 8, "settings come back from storage");
const custom = Flow.breakdown({ sold: 20, cost: 1, sales: 3 }, loaded);
assert(custom.fees === 2 && custom.verdict === "BUY", "edited fee and sales bar are used");

const bad = Flow.saveSettings(memory(), { feePercent: -1, shipping: "nope", minProfit: null, minSales: 2 });
assert(bad.feePercent === 13 && bad.shipping === 5 && bad.minProfit === 5 && bad.minSales === 2, "invalid numbers fall back");

const crossed = Flow.shouldNotify(
  { profitOn: true, threshold: 20, stockOn: false, verdictOn: true },
  { profit: 17.67, verdict: "CHECK", inStock: false },
  { profit: 21, verdict: "BUY", inStock: false }
);
assert(crossed.indexOf("profit") !== -1 && crossed.indexOf("verdict") !== -1, "profit and verdict alerts fire on a change");
const held = Flow.shouldNotify(
  { profitOn: true, threshold: 20, stockOn: true, verdictOn: true },
  { profit: 21, verdict: "BUY", inStock: false },
  { profit: 22, verdict: "BUY", inStock: false }
);
assert(held.length === 0, "a profit that stays above the line does not fire again");
const stock = Flow.shouldNotify(
  { profitOn: false, threshold: 20, stockOn: true, verdictOn: false },
  { profit: null, verdict: "CHECK", inStock: false },
  { profit: null, verdict: "CHECK", inStock: true }
);
assert(stock.join(",") === "stock", "stock alerts fire only when a real stock flag arrives");

console.log("flow.test.js OK");
