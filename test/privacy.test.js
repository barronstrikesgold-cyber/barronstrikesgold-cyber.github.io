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
function read(name) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

const privacy = read("privacy.html");
const terms = read("terms.html");
const deletion = read("delete-account.html");
const app = read("app.js");
const html = read("index.html");
const sources = ["app.js", "lib/inventory.js", "lib/flow.js", "lib/stock.js", "lib/stock-ui.js", "index.html"].map(read).join("\n");

const keys = new Set();
function collect(re) {
  let match;
  const pattern = new RegExp(re.source, "g");
  while ((match = pattern.exec(sources))) keys.add(match[1]);
}
collect(/(?:getItem|setItem|removeItem|readJson|writeJson)\(\s*["']((?:hunt|reseller)-[A-Za-z0-9-]+)["']/);
collect(/var KEY = ["']((?:hunt|reseller)-[A-Za-z0-9-]+)["']/);
collect(/readPref\(\s*["']((?:hunt|reseller)-[A-Za-z0-9-]+)["']/);
assert(privacy.includes("<code>hunt-stock</code>") && privacy.includes("IndexedDB"), "privacy.html discloses the hunt-stock IndexedDB database");

assert(keys.size >= 15, "expected the hunt and reseller storage keys, found " + keys.size);
keys.forEach(function (key) {
  assert(privacy.includes("<code>" + key + "</code>"), "privacy.html omits " + key);
});

assert(privacy.includes("Broken Beaker Labs LC"), "privacy names the operator");
assert(privacy.includes("CCPA") && privacy.includes("CPRA"), "privacy names CCPA/CPRA");
assert(privacy.includes("hempsply02-20"), "privacy states the Associates tag");
assert(privacy.includes("does not sell personal information"), "privacy says personal information is not sold");
assert(privacy.includes("Global Privacy Control"), "privacy honors Global Privacy Control");
assert(privacy.includes("COPPA") && privacy.includes("13"), "privacy has the 13+ COPPA statement");
assert(privacy.includes("CONTACT_EMAIL") && privacy.includes("POSTAL_ADDRESS"), "privacy keeps the contact placeholders");
assert(privacy.includes("TODO: replace CONTACT_EMAIL"), "privacy marks the email placeholder TODO");
assert(privacy.includes("TODO: replace POSTAL_ADDRESS"), "privacy marks the postal placeholder TODO");
assert(privacy.includes("id=\"your-privacy-choices\""), "privacy choices have an anchor");
assert(!privacy.includes("The site does not run a public account."), "the old no-account sentence is replaced");
assert(!/@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(privacy), "privacy must not invent an email address");

assert(terms.includes("Broken Beaker Labs LC"), "terms name the operator");
assert(terms.includes("<h2>Accounts</h2>"), "terms include account terms");
assert(terms.includes("13"), "terms keep the 13+ line");
assert(terms.includes("GOVERNING_LAW"), "terms keep the governing-law placeholder");
assert(terms.includes("TODO: replace GOVERNING_LAW"), "governing law is marked TODO");
assert(terms.includes("CONTACT_EMAIL") && terms.includes("POSTAL_ADDRESS"), "terms keep the contact placeholders");
assert(!/@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(terms), "terms must not invent an email address");

assert(deletion.includes("Broken Beaker Labs LC"), "delete page names the operator");
assert(deletion.includes("There is no account yet"), "delete page explains that accounts are not live");
assert(deletion.includes("When an account exists"), "delete page explains future account deletion");
assert(deletion.includes("CONTACT_EMAIL") && deletion.includes("POSTAL_ADDRESS"), "delete page keeps the placeholders");
assert(deletion.includes("TODO: replace CONTACT_EMAIL"), "delete page marks the email TODO");
assert(!/@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(deletion), "delete page must not invent an email address");

assert(app.includes("Export my data"), "account view exports device data");
assert(app.includes("Delete my data on this device"), "account view deletes device data");
assert(app.includes("confirm-delete-device-data"), "delete asks for confirmation");
assert(app.includes('indexOf("hunt-") === 0') && app.includes('indexOf("reseller-") === 0'), "export and delete cover hunt and reseller keys");
assert(!app.includes("Continue with Google") && !app.includes("Sign in with Apple"), "sign-in is not in this phase");

assert(html.includes('href="privacy.html#your-privacy-choices"'), "footer links to privacy choices");
assert(html.includes('href="delete-account.html"'), "footer links to the public delete page");
assert(html.includes("As an Amazon Associate I earn from qualifying purchases."), "footer disclosure stays");

/* audit 2026-10-17: the notice matches what the site really does */
assert(privacy.includes('id="who-your-browser-talks-to"') && privacy.includes("GitHub Pages") && privacy.includes("__cf_bm"), "privacy lists hosting and photo hosts");
assert(privacy.includes("<code>hunt-upc</code>") && /Export my data<\/strong> downloads[^<]*<code>hunt-<\/code>[\s\S]{0,200}hunt-stock/.test(privacy), "privacy says export covers IndexedDB");
assert(privacy.includes("sets no cookies") && privacy.includes("no analytics"), "privacy states no analytics and no cookies");
assert(privacy.includes("takes no payment"), "privacy says no payment is taken");
assert(terms.includes("<h2>Paid plans</h2>") && terms.includes("renews automatically until you cancel") && terms.includes("as easily as you signed up"), "terms carry the auto-renew and cancel promise");
assert(terms.includes("not financial advice") && terms.includes("<h2>Trademarks and photos</h2>"), "terms carry the no-advice and trademark notices");
assert(!terms.includes("licensed hosts"), "terms do not claim every photo is on a licensed host");
assert(!app.includes("Pro checkout uses Stripe on the web."), "the app does not claim a Pro checkout exists");
assert(app.includes("Hunt takes no payment"), "settings say there is no paid plan");
assert(app.includes("indexedDB: databases") && read("lib/stock-ui.js").includes("exportData: function"), "export includes IndexedDB");
assert(app.includes("affiliate-note") && app.includes('a[href*="tag=hempsply02-20"]'), "paid links get a nearby disclosure");
assert(html.includes("13 and older") && html.includes("not affiliated"), "footer has the age line and the trademark line");
assert(app.includes('rel="sponsored noopener"'), "tagged buy links are rel=sponsored");

console.log("privacy.test.js OK");
console.log("storage keys " + keys.size);
