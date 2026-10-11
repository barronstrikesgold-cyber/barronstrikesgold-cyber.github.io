import { saleIso, parseSwappaSales, averageSales, parseHwAverage, parseBricklinkNew, acceptProduct, hwScore } from "../scripts/market-comps.mjs";

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

assert(saleIso("Oct", "10", "2026-10-11") === "2026-10-10", "October sale stays in the current year");
assert(saleIso("Dec", "2", "2026-01-15") === "2025-12-02", "a December sale seen in January is the prior year");

const swappa = parseSwappaSales(
  "Sampling of recent sales Oct 10 Mint Wi-Fi 64 GB $295 Oct 9 Good Wi-Fi 128 GB $410 Oct 8 New $424 Close",
  "2026-10-11",
);
assert(swappa.length === 3, "swappa parser reads recent sales");
assert(swappa[0].condition === "Mint" && swappa[0].price === 295 && swappa[0].date === "2026-10-10", "first swappa row");
const wifi64 = swappa.filter((row) => /wi-fi/i.test(row.detail) && row.detail.includes("64"));
assert(averageSales(wifi64).sold === 295 && averageSales(wifi64).count === 1, "filtered average");

const hw = parseHwAverage('<p class="label">Recent sales</p><p class="value">17</p><p class="label">Average</p><p class="value"><span>$</span><span>9</span></p>');
assert(hw && hw.sold === 9 && hw.count === 17, "hw average comes from the recent-sales block");
assert(parseHwAverage("<p>Average</p><p><span>9</span></p>") === null, "an average with no sales count is not a sold");

const brick = parseBricklinkNew("Last 6 Months Sales Times Sold: 25 Total Qty: 30 Min Price: US $90.00 Avg Price: US $133.21 Times Sold: 10 Total Qty: 10 Min Price: US $40.00 Avg Price: US $102.78");
assert(brick && brick.sold === 133.21 && brick.count === 25, "bricklink uses the first new-sales average");

assert(acceptProduct("Reality Fracture play booster display", "Reality Fracture - Play Booster Display"), "play booster display matches the set");
assert(!acceptProduct("Marvel: Darkhold Destiny play booster display", "Marvel Super Heroes - Play Booster Display"), "a different Marvel set is not Darkhold Destiny");
assert(!acceptProduct("Immortal Phoenix booster box", "Legendary Duelists: Immortal Destiny Booster Box"), "Immortal Destiny is not Immortal Phoenix");
assert(!acceptProduct("Star Trek Commander commander deck", "Star Trek Commander Deck - Landing Party (Collector's Edition)"), "one subtitled deck is not the commander set");
assert(acceptProduct("Hyperia City booster box", "Disney Lorcana: Hyperia City Booster Box"), "Hyperia City booster box matches");
assert(acceptProduct("Pokémon 30th Celebration elite trainer box", "30th Celebration Elite Trainer Box"), "30th Celebration ETB matches");
assert(!acceptProduct("Pokémon Tech Sticker", "Black Bolt Tech Sticker Collection"), "Tech Sticker does not match a different collection");
assert(!acceptProduct("Pokémon TCG 30th Celebration", "30th Celebration Ditto Premium Collection"), "the 30th set is not the Ditto collection");
assert(acceptProduct("Beyond the Brave booster box", "Beyond the Brave Booster Box [1st Edition]"), "a 1st edition booster box still matches the set");
assert(!acceptProduct("Pokémon TCG · 30th Celebration", "30th Celebration Elite Trainer Box"), "the set record is not the ETB");
assert(!acceptProduct("EXTRA BOOSTER -ONE PIECE HEROINES EDITION vol.2- [EB-05]", "Extra Booster: One Piece Heroines Edition Vol.2 - Booster Box"), "an extra booster is not a booster box");
assert(acceptProduct("BOOSTER PACK -THE DOMINANCE OF GOD- [OP-18]", "The Dominance of God Booster Pack"), "a named booster pack matches");
assert(!acceptProduct("BOOSTER PACK -THE DOMINANCE OF GOD- [OP-18]", "The Dominance of God Booster Box"), "a booster pack is not the box");
assert(hwScore("Hot Wheels RLC Exclusive 1993 Mazda RX-7 R1", "/item/2026-red-line-club-1993-mazda-rx-7-r1/") === 1, "RLC mazda slug matches the casting");
assert(hwScore("'85 Porsche 911 Rally Super Chase", "/item/2025-mainlines-porsche-911-rallye/") < 0.8, "a Hot Wheels mainline is not a full Matchbox name match");

console.log("market-comps.test.mjs OK");
