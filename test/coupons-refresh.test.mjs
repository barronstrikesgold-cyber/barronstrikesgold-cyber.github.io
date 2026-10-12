import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { extractOffers, publicCode, parseAffiliate, readDates, robotsAllows, refreshCoupons, STORES } from "../scripts/refresh-coupons.mjs";

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

assert(publicCode("Members use code SAVE20 for 20% off") === "SAVE20", "a code printed next to an offer is kept");
assert(publicCode("use code FREE today") === "", "a plain word is not a code");
assert(!publicCode("<script>use code HIDDEN99</script>"), "script text is not a code source");

const rich = extractOffers(
  "<html><body><p>Online only. Use code SAVE20 for 20% off orders over $50 on sneakers. Excludes clearance. Cannot be combined. Valid from October 1, 2026 through October 20, 2026.</p><script>var noise = 'use code HIDDEN99';</script></body></html>",
  { id: "target", store: "Target", page: "https://www.target.com/deals", sourceKind: "official" },
  "2026-10-12T03:00:00.000Z"
);
assert(rich.length === 1, "one explicit offer is kept");
assert(rich[0].code === "SAVE20", "the printed code is stored");
assert(!JSON.stringify(rich).includes("HIDDEN99"), "script text is ignored");
assert(rich[0].offer === "20% off", "the offer text is stored");
assert(rich[0].minimum === "$50", "minimum spend is stored");
assert(/clearance/i.test(rich[0].exclusions), "exclusions are stored");
assert(/sneaker/i.test(rich[0].eligible), "eligible items are stored");
assert(rich[0].starts === "2026-10-01", "the start date is stored");
assert(rich[0].expires === "2026-10-20" && rich[0].expiryStated === true, "the end date is stored");
assert(/cannot be combined/i.test(rich[0].stacking), "stacking rules are stored");
assert(rich[0].channel === "Online", "online-only is stored");
assert(rich[0].sourceUrl === "https://www.target.com/deals", "the source URL is stored");
assert(rich[0].sourceKind === "official", "the source is official");
assert(rich[0].lastChecked === "2026-10-12T03:00:00.000Z", "last verified is stored");

const dates = readDates("from October 1, 2026 through October 20, 2026");
assert(dates.starts === "2026-10-01" && dates.ends === "2026-10-20", "from and through dates stay apart");

const affiliate = parseAffiliate(JSON.stringify([{ store: "Nike", offer: "20% off", code: "AFF20", sourceUrl: "https://www.nike.com/w/sale-3yaep", expires: "2026-10-20", minimum: "$75" }]), "2026-10-12T03:00:00.000Z");
assert(affiliate.length === 1 && affiliate[0].code === "AFF20" && affiliate[0].sourceKind === "affiliate", "an affiliate feed code is kept with its source");
assert(parseAffiliate(JSON.stringify([{ store: "Nike", code: "LEAK9", sourceUrl: "" }]), "2026-10-12T03:00:00.000Z").length === 0, "a code with no source URL is dropped");

const Coupons = require("../lib/coupons.js");
const today = "2026-10-12";
assert(Coupons.activeOffers(rich, today).length === 1, "a current official offer is active");
assert(Coupons.activeOffers([{ ...rich[0], expires: "2026-10-11" }], today).length === 0, "an expired offer is removed");
assert(Coupons.activeOffers([{ ...rich[0], sourceKind: "leaked" }], today).length === 0, "a leaked code is not shown");
assert(Coupons.activeOffers([{ ...rich[0], code: "SAVE20" }], today).length === 1, "a code printed on an official page is shown");

const kept = await refreshCoupons({
  offers: [{
    sourceId: "nike",
    store: "Nike",
    offer: "10% off",
    discount: "10% off",
    code: "",
    sourceUrl: "https://www.nike.com/w/sale-3yaep",
    sourceKind: "official",
    expires: "2026-10-20",
    expiryStated: true,
    lastChecked: "2026-10-11T00:00:00.000Z",
    active: true,
  }],
}, "2026-10-12T00:00:00.000Z", async (url) => {
  if (String(url).includes("robots.txt")) return { status: 200, body: "User-agent: *\nAllow: /\n" };
  if (String(url).includes("nike.com")) return { status: 0, body: "", error: "timeout" };
  return { status: 200, body: "<html><body>No sale</body></html>" };
});
assert(kept.offers.some((row) => row.sourceId === "nike" && row.offer === "10% off"), "a source that cannot be reached keeps its unexpired offer");

const storeIds = JSON.parse(fs.readFileSync(path.join(root, "data/stores.json"), "utf8")).map((row) => row.id);
const covers = new Set(STORES.flatMap((row) => row.covers || []));
storeIds.forEach((id) => assert(covers.has(id), id + " has an official promo page"));
["pokemon", "magic", "onepiece", "lorcana", "yugioh", "sports", "sneakers", "designer", "lego", "funko", "apple", "consoles", "matchbox", "mattel"].forEach((id) => {
  assert(covers.has(id), id + " has an official promo page");
});

const published = JSON.parse(fs.readFileSync(path.join(root, "data/coupons.json"), "utf8"));
assert(Array.isArray(published.offers), "offers are a list");
(published.offers || []).forEach((row) => {
  assert(row.sourceKind === "official" || row.sourceKind === "affiliate", row.id + " is official or affiliate");
  assert(/^https:\/\//.test(row.sourceUrl || ""), row.id + " has a source URL");
  assert(row.example !== true, row.id + " is not a fixture");
  ["offer", "minimum", "exclusions", "eligible", "starts", "expires", "stacking", "channel", "lastChecked"].forEach((key) => {
    assert(Object.prototype.hasOwnProperty.call(row, key), row.id + " stores " + key);
  });
});
(published.codes || []).forEach((row) => {
  assert(String(row.code || "").trim(), "a code row has a code");
  assert(/^https:\/\//.test(row.sourceUrl || ""), "a code row has a source URL");
});
assert(Coupons.activeOffers(published.offers, today).length === (published.offers || []).filter((row) => String(row.expires || "") >= today).length, "active offers match the unexpired public list");
assert(fs.readFileSync(path.join(root, ".github/workflows/refresh-coupons.yml"), "utf8").includes('cron: "0 */6 * * *"'), "coupons refresh every 6 hours");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
assert(app.includes("Last verified"), "the coupons screen shows last verified");
assert(app.includes('data-action="copy-code"'), "a code has a copy button");
assert(app.includes("function renderPromoStrip"), "promos have a strip");
assert(app.includes("renderPromoStrip()"), "the promo strip is rendered");
assert(/var offers = window\.ResellerCoupons\.activeOffers/.test(app), "promo offers show without the owner gate");
assert(/ownerOn\(\)\s*\?\s*[^;\n]*ResellerCoupons\.activeCoupons/.test(app), "saved codes stay owner-only");

const self = pathToFileURL(path.join(root, "scripts/refresh-coupons.mjs")).href;
assert(self.includes("refresh-coupons.mjs"), "coupon refresh module is wired");
console.log("coupon refresh ok");
