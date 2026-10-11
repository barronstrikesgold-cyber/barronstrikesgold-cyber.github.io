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
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const rules = fs.readFileSync(path.join(root, "lib/rules.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const manifest = fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8");
const first = html.split(/<script src/i)[0];
const nav = html.slice(html.indexOf('<nav class="tabbar"'), html.indexOf("</nav>"));

assert(html.includes("<title>Hunt</title>"), "title");
assert(html.includes('<meta name="description" content="Hunt: find it, check the profit after fees, track it, get alerted." />'), "description");
assert(/<h1 class="wordmark">Hunt<\/h1>/.test(first), "wordmark on the shell");
assert(html.includes('id="status-live"'), "status hook");
assert(html.includes('id="checked-line"'), "checked hook");
assert(html.includes('data-action="refresh"'), "refresh hook");
assert(css.includes("height: calc(56px + env(safe-area-inset-top))"), "compact header");
["Home", "Tracked", "Alerts", "Account"].forEach((name) => {
  assert(nav.includes(">" + name + "<"), "tab " + name);
});
["Catalog", "Stores", "Drops", "Inventory", "Profit"].forEach((name) => {
  assert(!nav.includes(">" + name + "<"), name + " is not a tab");
});
assert(!/>Dates</.test(first), "Dates is not a tab");
assert(!/>Bought</.test(first), "Bought is not a tab");
assert(!/>Cash</.test(first), "Cash is not a tab");
assert(!/Cuda/i.test(first), "home shell is not a product dump");
assert(html.includes('rel="manifest"'), "manifest linked");
assert(html.includes("apple-touch-icon"), "apple touch icon");
assert(manifest.includes("Hunt") && manifest.includes("standalone"), "manifest");
assert(app.includes("Photo needed"), "photo needed state is explicit");
assert(app.includes("No settled sale"), "missing sales stay unnamed");
assert(app.includes("No sold data"), "unsourced comps stay blank");
assert(app.includes("Where are you?"), "hunt starts at the store");
assert(app.includes("Read the card") || rules.includes("Read the card"), "supers teach the card");
assert(rules.includes("SUPER CHASE"), "matchbox tell");
assert(html.includes("lib/rules.js"), "rules script is on the page");
assert(app.includes("Golf"), "golf category");
assert(/\.peg-photo\.is-hero\s*\{[^}]*height:\s*auto/.test(css), "hunt photo frame follows the package");
assert(/\.peg-photo\.is-hero\s*\{[^}]*aspect-ratio:\s*auto/.test(css), "hunt photo keeps the source aspect");
assert(/\.peg-photo\.is-hero img\s*\{[^}]*object-fit:\s*contain/.test(css), "hunt photo contains the car");
assert(/\.peg-photo\.is-hero img\s*\{[^}]*object-position:\s*center center/.test(css), "hunt photo is centered");
assert(!/\.peg-photo\.is-hero\s*\{[^}]*height:\s*168px/.test(css), "hunt photo is not a short crop");
assert(css.includes("prefers-reduced-motion"), "reduced motion");
assert(css.includes("safe-area-inset-bottom"), "safe area");
assert(css.includes("min-height: 44px"), "44px targets");
const stockCopy = (html + app).replace(/It is in stock near me/gi, "").replace(/In stock near me/gi, "");
assert(!/in stock/i.test(stockCopy), "no invented in-stock claim");
assert(app.includes("It is in stock near me"), "stock alert is a watch condition");
assert(app.includes("Broken Beaker Labs LC"), "legal entity");
assert(app.includes("What did you find?"), "home question");
assert(app.includes("hunt-theme"), "appearance toggle");
assert(html.includes("lib/flow.js"), "flow helper is on the page");
assert(css.includes("prefers-color-scheme: light"), "light mode follows the system");
assert(css.includes("minmax(0, 1fr)"), "fluid card grid");
assert(css.includes("repeat(4, minmax(0, 1fr))"), "wide screens use four columns");
assert(/min-width:\s*1024px/.test(css), "navigation changes at 1024px");
assert(css.includes("--on-flame"), "flame buttons keep a dark text token");
assert(fs.readFileSync(path.join(root, "lib/providers.js"), "utf8").includes("walmart.com/search"), "Walmart search");
assert(fs.readFileSync(path.join(root, "lib/providers.js"), "utf8").includes("shopgoodwill.com/categories/search"), "ShopGoodwill search");
assert(fs.readFileSync(path.join(root, "lib/providers.js"), "utf8").includes("dollartree.com/searchresults"), "Dollar Tree search");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const huntDrops = fs.readFileSync(path.join(root, "lib/hunt-drops.js"), "utf8");
assert(app.includes("drops-strip"), "hunt pins a drops strip");
assert(app.includes("open-drops"), "strip opens the drops tab");
assert(app.includes("visibilitychange"), "refresh when the page is shown again");
assert(app.includes("pageshow"), "refresh on pageshow");
assert(app.includes("focus"), "refresh on focus");
assert(app.includes('cache: "no-store"'), "hunt json bypasses the http cache");
assert(app.includes("ResellerHuntDrops"), "status and strip use the drops helper");
assert(html.includes('id="update-banner"'), "update banner is in the shell");
assert(html.includes("Update available"), "update banner names the new shell");
assert(html.includes("lib/hunt-drops.js"), "drops helper is on the page");
assert(css.includes(".drops-strip"), "drops strip is styled");
assert(huntDrops.includes("Updated just now") && huntDrops.includes("Checking…"), "status copy");
assert(sw.includes("reseller-shell-20261011g"), "service worker cache name is bumped");
assert(!sw.includes("reseller-shell-20261011f"), "previous shell cache is retired");
assert(html.includes("lib/amazon.js"), "amazon helper is on the page");
assert(sw.includes("./lib/amazon.js"), "amazon helper is in the shell");
assert(html.includes("As an Amazon Associate I earn from qualifying purchases."), "associates disclosure is in the footer");
const installHandler = sw.slice(sw.indexOf('addEventListener("install"'), sw.indexOf('addEventListener("message"'));
assert(installHandler.includes("self.skipWaiting()"), "install calls skipWaiting");
const activateHandler = sw.slice(sw.indexOf('addEventListener("activate"'), sw.indexOf("function isHwData"));
assert(activateHandler.includes("self.clients.claim()"), "activate claims clients");
assert(sw.includes("./index.html") && sw.includes("./styles.css") && sw.includes("./manifest.webmanifest"), "app shell is precached");
assert(sw.includes("./app.js") && sw.includes("./icon.svg") && sw.includes("./apple-touch-icon.png"), "shell js and icons are precached");
assert(sw.includes("function staleWhileRevalidate"), "catalog data uses stale-while-revalidate");
assert(sw.includes("/data/hw/"), "data/hw is runtime-cached");
assert(html.includes("lib/market.js"), "market helper is on the page");
assert(sw.includes("./lib/market.js"), "market helper is in the shell");
assert(!sw.includes("data/market.json"), "market data stays network-first");
assert(html.includes("lib/resale-cards.js"), "resale cards script is on the page");
assert(sw.includes("SKIP_WAITING"), "one tap applies the waiting worker");
assert(sw.includes('cache: "no-store"'), "service worker fetches hunt json from the network");
assert(sw.includes("/data/"), "data json is network-first");
const shellPaths = [...sw.matchAll(/"(\.\/[^"]+)"/g)].map((match) => match[1]);
shellPaths.forEach((rel) => {
  assert(fs.existsSync(path.join(root, rel.replace(/^\.\//, ""))), rel + " exists for the shell cache");
});

console.log("shell.test.js OK");
