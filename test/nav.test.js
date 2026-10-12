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
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const nav = html.slice(html.indexOf('<nav class="tabbar"'), html.indexOf("</nav>"));

assert(nav.includes(">Home<"), "home tab");
assert(nav.includes("Drops &amp; Calendar"), "drops tab");
assert(nav.includes(">Catalog<"), "catalog tab");
assert(nav.includes(">Scan<"), "scan tab");
assert(nav.includes(">My Stuff<"), "my stuff tab");
assert(html.includes('id="global-q"'), "global search");
assert(css.includes("bottom: 0"), "mobile tab bar stays on the bottom");
assert(css.includes("top: calc(56px + env(safe-area-inset-top))"), "desktop uses a top nav");
assert(!css.includes("margin: 0 0 0 232px"), "desktop is not a side rail");
["Hot Wheels/Matchbox", "TCG", "Sports", "Sneakers", "Designer", "LEGO", "Funko", "Tech"].forEach((label) => {
  assert(app.includes('"' + label + '"'), "catalog chip " + label);
});
["watchlist", "inventory", "profit", "coupons", "alerts", "settings"].forEach((id) => {
  assert(app.includes('"' + id + '"'), "my stuff section " + id);
});
assert(app.includes('data-action="add-calendar"'), "drops can be added to a calendar");
assert(app.includes("BEGIN:VCALENDAR"), "add to calendar writes an ics file");
assert(app.includes('"#/catalog"') && app.includes('"#/scan"') && app.includes('"#/stuff/"') && app.includes('"#/search/"'), "tabs have deep links");
assert(app.includes('"#/hw"'), "the Hot Wheels book has a deep link");
assert(app.includes('aria-label="Breadcrumb"'), "pages have breadcrumbs");
assert(app.includes('id="blog-list"') && app.includes('id="coupons-area"') && app.includes('id="calendar-list"'), "blog, coupons, and calendar stay in the app");
assert(app.includes("addEventListener(\"offline\""), "offline updates the screen");
assert(app.includes("function couponsOnScreen"), "coupons repaint when My Stuff is open");
assert(app.includes("Just added") && app.includes("freshInvId"), "a new purchase stays visible on the inventory list");
assert(css.includes("#scan-video"), "the scan tab preview uses the same frame as the sheet");
assert(app.includes("scanBooting") && app.includes("parkedScan"), "a refresh does not restart an open camera");

console.log("nav.test.js OK");
