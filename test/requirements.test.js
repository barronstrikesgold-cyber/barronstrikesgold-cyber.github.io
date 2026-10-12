"use strict";

const fs = require("fs");
const path = require("path");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const doc = read("REQUIREMENTS.md");
const app = read("app.js");
const html = read("index.html");
const market = JSON.parse(read("data/market.json"));
const drops = JSON.parse(read("data/drops.json"));
const catalog = JSON.parse(read("data/catalog.json"));
const hwIndex = JSON.parse(read("data/hw/index.json"));

function section(id) {
  return (market.sections || []).filter(function (row) { return row.id === id; })[0];
}

function hasItems(id) {
  const row = section(id);
  return !!(row && Array.isArray(row.items) && row.items.length > 0);
}

const REQUIRED_TCG = ["pokemon", "magic", "onepiece", "lorcana", "yugioh"];

const sections = [
  {
    name: "Hot Wheels",
    doc: /Hot Wheels/,
    app: app.includes('["hot-wheels", "Hot Wheels"]'),
    data: Array.isArray(catalog.cars) && catalog.cars.length > 0 && hwIndex.count > 0,
  },
  {
    name: "Matchbox",
    doc: /Matchbox/,
    app: app.includes('["matchbox", "Matchbox"]'),
    data: hasItems("matchbox"),
  },
  {
    name: "Mattel",
    doc: /Mattel/,
    app: app.includes("Mattel"),
    data: hasItems("mattel"),
  },
  {
    name: "Pokémon",
    doc: /Pokémon/,
    app: app.includes('["pokemon", "Pokémon"]'),
    data: hasItems("pokemon"),
  },
  {
    name: "Magic: The Gathering",
    doc: /Magic/,
    app: app.includes('["mtg", "MTG"]'),
    data: hasItems("magic"),
  },
  {
    name: "One Piece",
    doc: /One Piece/,
    app: app.includes('["onepiece", "One Piece"]'),
    data: hasItems("onepiece"),
  },
  {
    name: "Lorcana",
    doc: /Lorcana/,
    app: app.includes('["lorcana", "Lorcana"]'),
    data: hasItems("lorcana"),
  },
  {
    name: "Yu-Gi-Oh",
    doc: /Yu-Gi-Oh/,
    app: app.includes('["yugioh", "Yu-Gi-Oh"]'),
    data: hasItems("yugioh"),
  },
  {
    name: "Sports cards",
    doc: /Sports cards/,
    app: app.includes('["sports", "Sports cards"]'),
    data: hasItems("sports"),
  },
  {
    name: "Sneakers",
    doc: /Sneakers/,
    app: app.includes('["sneakers", "Sneakers"]'),
    data: hasItems("sneakers"),
  },
  {
    name: "Designer / streetwear",
    doc: /Designer[\s\S]{0,80}streetwear/,
    app: app.includes('["designer", "Designer"]') && /streetwear/i.test(app),
    data: hasItems("designer") && /streetwear/i.test(section("designer").note || ""),
  },
  {
    name: "LEGO",
    doc: /LEGO/,
    app: app.includes('["lego", "LEGO"]'),
    data: hasItems("lego"),
  },
  {
    name: "Funko",
    doc: /Funko/,
    app: app.includes('["funko", "Funko"]'),
    data: hasItems("funko"),
  },
  {
    name: "Apple",
    doc: /Apple/,
    app: app.includes('["apple", "Apple/Beats"]'),
    data: hasItems("apple"),
  },
  {
    name: "Consoles",
    doc: /Consoles/,
    app: app.includes('["consoles", "Consoles"]'),
    data: hasItems("consoles"),
  },
  {
    name: "Calendar",
    doc: /Calendar/,
    app: html.includes('data-tab="calendar"') && app.includes("<h1>Calendar</h1>") && app.includes('id="calendar-list"'),
    data: Array.isArray(drops) && drops.length > 0 && drops.every(function (row) { return row.id && row.iso && row.name; }),
  },
  {
    name: "Blog",
    doc: /Blog/,
    app: app.includes('data-action="open-blog"') && app.includes("<h1>Blog</h1>") && app.includes('id="blog-list"') && app.includes("data/blog.json"),
    data: false,
  },
  {
    name: "Coupons",
    doc: /Coupons/,
    app: app.includes('data-action="open-coupons"') && app.includes("<h1>Coupons</h1>") && app.includes('id="coupons-area"') && app.includes("data/coupons.json") && app.includes("ResellerCoupons.activeCoupons") && app.includes("ResellerCoupons.pruneCoupons") && /ownerOn\(\)\s*\?\s*[^;\n]*ResellerCoupons\.activeCoupons/.test(app),
    data: false,
  },
];

