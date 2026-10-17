/* Shared-catalog intake guard: only owner issues, only verified entries (source URL + photo), never assortment UPCs. */
import fs from "node:fs";
import { parseIssue, verifyEntry, mergeLearned, sameProduct } from "../scripts/catalog-intake.mjs";

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const body = (e) => "Hunt found this.\n\n```json\n" + JSON.stringify(e) + "\n```\n";
const good = { name: "Funko Pop! Marvel Child Groot", upc: "889698487405", codes: [], brand: "Funko", lane: "funko", imageUrl: "https://img.example/groot.jpg", sourceUrl: "https://barcode.report/889698487405" };

/* intake reads only the repo owner's issues */
assert(!parseIssue({ user: { login: "stranger" }, body: body(good) }, "barronstrikesgold-cyber").ok, "a non-owner issue is ignored");
const p = parseIssue({ user: { login: "barronstrikesgold-cyber" }, body: body(good) }, "barronstrikesgold-cyber");
assert(p.ok && p.entry.upc === "889698487405" && p.entry.name === good.name, "the owner's JSON block parses");
assert(!parseIssue({ user: { login: "barronstrikesgold-cyber" }, body: "no json" }, "barronstrikesgold-cyber").ok, "an issue without JSON is refused");

function res(status, type, json, text) {
  return { ok: status >= 200 && status < 300, status, headers: { get: (k) => (k.toLowerCase() === "content-type" ? type : null) }, json: () => Promise.resolve(json), text: () => Promise.resolve(text || "") };
}
const pages = {
  "https://img.example/groot.jpg": () => res(200, "image/jpeg"),
  "https://img.example/notimage": () => res(200, "text/html"),
};
function fakeFetch(url) {
  if (pages[url]) return Promise.resolve(pages[url]());
  if (/barcode\.report\/api\/v1\/upc\/889698487405/.test(url) || /barcode\.report.*889698487405/.test(url)) {
    return Promise.resolve(res(200, "application/json", JSON.parse(fs.readFileSync(new URL("./fixtures/upc/barcode-report-funko.json", import.meta.url), "utf8"))));
  }
  if (/api\.pokemontcg\.io/.test(url)) return Promise.resolve(res(200, "application/json", JSON.parse(fs.readFileSync(new URL("./fixtures/photo/pokemon-158-128.json", import.meta.url), "utf8"))));
  if (url === "https://wiki.example/batmobile") return Promise.resolve(res(200, "text/html", null, "<h1>TV Series Batmobile</h1> Toy # JDP89"));
  return Promise.resolve(res(404, "text/html"));
}

(async function main() {
  assert(sameProduct("Funko Pop! Marvel Child Groot", "Funko POP Marvel: Child Groot Vinyl"), "same product by words");
  assert(!sameProduct("TV Series Batmobile", "Bone Shaker"), "different product");

  const fixtures = fs.readdirSync(new URL("./fixtures/upc/", import.meta.url));
  const funko = fixtures.find((f) => /funko|889698487405/.test(f));
  if (funko) {
    pages.__funko = funko;
    const v = await verifyEntry(p.entry, (url) => {
      if (/889698487405/.test(url) && !/img\.example/.test(url)) return Promise.resolve(res(200, "application/json", JSON.parse(fs.readFileSync(new URL("./fixtures/upc/" + funko, import.meta.url), "utf8"))));
      return fakeFetch(url);
    });
    assert(v.ok && v.entry.verifiedBy, "a UPC the web lookup knows, with a photo and a source, is accepted: " + v.why);
  }

  let v = await verifyEntry(Object.assign({}, p.entry, { imageUrl: "" }), fakeFetch);
  assert(!v.ok && /photo/.test(v.why), "no photo, no entry");
  v = await verifyEntry(Object.assign({}, p.entry, { sourceUrl: "" }), fakeFetch);
  assert(!v.ok && /source/.test(v.why), "no source, no entry");
  v = await verifyEntry(Object.assign({}, p.entry, { imageUrl: "https://img.example/notimage" }), fakeFetch);
  assert(!v.ok && /not an image/.test(v.why), "a photo URL must answer with an image");
  v = await verifyEntry(Object.assign({}, p.entry, { name: "TV Series Batmobile", upc: "887961705393" }), fakeFetch);
  assert(!v.ok && /assortment/.test(v.why), "a shared assortment UPC is refused");
  v = await verifyEntry({ name: "Mew ex 158/128", upc: "", codes: ["158/128"], imageUrl: "https://img.example/groot.jpg", sourceUrl: "https://api.pokemontcg.io/v2/cards/me55-158" }, fakeFetch);
  assert(v.ok && /Pokémon TCG API/.test(v.entry.verifiedBy), "a card number is verified against the Pokémon TCG API");
  v = await verifyEntry({ name: "Pikachu 158/128", upc: "", codes: ["158/128"], imageUrl: "https://img.example/groot.jpg", sourceUrl: "https://api.pokemontcg.io/v2/cards/x" }, fakeFetch);
  assert(!v.ok, "a card number with the wrong name is refused");
  v = await verifyEntry({ name: "TV Series Batmobile", upc: "", codes: ["JDP89"], imageUrl: "https://img.example/groot.jpg", sourceUrl: "https://wiki.example/batmobile" }, fakeFetch);
  assert(v.ok, "a source page that mentions the code verifies it");
  v = await verifyEntry({ name: "TV Series Batmobile", upc: "", codes: ["JDP89"], imageUrl: "https://img.example/groot.jpg", sourceUrl: "https://wiki.example/missing" }, fakeFetch);
  assert(!v.ok, "a dead source page is refused");

  let json = { note: "x", items: [] };
  let m = mergeLearned(json, Object.assign({}, p.entry, { verifiedBy: "test" }), "2026-10-17");
  assert(m.added && m.json.items.length === 1 && m.json.items[0].id && m.json.items[0].added === "2026-10-17", "a verified entry is added");
  m = mergeLearned(m.json, Object.assign({}, p.entry, { brand: "Funko Inc" }), "2026-10-18");
  assert(!m.added && m.json.items.length === 1 && m.json.items[0].brand === "Funko Inc", "the same UPC updates in place");

  const learned = JSON.parse(fs.readFileSync(new URL("../data/catalog-learned.json", import.meta.url), "utf8"));
  assert(Array.isArray(learned.items) && learned.items.every((i) => /^https:\/\//.test(i.sourceUrl) && /^https:\/\//.test(i.imageUrl)), "every shared learned entry has a source URL and a photo");
  const wf = fs.readFileSync(new URL("../.github/workflows/catalog-intake.yml", import.meta.url), "utf8");
  assert(/schedule:/.test(wf) && /catalog-add/.test(wf) && /secrets\.GITHUB_TOKEN/.test(wf) && /npm test/.test(wf), "the intake runs on a schedule, reads catalog-add issues, uses only GITHUB_TOKEN, tests before commit");
  console.log("catalog-intake tests ok");
})().catch((err) => {
  console.error("FAIL:", err && err.stack ? err.stack : err);
  process.exit(1);
});
