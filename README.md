# Reseller

A one-hand phone app for store hunts. Five tabs: Hunt, Stores, Drops, Inventory, and Profit. It is a static PWA for GitHub Pages. It does not pretend to read live store inventory or sold marketplaces.

## Audit (what was broken)

The public site at https://barronstrikesgold-cyber.github.io/ was the 9 September 2026 build (`data-live="main-20260909n"`).

- The tab bar said Hunt, Stores, Dates, Profit, Bought. Drops and Inventory were not names in the product, and the running app never showed a 78-package book.
- Hunt was a long list of stores and categories, with no portfolio, no quick actions, and no Strong / Verify section.
- Golf was buried inside Goodwill. The home screen had no Golf entry.
- Bought was an empty manual list. The 78-row import never landed in the app.
- The service worker unregistered itself and deleted caches, so there was no offline shell.
- The manifest was not linked, and it had no icons. The mark was a generic list icon.
- Many product photos were stand-ins. A few had a quiet note. Others, including a 2025 Topps box used for 2026 Series 1, were shown as if they were the exact item.
- Release status used 9 September 2026 as “today,” so 16 September releases still read as upcoming.
- Refresh tried a Dollar Tree fetch and only left a short error line. There was no data-source screen.
- Profit was leftover cash only. It had no tax, ROI, or break-even, and it could not start from an inventory row.
- Search did not cover notes, status, or inventory.

## Product map

| Tab | What it is |
| --- | --- |
| Hunt | Home. Portfolio, search, scan / check price / add / review, Strong and Verify rows, store cards, category cards. |
| Stores | One hunt mode per store. Dollar Tree has no tracked generic product. |
| Drops | Release calendar. Past dates are Released. September 23, 2026 and later stay Upcoming. |
| Inventory | The 78-package book, plus manual add, edit, keep, sold, remove, JSON/CSV export, and JSON import. |
| Profit | Shelf or cost, sold or target, 13% fees, shipping, optional tax, net, ROI, and break-even. |

Open a row for the photo or a Photo needed state, retail, tracked sold or No settled sale, source and date, sentiment stored with the price, net after about 13% fees, grade, size when it matters, stock you mark yourself, the last five checks, and search links.

Grades: diecast Sealed / Card damage / Loose, shoes Deadstock / Light wear / Beat, clothing NWT / Used / Stained, tech Powers on / Locked / Dead.

Stock marks are On shelf, Not here, or Sold out, with the store and a timestamp. The app never invents a count.

## Inventory

`data/inventory-seed.json` is the 78-package book dated 2026-09-21.

- Invested band $125–$155. Target band $285–$415.
- Lotus Sport Elise (`inv-73`) is STH, Mix H Super, target $20–$40, Spectraflame orange, Real Riders, gold flame. The separate tracked sale is $33 (HW Price Guide, August 2026, 23 sales).
- Both Subaru Impreza WRX STI rows stay Verify STH until the card shows spectraflame blue, Real Riders, a TH on the hood scoop, and a gold flame circle.
- Extra Dirt ATVs and the extra 7-Eleven are tagged Duplicate.

Local storage key: `reseller-inventory-v2`. An empty store is seeded. A later visit merges by id and does not wipe edits or sold history. Removed ids are tombstoned so the seed does not put them back. Corrupt JSON is left in place and reported. Older `reseller-bought` rows are migrated once.

## Trusted prices

Only these settled sales are stored. Everything else is No settled sale.

| Item | Sold | When | Source |
| --- | --- | --- | --- |
| Ferrari F40 Competizione Super | $122 | August 2026 | HW Price Guide, 8 sales |
| Honda Civic Custom Super | $61 | August 2026 | HW Price Guide, 36 sales |
| Lotus Sport Elise Super | $33 | August 2026 | HW Price Guide, 23 sales |
| '64 Impala Super | $45 | July 2026 | HW Price Guide, 22 sales |
| Ford Mustang GTD Super | $53 | May 2026 | HW Price Guide, 41 sales |
| 2026 Topps Series 1 value/blaster | $13.20–$16.80 | September 7, 2026 | Fanatics Collect. Printed often $24.99. Pass. |

A number you type is labeled as yours. Refresh never replaces a tracked sale. The product clock for Released vs Upcoming is 22 September 2026, Central Time.

## Assets

Original flame-and-speed mark. No Mattel or Hot Wheels logos, and no store logos.

| Class | Where |
| --- | --- |
| Mark and wordmark | `assets/brand/mark.svg`, `assets/brand/wordmark.svg`, `icon.svg` |
| App icon, Apple touch, favicon, maskable | `assets/brand/icon-192.png`, `icon-512.png`, `icon-maskable.png`, `apple-touch-icon.png`, `favicon-32.png` |
| Manifest and theme | `manifest.webmanifest`, theme `#1A120C`, splash background `#1A120C` |
| Tokens | `styles.css` `:root` (color, type, space, radius, shadow, status, motion) |
| Category covers | `assets/categories/{cars,sports,sneakers,tech,streetwear,golf}.svg` |
| Store cards | `assets/stores/*.svg` text monograms only |
| State icons | `assets/states/` Strong, Watch, Pass, STH, Verify, Duplicate, Sold, Photo needed, No settled sale, plus empty, loading, offline, no-results, error, blocked |
| Exact photos | `photos/` only when `photoMatched` is true in `data/catalog.json` or `data/drops.json`, with alt text and `photoSource` |
| Price and summary visuals | CSS meters and band tracks. A missing sale uses `assets/viz/no-history.svg` |
| Release and check icons | `assets/calendar/release.svg`, `assets/stores/check-*.svg` |

Unmatched JPEGs remain in `photos/` so older links do not 404, and the UI does not show them. Inventory rows are Photo needed.

Matched catalog photos: Cuda, Firebird, Skyline, Pokémon 30th ETB, F40, Civic, Lotus, Impala, Mustang GTD, Porsche 911 RS 2.7, Matchbox Super Chase. The case P/Q calendar row uses the Cuda photo and says so. The Artifacts file is a hobby box, not the blaster, so that row is Photo needed. The Topps Series 1 file is a different year, so it is Photo needed.

## Source limits

GitHub Pages cannot scrape Walmart, Target, Best Buy, ShopGoodwill, Dollar Tree, Google, or a sold-comp site. Those links open a search. Dollar Tree’s JSON endpoint is attempted on Refresh and recorded as blocked when the browser is refused. HW Price Guide and Fanatics Collect values are static snapshots. Live data needs a backend and credentials. Sources is the sheet behind the Sources button.

## Develop

```bash
npm test
npm run smoke
npx serve .
```

`npm test` covers profit math, seed/merge, search, sorting, release status, and the rule that untrusted ids cannot grow a sold price. `npm run smoke` opens the app in headless Chrome at 375, 390, and 430 CSS pixels, checks all five tabs, and checks that Inventory lists 78 rows including the Lotus STH and both Verify Subarus.

## Deploy

This repository is a GitHub user site. Pages serves the root of `main`. `.github/workflows/publish.yml` does not build a Next app. Merging to `main` is what updates https://barronstrikesgold-cyber.github.io/. A pull request branch does not. Confirm a release with a cache-busted fetch of that URL and look for the five tabs Drops and Inventory.
