"use strict";

const fs = require("fs");
const path = require("path");
const Market = require("../lib/market.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");
const file = JSON.parse(fs.readFileSync(path.join(root, "data", "market.json"), "utf8"));
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/refresh-market.yml"), "utf8");
const publish = fs.readFileSync(path.join(root, ".github/workflows/publish.yml"), "utf8");

assert(Market.netOf(100) === 82, "100 sold nets to 82");
assert(Market.netOf(null) === null, "a missing sold has no net");
const unverified = Market.finalize({ sold: 40, soldUrl: "", soldSource: "shop ask", retail: 10, name: "x" });
assert(unverified.verdict === "CHECK" && unverified.sold === null && unverified.net === null, "an unverified sold stays CHECK");
const noDate = Market.finalize({
  sold: 100,
  soldUrl: "https://example.com/sold",
  soldSource: "TCGplayer sales",
  retail: 20,
  liquid: true,
});
assert(noDate.verdict === "CHECK" && noDate.sold === null, "a sold without a date stays CHECK");
const buy = Market.finalize({
  sold: 200,
  soldUrl: "https://example.com/sold",
  soldSource: "TCGplayer sales",
  soldDate: "2026-10-10",
  retail: 50,
  liquid: true,
});
assert(buy.verdict === "BUY" && buy.net === 169, "a liquid net that beats retail × 1.09 by $15 is BUY");
const pass = Market.finalize({
  sold: 20,
  soldUrl: "https://example.com/sold",
  soldSource: "TCGplayer sales",
  soldDate: "2026-10-10",
  retail: 50,
  liquid: true,
});
assert(pass.verdict === "PASS" && pass.net === 12.4, "a net under retail is PASS");
const middle = Market.finalize({
  sold: 80,
  soldUrl: "https://example.com/sold",
  soldSource: "TCGplayer sales",
  soldDate: "2026-10-10",
  retail: 50,
  liquid: true,
});
assert(middle.verdict === "CHECK" && middle.net === 64.6, "a net between retail and the buy bar is CHECK");
const illiquid = Market.finalize({
  sold: 200,
  soldUrl: "https://example.com/sold",
  soldSource: "TCGplayer sales",
  soldDate: "2026-10-10",
  retail: 50,
  liquid: false,
});
assert(illiquid.verdict === "CHECK", "an illiquid win stays CHECK");
const noRetail = Market.finalize({
  sold: 100,
  soldUrl: "https://example.com/sold",
  soldSource: "TCGplayer sales",
  soldDate: "2026-10-10",
  retail: null,
  liquid: true,
});
assert(noRetail.verdict === "CHECK" && noRetail.sold === 100, "a sold with no retail stays CHECK");
const feed = Market.latestFeed([
  { name: "b", feed: true, release: "2026-10-20" },
  { name: "a", feed: true, release: "2026-10-13" },
  { name: "old", feed: true, release: "2026-10-01" },
  { name: "nofeed", feed: false, release: "2026-10-12" },
], "2026-10-11");
assert(feed.map((item) => item.name).join(",") === "a,b", "latest feed is soonest first");

const ids = file.sections.map((section) => section.id);
["pokemon", "magic", "onepiece", "lorcana", "yugioh", "sports", "sneakers", "lego", "funko", "apple", "consoles", "matchbox", "mattel"].forEach((id) => {
  assert(ids.indexOf(id) !== -1, "section " + id);
});
["pokemon", "magic", "onepiece", "lorcana", "yugioh", "sports", "sneakers", "lego", "apple", "consoles", "matchbox", "mattel"].forEach((id) => {
  const section = file.sections.find((row) => row.id === id);
  assert(section.items.length > 0, id + " has rows from a public source");
});
const funko = file.sections.find((row) => row.id === "funko");
assert(funko.items.length > 0, "Funko exclusives come from an alternate source when Funko.com is blocked");
assert(/tcgplayer/i.test(funko.note) && !/invented a sold/i.test(funko.note), "Funko note names the alternate source");
const pokemon = file.sections.find((row) => row.id === "pokemon");
assert(pokemon.items.some((item) => /mega evolution/i.test(item.name) && /elite trainer box/i.test(item.name)), "Mega Evolution ETBs are listed");
assert(pokemon.items.some((item) => /league battle deck/i.test(item.name)), "League Battle decks are listed");
assert(pokemon.items.some((item) => /world championship deck/i.test(item.name)), "Worlds decks are listed");
assert(/BUY/.test(file.formula) && /PASS/.test(file.formula), "formula states BUY and PASS");
const refresh = fs.readFileSync(path.join(root, "scripts/refresh-market.mjs"), "utf8");
assert(refresh.includes("applyMarketComps"), "daily refresh attaches sold comps");

