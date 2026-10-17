"use strict";

/* Photo identification guard: OCR text -> codes, set numbers, words; ranking; Pokémon parse; search links; vision proxy. */
const fs = require("fs");
const path = require("path");
const P = require("../lib/photo-id.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

(async function main() {
  /* Mattel item codes, with and without the -XXXX suffix, and common OCR slips */
  const card = P.extract("HOT WHEELS MONSTER TRUCKS\nTV SERIES BATMOBILE\nJDP89-0910\nASST. FYJ44\n8 87961 70539 3", { assort: ["FYJ44", "C4982"] });
  assert(card.mattel.includes("JDP89"), "JDP89-0910 gives item code JDP89: " + JSON.stringify(card.mattel));
  assert(card.assort.includes("FYJ44") && !card.mattel.includes("FYJ44"), "FYJ44 is an assortment code, not an item code");
  assert(card.upcs.includes("887961705393"), "spaced UPC digits are read: " + JSON.stringify(card.upcs));
  assert(card.words.includes("BATMOBILE") && card.words.includes("SERIES"), "name words are kept");
  assert(P.extract("toy JDP89 here", {}).mattel[0] === "JDP89", "a bare 5-character code is read");
  assert(P.fixMattel("JDPB9") === "JDP89", "OCR B for 8 inside the digits is fixed");
  assert(P.fixMattel("TRUCK") === null && P.fixMattel("BOOST") === null, "plain words are not item codes");
  assert(P.extract("ASST C4982", { assort: ["FYJ44", "C4982"] }).assort.includes("C4982"), "C4982 is read as an assortment code");

  /* UPCs: check digit enforced */
  assert(P.upcsIn("196214105133").includes("196214105133"), "a valid UPC is read");
  assert(!P.upcsIn("196214105134").length, "a bad check digit is dropped");

  /* set numbers: Pokémon number/total; LEGO only when LEGO is on the box */
  const mew = P.extract("Mew ex HP 180\n158/128", {});
  assert(mew.sets.length && String(mew.sets[0].number) === "158" && String(mew.sets[0].total) === "128", "158/128 is a card number");
  assert(mew.words.includes("MEW"), "card name word kept");
  assert(P.extract("LEGO Star Wars 75192 Millennium Falcon", {}).lego.includes("75192"), "LEGO set number read");
  assert(!P.extract("Order 75192 shipped", {}).lego.length, "a 5-digit number without LEGO is not a set number");

  /* fuzzy name ranking */
  assert(P.scoreName("TV Series Batmobile", ["TV", "SERIES", "BATMOBILE"]) >= 0.8, "full name match scores high");
  assert(P.scoreName("TV Series Batmobile", ["BATMOBLE"]) > 0, "one-letter OCR slip still matches");
  const ranked = P.rank([{ name: "Bone Shaker" }, { name: "TV Series Batmobile" }, { name: "Batman" }], ["TV", "SERIES", "BATMOBILE"], 5, 0.5);
  assert(ranked.length && ranked[0].item.name === "TV Series Batmobile" && ranked.length <= 5, "rank puts the best name first");

  /* Pokémon TCG API: query and parse (fixture from the live keyless API) */
  const q = P.pokemonQuery(mew);
  assert(/api\.pokemontcg\.io\/v2\/cards\?q=/.test(q) && /number%3A158/.test(q) && /printedTotal%3A128/.test(q), "Pokémon query uses number + printed total: " + q);
  const cands = P.parsePokemon(JSON.parse(read("test/fixtures/photo/pokemon-158-128.json")), mew);
  assert(cands[0] && cands[0].cardName === "Mew ex" && /158\/128/.test(cands[0].code) && /30th Celebration/.test(cands[0].line), "158/128 Mew ex resolves to Mew ex, 30th Celebration");
  assert(/^https:\/\//.test(cands[0].image) && /^https:\/\/api\.pokemontcg\.io\//.test(cands[0].sourceUrl) && cands[0].score >= 0.7, "the candidate has a photo, a source URL, and a confidence");

  /* TCGdex fallback when the Pokémon TCG API is busy */
  assert(/api\.tcgdex\.net\/v2\/en\/cards\?localId=158&name=mew/.test(P.tcgdexQuery(mew)), "TCGdex query: number + name");
  const td = P.parseTcgdex([{ id: "xy8-158", localId: "158", name: "Mewtwo EX", image: "https://assets.tcgdex.net/en/xy/xy8/158" }, { id: "30th-158", localId: "158", name: "Mew ex", image: "https://assets.tcgdex.net/en/me/30th/158" }],
    { "30th-158": { id: "30th-158", rarity: "Futuristic Rare", set: { name: "30th Celebration", cardCount: { official: 128 } } }, "xy8-158": { id: "xy8-158", set: { name: "BREAKthrough", cardCount: { official: 162 } } } }, mew);
  assert(td.length === 1 && td[0].cardName === "Mew ex" && td[0].code === "158/128" && /high\.webp$/.test(td[0].image), "TCGdex keeps only the card whose set total matches");

  /* web search links: Amazon carries the tag, Lens is offered */
  const links = P.searchLinks(mew, "hempsply02-20");
  assert(links.some((l) => l.id === "amazon" && /tag=hempsply02-20/.test(l.url)), "Amazon link carries tag hempsply02-20");
  assert(links.some((l) => l.id === "ebay" && /LH_Sold=1/.test(l.url)) && links.some((l) => l.id === "google") && links.some((l) => /lens\.google\.com/.test(l.url)), "eBay sold, Google, and Google Lens links");

  /* optional AI vision: off unless an https proxy URL is saved; guesses are capped and labelled */
  const mem = { v: {}, getItem(k) { return this.v[k] || null; }, setItem(k, x) { this.v[k] = x; } };
  assert(P.visionUrl(mem) === "", "vision is off by default");
  mem.setItem(P.VISION_KEY, "http://insecure.example/");
  assert(P.visionUrl(mem) === "", "an http proxy is refused");
  mem.setItem(P.VISION_KEY, "https://hunt-vision.example.workers.dev/");
  assert(P.visionUrl(mem) === "https://hunt-vision.example.workers.dev/", "an https proxy is used");
  let sent = null;
  const fake = (url, init) => { sent = { url, body: JSON.parse(init.body), creds: init.credentials }; return Promise.resolve({ ok: true, json: () => Promise.resolve({ guesses: [{ name: "Mew ex", brand: "Pokémon", lane: "pokemon", confidence: 0.9 }, { name: "" }, { name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }, { name: "e" }] }) }); };
  const guesses = await P.askVision(P.visionUrl(mem), "data:image/jpeg;base64,AAAA", "158/128 Mew ex", fake);
  assert(sent && sent.body.image.startsWith("data:image/jpeg") && sent.creds === "omit", "the proxy gets the downscaled image, no cookies");
  assert(guesses.length <= 5 && guesses[0].name === "Mew ex" && guesses[0].source === "AI vision (your proxy)" && guesses[0].score === 0.9, "vision guesses are capped, labelled, and scored");
  assert((await P.askVision("", "x", "", fake)).length === 0, "no proxy, no call");
  assert((await P.askVision("https://x.example/", "x", "", () => Promise.reject(new Error("down")))).length === 0, "a dead proxy is ignored");

  /* lazy, keyless OCR */
  assert(/cdn\.jsdelivr\.net\/npm\/tesseract\.js@5/.test(P.TESSERACT.script) && /tesseract\.js-core@5/.test(P.TESSERACT.corePath), "Tesseract.js v5 from jsDelivr");
  const html = read("index.html");
  assert(!/tesseract/i.test(html), "Tesseract is not loaded until a photo is picked");
  const app = read("app.js");
  assert(/loadScript\("lib\/photo-id\.js"\)/.test(app), "photo-id.js is lazy-loaded");
  assert(/accept="image\/\*" capture="environment"/.test(app), "camera capture input");
  assert(/id="photo-library" class="photo-input" type="file" accept="image\/\*">/.test(app), "library input without capture");
  const all = ["lib/photo-id.js", "lib/stock-ui.js", "app.js", "docs/photo-id.md", "scripts/catalog-intake.mjs", ".github/workflows/catalog-intake.yml"].map(read).join("\n");
  assert(!/(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|xai-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_)/.test(all), "no API keys or tokens committed");

  console.log("photo-id tests ok");
})().catch((err) => {
  console.error("FAIL:", err && err.stack ? err.stack : err);
  process.exit(1);
});
