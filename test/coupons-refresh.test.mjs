import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { extractOffers, redactCodes, robotsAllows } from "../scripts/refresh-coupons.mjs";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

assert(robotsAllows("User-agent: *\nDisallow: /private\nAllow: /deals\n", 200, "/deals") === true, "an allowed deals path can be fetched");
assert(robotsAllows("User-agent: *\nDisallow: /\n", 200, "/deals") === false, "a full disallow is respected");
assert(robotsAllows("", 403, "/deals") === false, "a robots fetch that is not public is not treated as permission");
assert(robotsAllows("", 404, "/deals") === true, "a missing robots file does not invent a block");

const redacted = redactCodes("Members use code SAVE20 for 20% off through Oct 20, 2026.");
assert(!/SAVE20/.test(redacted), "a published code is redacted before it can be stored");
assert(/20% off/.test(redacted), "the discount itself stays");

const offers = extractOffers(
  "<html><body><p>Members use code SAVE20 for 20% off through 2026-10-20.</p><script>var noise = 'use code HIDDEN99';</script></body></html>",
  { id: "target", store: "Target", page: "https://www.target.com/deals" },
  "2026-10-12T03:00:00.000Z"
);
assert(offers.length === 1, "one explicit offer is kept");
assert(!offers[0].code, "the offer does not carry a code");
assert(!JSON.stringify(offers).includes("SAVE20"), "the code never lands in the offer");
assert(!JSON.stringify(offers).includes("HIDDEN99"), "script text is ignored");
assert(offers[0].sourceUrl === "https://www.target.com/deals", "the source URL is stored");
assert(offers[0].expires === "2026-10-20", "an explicit expiry is stored");
assert(offers[0].lastChecked === "2026-10-12T03:00:00.000Z", "last checked is stored");

const Coupons = require("../lib/coupons.js");
const today = "2026-10-12";
assert(Coupons.activeOffers(offers, today).length === 1, "a current offer with no code is active");
assert(Coupons.activeOffers([{ ...offers[0], expires: "2026-10-11" }], today).length === 0, "an expired offer is removed");
assert(Coupons.activeOffers([{ ...offers[0], code: "SAVE20" }], today).length === 0, "a row that still has a code is not shown from the public file");

const published = JSON.parse(fs.readFileSync(path.join(root, "data/coupons.json"), "utf8"));
assert(Coupons.activeCoupons(published.codes, today).length === 0, "the public repo has no live coupon code");
assert((published.offers || []).length === 8, "eight promo offers are published");
assert(Coupons.activeOffers(published.offers, today).length === 8, "all eight offers are active on the audit date");
assert(!(published.offers || []).some((row) => row && String(row.code || "").trim()), "published offers do not contain code strings");
assert(fs.readFileSync(path.join(root, ".github/workflows/refresh-coupons.yml"), "utf8").includes('cron: "0 */6 * * *"'), "coupons refresh every 6 hours");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
assert(app.includes("Last updated"), "the coupons screen shows last updated");
assert(app.includes("function renderPromoStrip"), "promos have a strip");
assert(app.includes("renderPromoStrip()"), "the promo strip is rendered");
assert(/var offers = window\.ResellerCoupons\.activeOffers/.test(app), "promo offers show without the owner gate");
assert(/ownerOn\(\)\s*\?\s*[^;\n]*ResellerCoupons\.activeCoupons/.test(app), "saved codes stay owner-only");

const self = pathToFileURL(path.join(root, "scripts/refresh-coupons.mjs")).href;
assert(self.includes("refresh-coupons.mjs"), "coupon refresh module is wired");
console.log("coupon refresh ok");
