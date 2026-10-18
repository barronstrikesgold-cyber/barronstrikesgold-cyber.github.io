"use strict";
/* lib/valuation.js: sell-or-keep rules, projection honesty, pop, lot offers, proxy sanitizing. */
const fs = require("fs");
const path = require("path");
const V = require("../lib/valuation.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
const near = (a, b) => Math.abs(a - b) < 0.011;

// fee math
assert(near(V.net(100), 82), "net = sold × 0.87 − 5");
assert(near(V.costWithTax(10, 9.7), 10.97), "cost includes 9.7% tax");

// guide text parsing (catalog strings)
const g = V.parseGuide("HWPriceGuide sales-based guide: avg $96, 24 recent sales, 30-day range $70–$150");
assert(g && g.avg === 96 && g.count === 24 && g.low === 70 && g.high === 150 && g.days === 30, "parses guide avg/count/range");
assert(V.parseDate("Oct 2026").approx === true, "month-only dates are approximate");
assert(V.parseDate("2026-10-10").date === "2026-10-10", "ISO date");

function series(start, days, prices) {
  return prices.map((p, i) => ({ price: p, date: new Date(Date.parse(start) + i * days * 86400000).toISOString().slice(0, 10), source: "test", kind: "sold" }));
}
const rising = V.points(series("2026-06-01", 10, [10, 11, 12, 13.5, 15, 16, 18, 20]));
const falling = V.points(series("2026-06-01", 10, [20, 18, 16, 15, 13.5, 12, 11, 10]));
const flat = V.points(series("2026-06-01", 10, [10, 10.1, 9.9, 10, 10.05, 9.95]));
assert(V.trend(rising).dir === "rising", "rising trend");
assert(V.trend(falling).dir === "falling", "falling trend");
assert(V.trend(flat).dir === "flat", "flat trend");
assert(V.trend(rising.slice(0, 2)).dir === "unknown", "2 sales is not a trend");

// recommendation rules
assert(V.recommend({ sold: 20, unitCost: 5, trend: V.trend(rising) }).action === "HOLD", "hold if rising");
assert(V.recommend({ sold: 20, unitCost: 5, trend: V.trend(falling) }).action === "SELL", "sell if falling");
assert(V.recommend({ sold: 20, unitCost: 5, trend: { dir: "unknown" }, spike: { past: true, reason: "peaked" } }).action === "SELL", "sell past the release spike");
const keep = V.recommend({ sold: 6, unitCost: 5.48, trend: { dir: "flat", reason: "" } });
assert(keep.action === "KEEP" && keep.profit < 0, "keep when eBay net does not cover cost");
assert(V.recommend({ sold: null }).action === "UNKNOWN", "no sold comp = unknown");
assert(V.recommend({ sold: 50, unitCost: 10.97, trend: { dir: "unknown", reason: "thin" } }).reasons.join(" ").includes("× 0.87 − $5"), "reasons show the net math");

// release spike
const spikePts = V.points([{ price: 40, date: "2026-07-05" }, { price: 45, date: "2026-07-12" }, { price: 30, date: "2026-09-20" }]);
assert(V.releaseSpike(spikePts, "2026-07-01", "2026-10-01").past === true, "past the release spike");
assert(V.releaseSpike(spikePts, "2026-09-20", "2026-10-01").inWindow === true, "inside the release window");

// projection honesty
const thin = V.project(V.points(series("2026-10-01", 3, [10, 11, 12])));
assert(thin.ok === false && /^Not enough data/.test(thin.reason), "thin sales say not enough data");
const p = V.project(rising, 90);
assert(p.ok && p.label === "Projection, not a promise." && p.low <= p.mid && p.mid <= p.high && /Log-linear/.test(p.method), "projection has method, range, label");
assert(p.mid <= 40 && p.mid >= 10, "projection capped at 0.5–2× last sale");
assert(["high", "medium", "low"].indexOf(p.confidence) !== -1, "projection has confidence");

// grading pop
assert(/No pop data/.test(V.popInfo({ lane: "hot-wheels" }).text), "Hot Wheels: no pop data");
assert(V.popInfo({ lane: "pokemon" }).status === "needs-proxy", "cards need the PSA proxy");
assert(V.popInfo({ lane: "pokemon" }, { total: 1200, psa10: 300 }).status === "ok", "proxy pop shows");

// flags
assert(V.flags("'23 Ram 1500 Super", "", "hot-wheels").join() === "STH", "price-list 'Super' suffix = STH on diecast");
assert(V.flags("Mario Kart Super", "", "other").length === 0, "'Super' is not STH outside diecast");
assert(V.flags("Fast Fish", "Treasure Hunt").join() === "TH", "TH from read text");

// lot offers
const o80 = V.offer(80);
assert(o80.offer === 45 && o80.basis === "comp", "offer(80) = (80×0.87−5)×0.7 stepped = 45");
const o80m = V.offer(80, { margin: 0.5 });
assert(o80m.offer === 32, "margin is configurable");
assert(V.offer(2).offer === 0.25 && V.offer(2).basis === "floor", "commons get the floor");
assert(V.offer(null).verify === true && V.offer(null).offer === 0.25, "no comp = floor + verify");
assert(V.offer(10, { floor: 1 }).offer >= 1, "floor is configurable");
assert(V.offer(30, { confidence: 0.4 }).verify === true, "low confidence = verify");
assert(V.offer(30, { confidence: 0.9 }).verify === false, "good match is not verify");
// default leaves at least 30% of net as profit
[12, 25, 80, 300].forEach((s) => { const o = V.offer(s); assert(V.net(s) - o.offer >= 0.3 * V.net(s) - 0.01, "≥30% profit at sold " + s); });

const rows = [
  { name: "=HYPERLINK(\"x\")", qty: 2, sold: 80, offer: 45, flags: ["STH"], score: 0.9 },
  { name: "Common", qty: 3, sold: null, offer: 0.25, verify: true },
];
const t = V.lotTotals(rows);
assert(t.count === 5 && near(t.offer, 90.75) && t.verify === 3 && t.flagged === 2, "lot totals");
const csv = V.lotCsv(rows, { margin: 0.3, floor: 0.25 });
assert(csv.includes("'=HYPERLINK") && csv.split("\n")[0].startsWith("#,Item,Qty"), "CSV guards formulas");
assert(/Lot total/.test(csv) && V.lotText(rows, {}).includes("$90.75"), "CSV and share text carry the total");

// proxy: off by default, https only, sanitized answers
const store = (v) => ({ getItem: () => v });
assert(V.proxyUrl(store(null)) === "", "proxy off by default");
assert(V.proxyUrl(store("http://x.dev")) === "", "proxy needs https");
assert(V.proxyUrl(store("https://w.example.dev/")) === "https://w.example.dev", "proxy url trimmed");
let sent = null;
const fakeFetch = (url, init) => { sent = { url, body: JSON.parse(init.body), creds: init.credentials }; return Promise.resolve({ ok: true, json: () => Promise.resolve({ sales: [{ price: "12.5", date: "2026-10-01", url: "javascript:alert(1)", title: "x" }, { price: "x", date: "bad" }], current: { price: 11, source: "PriceCharting" }, pop: { total: 9, psa10: 2 } }) }); };

V.askProxy("https://w.example.dev", { q: "Charizard", code: "4/102", lane: "pokemon", psaSpec: "abc123" }, fakeFetch).then((ans) => {
  assert(sent.url === "https://w.example.dev/value" && sent.creds === "omit" && sent.body.psaSpec === "123", "proxy request is minimal");
  assert(ans.sales.length === 1 && ans.sales[0].url === "" && ans.sales[0].price === 12.5, "proxy sales sanitized");
  assert(ans.current.price === 11 && ans.pop.total === 9, "proxy current and pop");

  // valuate: published comp already in history is not double counted
  const comp = { id: "c:x", value: 96, source: "HWPriceGuide sales-based guide: avg $96, 24 recent sales, 30-day range $70–$150", date: "Oct 2026", url: "" };
  const v = V.valuate({ comp, history: [{ date: "2026-10-12", price: 96, source: comp.source, kind: "guide" }], today: "2026-10-18", unitCost: 10.97, item: { lane: "hot-wheels" } });
  assert(v.recent.length === 1 && v.guide.avg === 96 && v.projection.ok === false && /No pop data/.test(v.pop.text), "valuate: dedupe, guide, honest projection, pop");
  assert(v.rec.action === "SELL" && v.rec.profit > 0, "valuate: positive net with unknown trend = sell");

  // published price history file
  const hist = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/market-history.json"), "utf8"));
  const ids = Object.keys(hist.series);
  assert(ids.length > 50 && ids.every((id) => /^[mc]:/.test(id)), "history keyed by comp id");
  assert(ids.every((id) => hist.series[id].every((pt) => /^\d{4}-\d{2}-\d{2}$/.test(pt.date) && pt.price > 0 && (!pt.url || /^https:\/\//.test(pt.url)))), "history points are dated, priced, https");
  console.log("valuation.test.js OK", ids.length, "history series");
}).catch((e) => { console.error("FAIL:", e && e.message); process.exit(1); });