const all = [];
file.sections.forEach((section) => section.items.forEach((item) => all.push(item)));
all.forEach((item) => {
  assert(item.verdict === "BUY" || item.verdict === "PASS" || item.verdict === "CHECK", item.id + " verdict");
  assert(item.street == null, item.id + " has no invented street price");
  if (item.sold == null) {
    assert(item.net == null, item.id + " net stays blank without a sold");
    assert(item.verdict === "CHECK", item.id + " is CHECK without a sold");
  } else {
    assert(/^https:\/\//.test(item.soldUrl || ""), item.id + " sold has a source URL");
    assert(/^\d{4}-\d{2}-\d{2}/.test(item.soldDate || ""), item.id + " sold has a date");
    assert(String(item.soldSource || "").trim().length > 3, item.id + " sold names a source");
    assert(item.net === Market.netOf(item.sold), item.id + " net is sold × 0.87 − 5");
    assert(item.verdict === Market.verdictFor(item), item.id + " verdict matches the sold rule");
  }
  if (item.verdict === "BUY") {
    assert(item.liquid === true, item.id + " BUY is liquid");
    assert(item.net >= item.retail * 1.09 + 15, item.id + " BUY clears the bar");
  }
  if (item.verdict === "PASS") {
    assert(item.net < item.retail, item.id + " PASS is under retail");
  }
});

file.sections.find((row) => row.id === "consoles").items.forEach((item) => {
  assert(/switch/i.test(item.name) && /system|bundle|edition/i.test(item.name), "console is a Switch 2 edition: " + item.name);
  assert(Number(item.retail) >= 400, "console price is a system price");
});
file.sections.find((row) => row.id === "sneakers").items.forEach((item) => {
  assert(Number(item.retail) > 0 && item.sold == null, "sneaker retail is Nike's and the resale average was not invented");
  assert(/ask/i.test(item.soldSource || ""), "sneaker note says asks were not used as solds");
});
file.sections.find((row) => row.id === "onepiece").items.forEach((item) => {
  assert(Number(item.retail) > 0, "One Piece row keeps an official MSRP");
});
file.sections.find((row) => row.id === "lego").items.forEach((item) => {
  assert(Number(item.retail) > 0, "LEGO price is the shelf price");
  if (item.sold != null) assert(/bricklink/i.test(item.soldUrl) && /bricklink/i.test(item.soldSource), "LEGO sold is a BrickLink comp");
});
file.sections.find((row) => row.id === "apple").items.forEach((item) => {
  if (item.sold != null) assert(/swappa\.com/i.test(item.soldUrl), "Apple sold is a Swappa comp");
});
file.sections.find((row) => row.id === "matchbox").items.forEach((item) => {
  if (item.sold != null) assert(/hwpriceguide\.com\/item\/[^"]*(matchbox|super-chase)/i.test(item.soldUrl), "Matchbox sold is a Matchbox guide page");
});
file.sections.find((row) => row.id === "mattel").items.forEach((item) => {
  if (item.sold != null) {
    assert(/hwpriceguide\.com\/item\//i.test(item.soldUrl), "Mattel sold is an HWPriceGuide page");
    assert(/rlc|elite|red-line/i.test(item.soldUrl), "Mattel sold stays on an RLC or Elite page");
    assert(/HWPriceGuide/i.test(item.soldSource), "Mattel sold names HWPriceGuide");
  }
});
file.sections.find((row) => row.id === "pokemon").items.forEach((item) => {
  if (/mega evolution|league battle|world championship/i.test(item.name)) {
    assert(item.retail == null, item.name + " has no invented MSRP");
  }
});

const latest = Market.latestFeed(all, "2026-10-11");
assert(latest.length > 0, "latest feed has rows on 2026-10-11");
for (let i = 1; i < latest.length; i += 1) {
  assert(String(latest[i].release) >= String(latest[i - 1].release), "latest feed stays sorted");
}
assert(!sw.includes("data/market.json"), "market json is not precached");
assert(workflow.includes("cron:") && workflow.includes("npm test") && workflow.includes("data/market.json"), "daily workflow tests before it commits");
assert(!publish.includes("refresh-market"), "Pages publish does not run the market refresh");

console.log("market.test.js OK");
