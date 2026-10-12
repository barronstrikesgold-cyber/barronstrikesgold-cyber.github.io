import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  brandLine,
  centralLabel,
  extraRefreshShouldRun,
  isMattelLogo,
  mergeLaunches,
  parseLaunchCalendar,
} from "../scripts/mattel-calendar.mjs";

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = `<section class="calendar-section calendar-section--metaobject">
  <script>
    SDG.Data.launchCalendarJsonld = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "numberOfItems": 2,
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "item": {
            "@type": "SaleEvent",
            "name": "Hot Wheels Collector - Member Exclusive",
            "startDate": "2026-10-15T09:00:00-07:00",
            "description": "Coming Soon",
            "image": "https://creations.mattel.com/cdn/shop/files/Calendar-Logos-2025_Hot-Wheels.png"
          }
        },
        {
          "@type": "ListItem",
          "position": 2,
          "item": {
            "@type": "SaleEvent",
            "name": "Hot Wheels Elite 64",
            "startDate": "2026-10-16T09:00:00-07:00",
            "description": "Pandem Datsun",
            "image": "https://creations.mattel.com/cdn/shop/files/pandem.jpg"
          }
        }
      ]
    };
  </script>
  <div class="calendar-grid-item">
    <div class="month-field">Oct</div>
    <div class="day-field">15</div>
    <span class="citem-vendor hide">Hot Wheels Collector</span>
    <span class="merch-badge">Member Exclusive</span>
    <span class="citem-title">Coming Soon</span>
    <span class="citem-price">$$</span>
    <img class="calendar-image" src="//creations.mattel.com/cdn/shop/files/Calendar-Logos-2025_Hot-Wheels.png">
  </div>
  <div class="calendar-grid-item">
    <div class="month-field">Oct</div>
    <div class="day-field">16</div>
    <span class="citem-vendor hide">Hot Wheels</span>
    <span class="merch-badge">Elite 64</span>
    <span class="citem-title">Pandem Datsun</span>
    <span class="citem-price">$25.00</span>
    <a href="/products/hot-wheels-elite-64-pandem-datsun-280zx-jnf06">Shop</a>
    <img class="calendar-image" src="//creations.mattel.com/cdn/shop/files/pandem-datsun.jpg?v=1">
  </div>
</section>`;

const now = new Date("2026-10-12T15:00:00Z");
const rows = parseLaunchCalendar(html, now);
assert(rows.length === 2, "both upcoming launches parse");
const soon = rows[0];
assert(soon.brand === "Hot Wheels RLC", "Hot Wheels Collector maps to the RLC line");
assert(soon.release === "2026-10-15", "launch date is the Central calendar day");
assert(soon.releaseLabel === "October 15, 2026 · 11:00 AM CT", "9:00 AM PT is 11:00 AM CT");
assert(soon.launchAt === "2026-10-15T16:00:00.000Z", "launch instant is stored in UTC");
assert(soon.retail == null, "a $$ tier is not stored as a dollar price");
assert(soon.retailLabel.includes("$$"), "the published tier stays visible");
assert(soon.photo === "", "a calendar logo is not a product photo");
assert(soon.retailUrl === "https://creations.mattel.com/pages/launch-calendar", "an unrevealed launch links to the calendar");
assert(soon.launchUnrevealed === true, "Coming Soon stays unrevealed");

const revealed = rows[1];
assert(revealed.brand === "Elite 64", "Elite 64 keeps its line");
assert(revealed.name === "Pandem Datsun", "a revealed title replaces Coming Soon");
assert(revealed.retail === 25, "a printed dollar price is kept");
assert(revealed.photo.includes("pandem-datsun.jpg"), "a Shopify CDN product image is kept");
assert(revealed.retailUrl.includes("/products/hot-wheels-elite-64-pandem-datsun-280zx-jnf06"), "the product link is kept");
assert(isMattelLogo("https://creations.mattel.com/cdn/shop/files/Calendar-Logos-2025_Hot-Wheels.png"), "logo helper flags calendar marks");
assert(brandLine("Matchbox", "Creations Exclusive Design", "") === "Matchbox", "Matchbox stays Matchbox");
assert(centralLabel("2026-10-13T09:00:00-07:00") === "October 13, 2026 · 11:00 AM CT", "Central label uses CT");

const existing = [{
  id: "mattel-JNF06",
  name: "Hot Wheels Elite 64 Pandem Datsun 280ZX",
  retail: 25,
  retailUrl: "https://creations.mattel.com/products/hot-wheels-elite-64-pandem-datsun-280zx-jnf06",
  photo: "https://cdn.shopify.com/s/files/1/existing.jpg",
  release: "2026-10-01",
}];
const merged = mergeLaunches(existing, rows);
assert(merged.added === 1, "a matching product is not added twice");
assert(merged.items.length === 2, "the unmatched launch is added");
assert(merged.items[0].id === "mattel-JNF06", "the existing Mattel row stays");
assert(merged.items[0].launchAt === revealed.launchAt, "the existing row takes the launch time");
assert(merged.items[0].photo.includes("existing.jpg"), "a real product photo is kept");

const launchDay = extraRefreshShouldRun({
  schedule: "0 15 * * *",
  now: new Date("2026-10-15T15:00:00Z"),
  launches: [{ launchAt: soon.launchAt, release: "2026-10-15" }],
});
assert(launchDay.run && launchDay.reason === "launch day", "10:00 CT on a launch day runs");
const wrongOffset = extraRefreshShouldRun({
  schedule: "0 16 * * *",
  now: new Date("2026-10-15T16:00:00Z"),
  launches: [{ launchAt: soon.launchAt, release: "2026-10-15" }],
});
assert(!wrongOffset.run, "the CST hour does not also run during CDT");
const quietDay = extraRefreshShouldRun({
  schedule: "0 18 * * *",
  now: new Date("2026-10-20T18:00:00Z"),
  launches: [{ launchAt: soon.launchAt, release: "2026-10-15" }],
});
assert(!quietDay.run, "13:00 CT skips a day with no launch");
const daily = extraRefreshShouldRun({ schedule: "30 13 * * *", now, launches: [] });
assert(daily.run && daily.reason === "daily", "the daily refresh still runs");

const workflow = fs.readFileSync(path.join(root, ".github/workflows/refresh-market.yml"), "utf8");
["0 15 * * *", "0 16 * * *", "0 18 * * *", "0 19 * * *", "30 13 * * *", "GITHUB_EVENT_SCHEDULE"].forEach((token) => {
  assert(workflow.includes(token), "workflow keeps " + token);
});
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const dates = fs.readFileSync(path.join(root, "lib/dates.js"), "utf8");
assert(app.includes('data-cal-start="'), "add to calendar can carry a launch time");
assert(app.includes("dropCountdown") && dates.includes("Drops in "), "the screen can say drops in");
assert(app.includes("Stale. Showing the last good copy."), "a failed fetch is flagged stale");
const comps = fs.readFileSync(path.join(root, "scripts/market-comps.mjs"), "utf8");
assert(comps.includes("!item.launchUnrevealed"), "an unrevealed launch does not get a guessed sold");

console.log("mattel-calendar.test.mjs OK");
