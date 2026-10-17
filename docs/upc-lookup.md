# Barcode lookup

Every scanned or typed code goes through the same flow (Scan tab, header scan button, Inventory tracker "Scan to add" / "Scan barcode or Mattel code", Show Mode "Scan" and typed codes).

1. **Hunt's own data, on the phone**
   - Buy list (`data/catalog.json`) and the Hunt book (existing scan behaviour, unchanged).
   - Inventory tracker stock (`hunt-stock` IndexedDB), matched as UPC-A / EAN-13 / Mattel code.
   - Price list comps (`data/market.json` + catalog) by any `upc / barcode / ean / gtin / sku / code / toy / toyNo` field.
   - Code index `data/upc/codes-XX.json` (built by `node scripts/build-upc-index.mjs`, guarded by `test/upc-lookup.test.js`): 12.8k Mattel toy / peg codes from the HW catalog chunks (e.g. `JJK58`, `HKL22-N9C0K` card backs) plus catalog, market, and drops codes. Two-character shards, one fetched per scan.
   - Codes you confirmed before (`hunt-upc` IndexedDB `learned` store, written whenever a tracker item with a retail code is saved).
2. **The web, for retail UPC / EAN / GTIN only** (from the browser; no keys)
   1. `https://barcode.report/api/v1/products/{gtin14}` — keyless, `Access-Control-Allow-Origin: *`, retailer + crawl evidence (title, brand, category, description, model, image URLs). Best toy coverage of the keyless options.
   2. Optional owner proxy (see below) for UPCitemdb, which adds MSRP and recorded price range.
   3. `https://world.openproductsfacts.org/api/v2/product/{ean13}.json` — keyless, CORS `*`.
   4. `https://world.openfoodfacts.org/api/v2/product/{ean13}.json` — keyless, CORS `*` (grocery codes).
   5. Search links: Google Shopping, eBay sold, Amazon (`tag=hempsply02-20`), barcode.report, UPCitemdb.
   A Mattel code found in a web match (for example `HNW46`, `JDW39`) is matched back to the code index and the price list.
3. **Confirm card**: photo (pick from up to 6), title, brand, lane, category, model / Mattel code, MSRP when known, description, source link. "Add to tracker" saves in one tap (qty 1, cost blank to fill in); "Edit, then add" opens the prefilled form. In the tracker form the card fills the form; in Show Mode it adds the item to your table at show status.

Answers are cached in IndexedDB `hunt-upc` (hits 90 days, misses 1 day). Offline, a stale answer is used. Photos load from the host with `referrerpolicy="no-referrer"`; a broken photo falls through to the next one, then to the Hunt placeholder. The saved item keeps the https photo link (`imageUrl`, used for the Shopify CSV `Image Src`) and, when the host sends CORS headers, a 480px local copy (`imageLocal`) for offline shows.

## Sources checked (Oct 17, 2026)

| Source | Key | Browser CORS from GitHub Pages | Notes |
| --- | --- | --- | --- |
| barcode.report | none | yes (`*`) | used first |
| Open Products Facts / Open Food Facts | none | yes (`*`) | low toy coverage |
| UPCitemdb trial (`/prod/trial/lookup`) | none, 100/day per IP | **no** (allows only `https://www.upcitemdb.com`) | needs a proxy |
| ProductGuru (`myproduct.guru`) | none | yes | no images; missed every toy test code, not wired |
| Datakick / gtinsearch.org | none | yes | captcha wall, empty results, not wired |
| Barcode Spider, UPC Database, go-upc, Barcode Lookup | **required** | — | never put a key in this repo |

## Optional: UPCitemdb proxy (owner setup, not deployed)

The free trial endpoint blocks browsers on other origins. To add it, deploy this Cloudflare Worker on your own account (free plan), then on the phone open the browser console once on the Hunt site and run
`localStorage.setItem("hunt-upc-proxy", "https://<your-worker>.workers.dev/")`. Hunt then calls `https://<your-worker>.workers.dev/?upc=<code>` second in line. Remove it with `localStorage.removeItem("hunt-upc-proxy")`.

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const upc = (url.searchParams.get("upc") || "").replace(/\D/g, "");
    const cors = { "Access-Control-Allow-Origin": "https://barronstrikesgold-cyber.github.io", "Content-Type": "application/json" };
    if (!/^\d{8,14}$/.test(upc)) return new Response('{"items":[]}', { status: 400, headers: cors });
    const res = await fetch("https://api.upcitemdb.com/prod/trial/lookup?upc=" + upc, { headers: { Accept: "application/json" }, cf: { cacheTtl: 86400, cacheEverything: true } });
    return new Response(await res.text(), { status: res.status, headers: cors });
  },
};
```

The trial is 100 lookups per day per Worker IP. A paid UPCitemdb key would go in a Worker secret (`env.UPCITEMDB_KEY`), never in this repo.

## One barcode for a whole case (Mattel assortments)

Some Mattel lines print one UPC per assortment, shared by every item in the case.
Hot Wheels Monster Trucks 1:64 basic trucks all carry **887961705393** (Asst. **FYJ44**),
so the barcode alone cannot say which truck it is.

- `data/upc/assortments.json` maps assortment UPCs and codes to a case list:
  `887961705393 → FYJ44` (owner's card back, plus Best Buy via barcode.report model FYJ44),
  aliases `JWL27`, `JNP41` (Icecat model numbers for that same UPC), and `C4982`
  (mainline basic cars, which reuses the HW year index; no shared mainline UPC is verified,
  so it only opens when C4982 is typed or a web match names it).
- Scanning an assortment UPC shows **Which one is it?**: a grid of that case's items
  with photos, newest year first, and a field to type the item code from the card back
  (`JDP89`, or `JDP89-0910`). An exact code resolves at once; a name filters the grid.
  The pick becomes the normal confirm card (Add to tracker / Edit, then add). The saved
  item keeps the UPC as its code and notes `Item code JDP89 · Asst. FYJ44`. A shared UPC
  never "learns" one item's name.
- A 5-character item code typed in the Scan box resolves straight to the item.
- `data/hw/monster-trucks.json` (244 trucks, 2024–2026) is built from the Hot Wheels Wiki
  "Monster Trucks" tables by `python3 scripts/build-monster-trucks.py`, then
  `npm run upc-index`. Only toy numbers printed in the wiki table are kept; a row without
  one is stored as `null` (shown as "code unknown"). Photos are the wiki's own thumbnails,
  loaded with no referrer (Fandom refuses a GitHub Pages referrer).