sections.forEach(function (row) {
  assert(row.doc.test(doc), "REQUIREMENTS.md is missing " + row.name);
  assert(row.app, row.name + " disappeared from the app");
  if (row.name !== "Blog" && row.name !== "Coupons") assert(row.data, row.name + " disappeared from the data");
});

const extraTcg = (market.sections || []).filter(function (row) {
  return row.group === "TCG" && row.id !== "sports" && REQUIRED_TCG.indexOf(row.id) === -1;
});
assert(extraTcg.length === 0, "every TCG must be a required section: " + extraTcg.map(function (row) { return row.id; }).join(", "));
REQUIRED_TCG.forEach(function (id) {
  assert(hasItems(id), id + " TCG disappeared from the data");
});

[
  "Website first",
  "iOS",
  "Free",
  "Pro",
  "Stripe",
  "hempsply02-20",
  "front end",
  "back end",
  "responsive",
  "card layout",
  "premium",
  "supplier",
  "auto-updating",
  "SEO",
  "owner-only",
  "active codes",
  "auto-remove",
  "centered",
  "detail pages",
  "buy links",
  "iPhone scan",
  "fast load",
  "Broken Beaker Labs LC",
  "licensed photos",
  "no logos",
  "legal pages",
].forEach(function (phrase) {
  assert(doc.includes(phrase), "REQUIREMENTS.md dropped " + phrase);
});

["privacy.html", "terms.html"].forEach(function (file) {
  assert(fs.existsSync(path.join(root, file)), file + " disappeared");
  assert(read(file).includes("Broken Beaker Labs LC"), file + " must name Broken Beaker Labs LC");
  assert(html.includes(file), "footer dropped " + file);
});

const boot = app.slice(app.indexOf("function loadHuntData"), app.indexOf("function onPageReturn"));
assert(!boot.includes("blog.json") && !boot.includes("coupons.json"), "blog and coupons stay off the first hunt load");

let Coupons;
try {
  Coupons = require("../lib/coupons.js");
} catch (err) {
  assert(false, "lib/coupons.js loads");
}

const today = "2026-10-12";
const sample = [
  { id: "live", code: "SAVE10", active: true, expires: "2026-12-01" },
  { id: "expired", code: "OLD", active: true, expires: "2026-10-11" },
  { id: "inactive", code: "OFF", active: false, expires: "2026-12-01" },
  { id: "example", code: "EXPIRED-FIXTURE", active: true, expires: "2099-01-01", example: true },
  { id: "blank", code: "  ", active: true, expires: "2026-12-01" },
];
const active = Coupons.activeCoupons(sample, today);
assert(active.length === 1 && active[0].id === "live", "only an active unexpired code is shown");
const pruned = Coupons.pruneCoupons(sample, today);
assert(pruned.length === 1 && pruned[0].id === "live", "dead codes are removed");
assert(Coupons.activeCoupons([{ code: "TODAY", active: true, expires: today }], today).length === 1, "a code that expires today is still active");
assert(Coupons.activeCoupons(sample, today).every(function (row) { return row.example !== true && row.active !== false; }), "fixtures and inactive codes stay hidden");

const published = JSON.parse(read("data/coupons.json"));
assert(published.audience === "owner", "coupons are owner-only");
assert(Coupons.activeCoupons(published.codes, today).length === 0, "the public repo has no live coupon code");
assert(Coupons.pruneCoupons(published.codes, today).length === 0, "published fixtures are dead and get removed");
assert(!html.includes("EXPIRED-FIXTURE") && !app.includes("EXPIRED-FIXTURE"), "fixture codes stay out of the shell");

const blog = JSON.parse(read("data/blog.json"));
assert(Array.isArray(blog.posts) && blog.posts.length > 0, "blog data disappeared");
const blogIndex = read("blog/index.html");
assert(/<h1[^>]*>\s*Blog\s*<\/h1>/.test(blogIndex), "blog index is a real page");
blog.posts.forEach(function (post) {
  assert(post.slug && post.title && post.description && post.date && post.body && post.body.length > 80, post.slug + " is an incomplete post");
  const page = read("blog/" + post.slug + ".html");
  assert(page.includes("<h1>" + post.title + "</h1>"), post.slug + " dropped its title");
  assert(page.includes(post.description), post.slug + " dropped its description");
  assert(page.includes(post.body), post.slug + " dropped its article");
  assert(/<meta name="description"/.test(page), post.slug + " has no meta description");
  assert(blogIndex.includes(post.slug + ".html"), "blog index dropped " + post.slug);
  assert(blogIndex.includes(post.title), "blog index dropped the title for " + post.slug);
});

console.log("requirements.test.js OK");
