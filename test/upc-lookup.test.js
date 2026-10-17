"use strict";

/* Barcode lookup guard: Hunt's own data first, then keyless web databases, cached, no keys in the repo. */
const fs = require("fs");
const path = require("path");
const U = require("../lib/upc-lookup.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const fixture = (name) => JSON.parse(read("test/fixtures/upc/" + name + ".json"));

(async function main() {
  /* codes */
  assert(U.isRetailCode("196214105133") && U.isRetailCode("0196214105133") && U.isRetailCode("00196214105133"), "UPC-A, EAN-13, GTIN-14 are retail codes");
  assert(!U.isRetailCode("196214105134"), "bad check digit is not a retail code");
  assert(!U.isRetailCode("JJK58"), "a Mattel code is not a retail code");
  assert(U.gtin14("196214105133") === "00196214105133", "gtin14 pads to 14");
  assert(U.shortForm("0889698487405") === "889698487405", "0-led EAN-13 shortens to UPC-A");
  assert(U.prefixInfo("194735151295").lane === "hot-wheels", "Mattel prefix maps to Hot Wheels");
  assert(U.prefixInfo("196214105133").lane === "pokemon", "Pokémon prefix maps to Pokémon");
  assert(U.prefixInfo("889698487405").lane === "funko", "Funko prefix maps to Funko");
  assert(U.prefixInfo("673419340137").lane === "lego", "LEGO prefix maps to LEGO");
  assert(U.mattelKey("HKL22-N9C0K") === "HKL22" && U.mattelKey("jjk58") === "JJK58", "Mattel card-back and peg codes reduce to the toy number");
  assert(U.mattelCodes("Hot Wheels Track Set JDW39 model HNW46").join(",") === "JDW39,HNW46", "Mattel codes are pulled from text");

  /* lanes */
  [["Hot Wheels Premium Fast & Furious", "", "hot-wheels"], ["Matchbox Moving Parts", "Mattel", "matchbox"], ["Prismatic Evolutions Elite Trainer Box", "", "pokemon"],
    ["POP! Star Wars The Child", "Funko", "funko"], ["Imperial TIE Fighter 75300", "LEGO", "lego"], ["Air Jordan 5 Retro TD", "Nike", "sneakers"], ["Stanley cup", "", "other"]].forEach(function (row) {
    assert(U.laneFor(row[0], row[1]) === row[2], "lane for " + row[0] + " is " + row[2] + ", got " + U.laneFor(row[0], row[1]));
  });

  /* barcode.report parsing (real responses, trimmed) */
  const etb = U.parseBarcodeReport(fixture("barcode-report-pokemon-etb"), "196214105133");
  assert(etb && /Prismatic Evolutions Elite Trainer Box/.test(etb.title), "Pokémon ETB title");
  assert(etb.lane === "pokemon" && etb.brand === "Pokémon", "Pokémon ETB lane and brand, got " + etb.lane + " / " + etb.brand);
  assert(etb.images.length >= 1 && etb.images.every((u) => /^https:\/\//.test(u)), "Pokémon ETB has https images");
  assert(etb.sourceUrl === "https://barcode.report/gtin/00196214105133", "source link goes to barcode.report");
  const funko = U.parseBarcodeReport(fixture("barcode-report-funko"), "889698487405");
  assert(funko.lane === "funko" && funko.brand === "Funko", "Funko lane and brand");
  assert(funko.images[0].indexOf("bbystatic") !== -1, "retailer photo comes first");
  assert(!funko.images.some((u) => /icecat-large\.png/.test(u)), "placeholder images are dropped");
  assert(funko.description.length > 40, "retailer description is kept");
  const hw = U.parseBarcodeReport(fixture("barcode-report-hot-wheels"), "194735151295");
  assert(hw.lane === "hot-wheels" && hw.brand === "Hot Wheels", "Hot Wheels lane and tidy brand, got " + hw.brand);
  assert(hw.mattelCodes.indexOf("HNW46") !== -1, "Mattel assortment code from the evidence is kept for catalog matching");
  assert(hw.images.every((u) => !/^https:\/\/wwww\./.test(u)), "broken wwww hosts are repaired");

  /* other sources */
  const off = U.parseOpenFacts({ status: 1, product: { product_name: "Coca-Cola Classic", brands: "Coca-Cola,Coke", categories: "Beverages,Sodas", image_front_url: "https://images.openfoodfacts.org/x.jpg" } }, "049000028911", "open-food-facts");
  assert(off && off.title === "Coca-Cola Classic" && off.brand === "Coca-Cola" && off.images[0] === "https://images.openfoodfacts.org/x.jpg", "Open Food Facts parses");
  assert(U.parseOpenFacts({ status: 0 }, "049000028911", "open-food-facts") === null, "Open Food Facts miss is null");
  const uidb = U.parseUpcItemDb({ code: "OK", items: [{ title: "Funko POP The Child", brand: "Funko", msrp: "12.99", images: ["http://img.example.com/a.jpg"], lowest_recorded_price: 7.5, highest_recorded_price: 30 }] }, "889698487405");
  assert(uidb.msrp === 12.99 && uidb.images[0] === "https://img.example.com/a.jpg" && uidb.lane === "funko", "UPCitemdb proxy JSON parses with MSRP");

  /* links */
  const links = U.searchLinks("889698487405", "Funko POP The Child");
  const amazon = links.filter((l) => l.id === "amazon")[0];
  assert(amazon && amazon.url.indexOf("tag=hempsply02-20") !== -1 && amazon.url.indexOf("889698487405") !== -1, "Amazon search carries the UPC and the Associates tag");
  assert(links.some((l) => l.id === "google" && l.url.indexOf("tbm=shop") !== -1), "Google Shopping link");
  assert(links.some((l) => l.id === "ebay" && l.url.indexOf("LH_Sold=1") !== -1), "eBay sold link");

  /* lookup order, fallback, cache */
  let calls = [];
  function fakeFetch(map) {
    return function (url) {
      calls.push(url);
      const hit = Object.keys(map).filter((k) => url.indexOf(k) !== -1)[0];
      const body = hit ? map[hit] : null;
      if (body === "offline") return Promise.reject(new TypeError("Failed to fetch"));
      return Promise.resolve({ ok: !!body, status: body ? 200 : 404, json: () => Promise.resolve(body) });
    };
  }
  const cache = U.memoryCache();
  const first = await U.lookup("196214105133", { fetch: fakeFetch({ "barcode.report/api/v1/products/00196214105133": fixture("barcode-report-pokemon-etb") }), cache: cache, now: 1000 });
  assert(first.hit && first.result.lane === "pokemon" && !first.cached, "web lookup hits barcode.report");
  assert(calls[0].indexOf("https://barcode.report/") === 0, "barcode.report is asked first");
  calls = [];
  const again = await U.lookup("0196214105133", { fetch: fakeFetch({}), cache: cache, now: 2000 });
  assert(again.cached && again.hit && calls.length === 0, "a repeat scan (as EAN-13) is served from the phone cache with no network");
  calls = [];
  const fallback = await U.lookup("049000028911", { fetch: fakeFetch({ "openfoodfacts.org/api/v2/product/0049000028911": { status: 1, product: { product_name: "Coca-Cola Classic", brands: "Coca-Cola" } } }), cache: cache, now: 3000 });
  assert(fallback.hit && fallback.result.source === "open-food-facts", "falls through to Open Food Facts");
  assert(fallback.tried.map((t) => t.source).join(",") === "barcode-report,open-products-facts,open-food-facts", "sources run in order without a proxy, got " + fallback.tried.map((t) => t.source).join(","));
  calls = [];
  const withProxy = await U.lookup("889698487405", { fetch: fakeFetch({ "proxy.example.workers.dev": { items: [{ title: "Funko POP The Child", brand: "Funko", msrp: "12.99" }] } }), cache: U.memoryCache(), proxy: "https://proxy.example.workers.dev/lookup", now: 1 });
  assert(withProxy.hit && withProxy.result.source === "proxy" && calls[1].indexOf("https://proxy.example.workers.dev/lookup?upc=889698487405") === 0, "optional owner proxy is second");
  const missCache = U.memoryCache();
  const miss = await U.lookup("012345678905", { fetch: fakeFetch({}), cache: missCache, now: 10 });
  assert(!miss.hit && miss.links.length >= 3, "a miss still offers search links");
  calls = [];
  const missAgain = await U.lookup("012345678905", { fetch: fakeFetch({}), cache: missCache, now: 20 });
  assert(missAgain.cached && calls.length === 0, "a fresh miss is cached");
  calls = [];
  await U.lookup("012345678905", { fetch: fakeFetch({}), cache: missCache, now: 20 + U.MISS_TTL + 1 });
  assert(calls.length > 0, "a stale miss is retried");
  const offlineCache = U.memoryCache();
  await offlineCache.put("00196214105133", { at: 1, hit: true, result: first.result, tried: [] });
  const offline = await U.lookup("196214105133", { fetch: fakeFetch({ "barcode.report": "offline", "openproductsfacts": "offline", "openfoodfacts": "offline" }), cache: offlineCache, now: 1 + U.HIT_TTL + 5 });
  assert(offline.hit && offline.cached, "offline at a show falls back to the stale cached answer");
  const mattel = await U.lookup("JJK58", { fetch: fakeFetch({}), cache: U.memoryCache() });
  assert(!mattel.hit && mattel.tried[0].status === "skip", "Mattel codes skip the web (catalog only)");

  /* Hunt's own code index stays in sync with the HW catalog chunks */
  const builder = await import(path.join(root, "scripts/build-upc-index.mjs"));
  const built = builder.buildIndex();
  const manifest = JSON.parse(read("data/upc/manifest.json"));
  assert(manifest.keys === built.codes.size && manifest.rows === Object.values(built.counts).reduce((a, b) => a + b, 0), "data/upc is stale. Run node scripts/build-upc-index.mjs");
  assert(manifest.counts.hw > 10000, "the HW toy-code index covers the catalog");
  manifest.shards.forEach((s) => assert(fs.existsSync(path.join(root, "data/upc/codes-" + s + ".json")), "missing shard " + s));
  ["JJK58", "HKL22", "GRV13", "0194735", "C4982", "L2593", "_x"].forEach((k) => assert(U.shardOf(k) === builder.shardOf(k), "client and builder agree on the shard for " + k));
  assert(fs.readdirSync(path.join(root, "data/upc")).length === manifest.shards.length + 2, "no stale shard files in data/upc (shards + manifest + assortments)");
  const index = U.codeIndex((p) => Promise.resolve(JSON.parse(read(p))));
  const civic = await index.find("JHX94");
  assert(civic.some((r) => /Honda Civic Type R/.test(r.name) && r.year === 2026), "Mattel peg code JHX94 matches the catalog");
  const cardBack = await index.find("JHX94-N9C0K");
  assert(cardBack.length === civic.length, "a full card-back code matches like the toy number");

  /* Mattel assortment UPCs: one barcode per case (Monster Trucks 1:64 = FYJ44) */
  assert(JSON.stringify(builder.buildAssortments()) === JSON.stringify(JSON.parse(read("data/upc/assortments.json"))), "data/upc/assortments.json is stale. Run npm run upc-index");
  const mtData = JSON.parse(read("data/hw/monster-trucks.json"));
  assert(mtData.items.length >= 150 && mtData.years.indexOf(2025) !== -1 && mtData.years.indexOf(2026) !== -1, "Monster Trucks 1:64 covers the 2025 and 2026 waves");
  mtData.items.forEach((it) => assert(it.code === null || /^[A-Z]{3}\d{2}$/.test(it.code), "Monster Truck codes are real 5-character toy numbers or null (unknown): " + it.name));
  mtData.items.forEach((it) => assert(!it.i || /^https:\/\/static\.wikia\.nocookie\.net\/hotwheels\/images\//.test(it.i), "Monster Truck photos are real Hot Wheels Wiki thumbnails over https: " + it.i));
  assert(read("index.html").includes('<meta name="referrer" content="no-referrer"'), "wiki thumbnails need the no-referrer policy (Fandom refuses a GitHub Pages referrer)");
  ["JDP89", "JCD75", "JCD78", "JCF01", "JCD85", "JCF11", "JDP80", "JDP78"].forEach((code) => assert(mtData.items.some((it) => it.code === code), "Monster Trucks list has " + code));
  const assort = U.assortIndex((p) => Promise.resolve(JSON.parse(read(p))));
  const fyj = await assort.match("887961705393");
  assert(fyj && fyj.key === "FYJ44" && /Monster Trucks/.test(fyj.name), "UPC 887961705393 maps to assortment FYJ44");
  assert((await assort.match("0887961705393")).key === "FYJ44" && (await assort.match("FYJ44")).key === "FYJ44" && (await assort.match("JWL27")).key === "FYJ44", "EAN-13 form, the assortment code, and its aliases map to FYJ44");
  assert((await assort.match("889698487405")) === null && (await assort.match("JDP89")) === null, "ordinary UPCs and item codes are not assortments");
  assert((await assort.match("x", { model: "FYJ44", mattelCodes: [] })).key === "FYJ44", "a web match naming FYJ44 opens the picker");
  const fyjItems = U.sortAssort(await assort.items("FYJ44"));
  assert(fyjItems.some((it) => it.code === "JDP89" && it.name === "TV Series Batmobile" && /^https:\/\/static\.wikia\.nocookie\.net\//.test(it.thumb)), "the FYJ44 picker lists TV Series Batmobile with a photo");
  assert(String(fyjItems[0].years).indexOf("2026") !== -1, "the picker lists the newest year first");
  assert(U.filterAssort(fyjItems, "jdp89-0910").length === 1 && U.filterAssort(fyjItems, "batmobile").length >= 2, "the picker filters by item code (with suffix) or name");
  const bat = await assort.itemByCode("JDP89-0910");
  assert(bat && bat.name === "TV Series Batmobile" && bat.assortment === "FYJ44" && /^https:\/\//.test(bat.thumb), "item code JDP89-0910 resolves to TV Series Batmobile with photo");
  assert((await index.find("JDP89")).some((r) => r.name === "TV Series Batmobile"), "the code index knows Monster Truck item codes");
  const mainline = await assort.items("C4982");
  assert(mainline.some((it) => it.code === "JHX94"), "mainline assortment C4982 lists the current mainline from the HW year index");

  /* wiring */
  const app = read("app.js");
  const ui = read("lib/stock-ui.js");
  const html = read("index.html");
  const sw = read("sw.js");
  const src = read("lib/upc-lookup.js");
  const privacy = read("privacy.html");
  assert(app.includes('loadScript("lib/upc-lookup.js")') && !html.includes("lib/upc-lookup.js"), "the lookup helper loads on demand, not on first paint");
  assert(app.includes("lookupScannedCode(parsed)") && app.includes('data-action="add-scan-code"'), "a scan miss runs the lookup and keeps the bare-code button");
  assert(ui.includes('startLookup(code, "show")') && ui.includes('startLookup(code, "form")'), "Show Mode and the tracker form use the scan lookup");
  assert(ui.includes('referrerpolicy="no-referrer" data-upc-img="1"') && ui.includes("photo-needed.svg"), "web photos load with no referrer and fall back");
  assert(ui.includes('data-stk="res-add"') && ui.includes('data-stk="res-edit"'), "one-tap add and edit-first are on the confirm card");
  assert(ui.includes("imageUrl") && ui.includes("localCopy(") && read("lib/stock.js").includes("imageUrl"), "the photo link is stored with the item, plus a local copy when allowed");
  assert(sw.includes("./lib/upc-lookup.js") && sw.includes("/data/upc/"), "service worker precaches the helper and caches the code index");
  assert(privacy.includes("barcode.report") && privacy.includes("<code>hunt-upc</code>") && privacy.includes("Open Food Facts"), "privacy discloses the third-party barcode lookup");
  assert(!/(api[_-]?key|apikey|user_key|token)\s*[:=]\s*["'][A-Za-z0-9]{12,}/i.test(src) && !/key=[A-Za-z0-9]{12,}/.test(src), "no API key is committed");
  assert(ui.includes("Which one is it?") && ui.includes("Type the item code from the back of the card") && ui.includes('data-stk="assort-pick"'), "an assortment UPC shows the picker and the item-code field");
  assert(ui.includes("assortKeyOf(upc.assortJson, code)") && ui.includes("if (g && !shared) keys.push(g)"), "a shared assortment UPC never learns one item's name");
  assert(sw.includes("./data/upc/assortments.json"), "the assortment list is precached for offline shows");
  assert(!/api\.upcitemdb\.com/.test(src), "UPCitemdb is never called straight from the browser (its CORS blocks this origin)");

  console.log("upc-lookup.test.js OK");
})().catch(function (err) {
  console.error("FAIL:", err && err.stack ? err.stack : err);
  process.exit(1);
});
