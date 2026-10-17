"use strict";

/* Search by case guard: case codes parse, the case data is sourced, TH/STH are right, unknowns stay unknown. */
const fs = require("fs");
const path = require("path");
const C = require("../lib/hw-cases.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/hw/cases-2026.json"), "utf8"));

/* codes */
let q = C.parseQuery("JJK58-N9C0N");
assert(q && q.toy === "JJK58" && q.letter === "N" && q.year === 2026, "JJK58-N9C0N is case N, toy JJK58");
q = C.parseQuery("JJL74-N9C0P");
assert(q && q.toy === "JJL74" && q.letter === "P", "JJL74-N9C0P is case P");
q = C.parseQuery("L2593-973N");
assert(q && q.assort === "L2593" && q.letter === "N", "L2593-973N is case N on US cards");
q = C.parseQuery("C4982-99NL");
assert(q && q.assort === "C4982" && q.letter === "L", "C4982-99NL is case L");
q = C.parseQuery("L2593-976K PN");
assert(q && q.letter === "K", "the letter before the mix tag is the case");
q = C.parseQuery("C4982");
assert(q && q.assort === "C4982" && q.letter === "", "a bare C4982 asks for the case letter");
assert(C.parseQuery("2026 N").letter === "N" && C.parseQuery("N 2026").letter === "N" && C.parseQuery("case p").letter === "P" && C.parseQuery("Q case").letter === "Q", "year + letter and 'case X' forms");
assert(C.parseQuery("JDP89-0910") === null, "a Monster Trucks item code is not a case code");
assert(C.parseQuery("JJK58") === null && C.parseQuery("case I") === null && C.parseQuery("2026 O") === null, "no case without a letter; I and O are not case letters");
assert(C.LETTERS.join("") === "ABCDEFGHJKLMNPQ", "15 case letters, no I or O");

/* OCR text from a case box */
const boxText = "HOT WHEELS\nBASIC CAR ASST.\nL2593-973N PN\n72 PCS\nMADE IN MALAYSIA";
const found = C.casesIn(boxText);
assert(found.length === 1 && found[0].letter === "N" && found[0].assort === "L2593", "OCR of a case-box label finds L2593-973N");

/* data: sourced, owner's known facts */
const n = data.cases.N;
const p = data.cases.P;
assert(n.status === "listed" && /^https:\/\/orangetrackdiecast\.com\//.test(n.source), "case N is listed with its source");
assert(n.sth.includes("'23 Ram 1500") && n.th.includes("Fast Fish"), "case N: STH '23 Ram 1500, TH Fast Fish");
assert(p.sth.includes("'70 Plymouth AAR Cuda") && p.th.some((t) => /Nissan Skyline HT 2000GT-X/.test(t)), "case P: STH '70 AAR Cuda, TH Nissan Skyline HT 2000GT-X");
const ram = n.cars.find((c) => c.toy === "JJK58");
assert(ram && ram.colorConfirmed && /^assets\/hw\/thumbs\//.test(ram.image), "JJK58 (regular '23 Ram 1500) is in case N with a photo");
const sth = n.cars.find((c) => c.tag === "STH");
assert(sth && sth.toy === "JJM27", "the case N STH is toy JJM27 (Hot Wheels Wiki)");
assert(p.cars.some((c) => c.toy === "JJL74"), "JJL74 (Dino 206 GT, 2nd color) is pinned to case P by the owner's card");
Object.keys(data.cases).forEach((L) => {
  const c = data.cases[L];
  assert(C.LETTERS.includes(L), "case letters only");
  if (c.status !== "listed") return;
  assert(/^https:\/\//.test(c.source), "case " + L + " has a source");
  c.cars.forEach((car) => {
    assert(/^\d{3}$/.test(car.col) && car.name, "case " + L + " cars have a collector number and name");
    assert(car.toy || Array.isArray(car.toys), "case " + L + " " + car.name + ": a toy # or the list of candidates");
    if (!car.toy) assert(!car.colorConfirmed, "an unconfirmed color is never marked confirmed");
  });
});
assert(/not published/i.test(data.note), "quantities are marked not published");

/* fee check */
const f = C.feeCheck(95, 1.25);
assert(f.net === 77.65 && f.profit === 76.4 && f.verdict === "BUY", "fee check: 95 x 0.87 - 5 - 1.25");
assert(C.feeCheck(5, 1.25).verdict === "PASS", "a $5 sale loses money after fees");
assert(C.feeCheck(null, 1) === null, "no comp, no fee check");
assert(C.feeCheck(10, "").profit === null, "no cost, no profit line");

/* render */
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const html = C.caseHtml(data, C.parseQuery("JJK58-N9C0N"), { esc, compFor: (car) => (car.tag === "STH" ? { value: 95 } : null), cost: "1.25", highlight: "JJK58" });
assert(/class="flag sth">STH/.test(html) && /class="flag th">TH/.test(html), "STH and TH are flagged");
assert(/Qty per case: not published/.test(html), "quantities say not published");
assert(/Sold \$95\.00 → net \$77\.65 · after cost \+\$76\.40 BUY/.test(html), "the fee check shows on a car with a comp");
assert(/is-hit/.test(html), "the scanned card's car is highlighted");
assert(/No verified sold comp/.test(html), "cars without a comp say so");
const miss = C.caseHtml(data, { year: 2024, letter: "N" }, { esc });
assert(/no case list/i.test(miss), "an unmapped year says so");

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
assert(/loadScript\("lib\/hw-cases\.js"\)/.test(app) && !/hw-cases/.test(fs.readFileSync(path.join(root, "index.html"), "utf8")), "case search is lazy-loaded");
console.log("hw-cases tests ok");
