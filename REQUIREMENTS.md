# Hunt requirements

This file is the permanent source of truth for Hunt. CI fails if a required section disappears from the app or the data.

## Product

Website first. An iOS app comes later.

Tiers are Free and Pro. Pro checkout uses Stripe on the web. Affiliate links use the Amazon Associates tag hempsply02-20.

Hunt is a full front end and back end. The front end is this website. The back end is the daily brand and supplier ingestion that refreshes the market file and the auto-updating brand calendar.

The interface stays responsive on every device. It uses a card layout, and it should feel premium and easy to use.

Photos load, are centered, and appear on detail pages, with buy links. iPhone scan is part of the hunt. The shell stays on a fast load: the blog and the coupons file are not on the first hunt request.

The legal pages name Broken Beaker Labs LC. Product photos are licensed photos only, and the cards show no logos.

Public promotions from official store and brand pages, and from affiliate coupon feeds, are shown in full: the offer, a publicly posted code when the page prints one, minimum spend, exclusions, eligible items, start and end dates, stacking, in-store or online, the source link, and when it was last verified. Tap a code to copy it. Codes the owner types stay owner-only on this device. The coupons area shows only active codes and will auto-remove dead ones. Leaked or private codes are not stored.

The site includes an SEO blog.

The Inventory tracker lives in My Stuff (two taps: My Stuff, then Tracker). Add items by Scan (barcode, UPC, or Mattel code), a catalog pick, or by hand. Each item keeps lane, name, variant (STH, TH, chase, sealed, raw, graded with grade), qty, cost paid, sales tax (default 9.7% St. Louis), purchase date and store, condition, a camera photo, location / bin, status (in stock, listed, at show, held for grading, sold), and every sale with price, channel, and date. Running totals show cost basis, est. value, and realized profit. It saves in IndexedDB on the phone, exports and imports CSV, and exports a Shopify product CSV (Handle, Title, Vendor, Product Type, Tags, Variant SKU, Variant Price, Variant Inventory Qty, Cost per item, Image Src). The data layer is an adapter interface so a Shopify Admin API backend can be swapped in without rewriting the UI.

Barcode lookup: every scanned or typed UPC, EAN, or Mattel code checks Hunt's own data first (the buy list, the price list, the HW catalog code index in data/upc, drops, the Hunt book, the inventory tracker, and codes the owner confirmed before). A retail UPC or EAN Hunt does not know is then looked up on keyless public product databases from the phone (barcode.report, then an optional owner proxy for UPCitemdb, then Open Products Facts and Open Food Facts) for the title, brand, lane, category, description, MSRP when a source has one, and photos. A confirm card shows the match with its source; one tap adds it to the inventory tracker, or opens the prefilled form to edit first. Mattel codes found in a web match are matched back to the catalog. No API key is ever committed. Lookups are cached on the phone in IndexedDB so repeat scans are instant and work offline at a show. When nothing is found, the card offers Search the web buttons (Google Shopping, eBay sold, Amazon with tag hempsply02-20). Show Mode price check uses the same scan flow. Remote photos load with no referrer and fall back to the Hunt placeholder. Some Mattel lines print one UPC for a whole case (assortment), such as Hot Wheels Monster Trucks 1:64 (Asst. FYJ44, UPC 887961705393): scanning it shows a "Which one is it?" picker of that assortment's items with photos, newest year first, with a prominent field to type the item code from the back of the card (e.g. JDP89); picking an item or typing its code resolves to the exact item, then the normal confirm card and one-tap Add to tracker. A 5-character Mattel item code, with or without its -XXXX suffix (JDP89-0910), also works straight from the Scan box. Item codes come only from a real source (Hot Wheels Wiki release tables); a missing code is shown as unknown, never guessed. Data: data/hw/monster-trucks.json and data/upc/assortments.json.

Photo identification: the Scan tab has Identify from photo (camera, `<input type=file accept=image/* capture=environment>`) and Pick a photo from your library, and both work in iPhone Safari. The photo is read on the phone with Tesseract.js, lazy-loaded from jsDelivr only when used, with no API key. It pulls Mattel item codes (JDP89, JDP89-0910), assortment codes (FYJ44, C4982), UPC digits, card numbers (158/128), LEGO set numbers, and name words. Codes go through the normal scan path (catalog, data/upc, the learned catalog, the assortment picker, web UPC lookup). Otherwise name words are fuzzy-matched against the price list, Monster Trucks, the tracker, and the learned catalog, and card numbers ask the keyless Pokémon TCG API. The top 5 candidates show with photos and a % match; tapping one opens the confirm card and Add to tracker. With no match it shows the text it read and Google, eBay sold, Amazon (tag hempsply02-20), and Google Lens links. The optional AI photo match is off by default: it runs only when the owner saves a vision proxy URL (hunt-vision-proxy; Cloudflare Worker template in docs/photo-id.md, key held server-side), and its guesses are merged into the candidates. Photos stay on the phone unless that proxy is on.

Learned catalog: when a scan or photo is not in Hunt's data, Hunt searches the web (UPC lookup, Pokémon TCG API, the vision proxy if set) and shows the result. Every item the owner confirms is saved right away to a learned catalog on the phone (IndexedDB hunt-upc, by UPC and by item code or card number), and future scans, photo matches, and Search use it. Shared assortment UPCs never learn one item. Web finds offer Suggest for the shared Hunt catalog, which opens a prefilled GitHub issue labelled catalog-add that the owner submits. The catalog-intake workflow (daily, and when an issue is opened) re-runs the web lookup on owner issues only and adds an entry to data/catalog-learned.json only when it verifies with a source URL and a photo, never a guess, then rebuilds the code index.

Search by case: Catalog (Search by case, #/case/...) and the Scan box find Hot Wheels mainline cases by the case-box code (L2593-973N US, C4982-99NL international, 5785 short card; the last letter of the mix code is the case), by a card code that ends in the case letter (JJK58-N9C0N = case N, JJL74-N9C0P = case P), by year and letter (2026 N, case N), or from a photo of a case-box label or card (OCR finds the case code). A bare C4982 or L2593 asks for the case letter (A-Q, no I or O). The case shows every listed car with its photo, collector number, color, series, and toy #, flags STH, TH, new castings, and store exclusives (2026 case N: STH '23 Ram 1500, TH Fast Fish; case P: STH '70 Plymouth AAR Cuda, TH Nissan Skyline HT 2000GT-X), says quantities per case are not published, and runs the fee check (sold × 0.87 − $5, minus the cost per car the owner types) wherever Hunt has a verified sold comp. The case-to-car mapping comes from published case checklists (Orange Track Diecast, source link per case) joined to the Hot Wheels Wiki catalog by collector number, plus toy #s read off the owner's cards; a color the sources do not pin down lists every candidate toy # as not confirmed, and a case without a checklist says unknown. Never invented. Monster Trucks (FYJ44) and Matchbox case mixes are not mapped yet and say so. Data: data/hw/cases-2026.json (scripts/build-hw-cases.mjs).

Show Mode is the pricing agent for a vendor table. Search or scan an item and it shows the market value from Hunt's own price data with its source and date, the eBay net (sold × 0.87 − $5), a round show ticket price under market, a floor that never drops below cost plus a margin, and lot pricing for commons. One tap records Sold at show, takes it out of qty, and logs cash or card. A daily show summary totals sales and profit. Show Mode works offline. With no comp it says No verified comp and never invents a price.

Item valuation: every tracker item card (photo, barcode, case, assortment, or hand add) has a Value section that loads automatically and has a Refresh value button: last sale (date, price, source link), recent comps, the sales-based guide (avg, sales count, range) when the source gives one, trend, grading pop (Hot Wheels/Matchbox say "No pop data"; cards point to PSA and need the optional proxy with a PSA spec ID; CGC and Beckett have no public API), a Sell / Hold / Keep call, and a projected value. Rules: net = sold × 0.87 − $5 vs cost incl. 9.7% tax; Hold if the price is rising; Sell if falling or past the release spike; Keep if an eBay sale would not cover cost. The projection is a log-linear fit of dated sales with method, 80% range, and confidence, labeled "Projection, not a promise", and says "Not enough data" under 5 sales over 30 days. Free sources: data/market.json, data/catalog.json, and data/market-history.json (scripts/build-market-history.mjs, appended by the daily market refresh). eBay sold, PriceCharting, and PSA pop come only through the owner's optional value proxy (hunt-value-proxy, off by default; template and monthly costs in docs/valuation.md). Nothing that costs money is turned on without the owner's yes. Never invented.

Lot offer: #/lot (Scan, "Price a table or lot from one photo"). Snap a table, pile, or lot; drag a box around each car (or tap it); Hunt reads each box on the phone, matches it to its comps, and prices max offer = (expected sold × 0.87 − $5) × (1 − target margin), default margin 30% of net, commons floor $0.25 (both adjustable), flags STH/TH/chase (names plus the 2026 case lists), and marks matches under 60% "Verify". Each offer, quantity, and sold price can be edited; the sheet shows a lot total and exports CSV or shares as text. Optional automatic car finding uses the owner's AI vision proxy (/detect, off by default). The photo is never saved or uploaded unless that proxy is on; rows save in hunt-lot.

Privacy and compliance: Hunt has no account, sign-in, server copy, payment, analytics, ads, or cookies of its own, and the legal pages say exactly that and list every outside host the browser contacts (GitHub Pages hosting, product photo hosts, barcode and card databases, jsDelivr). Export my data downloads every hunt-/reseller- localStorage key plus the IndexedDB databases hunt-stock and hunt-upc; Delete my data on this device clears all of them after a confirm. Global Privacy Control is honored (Hunt does not sell or share). The footer of every screen states the Amazon Associates line, ages 13 and older, and that Hunt is not affiliated with Mattel, Pokémon, or other mark owners; any screen that shows a tagged Amazon link also shows a "Paid links" disclosure next to it, and tagged links carry rel="sponsored". There is no paid plan; if Pro ships, the price, auto-renewal, and an online cancel as easy as sign-up are shown before payment, and in-app account deletion ships with any account. Contact email, postal address, and governing law stay as TODO placeholders until the owner supplies them; never invent them. The full-audit check (test/full-audit.mjs) covers every route on iPhone WebKit, Android Chromium, and desktop with axe-core WCAG 2.2 AA.

## Required sections

These sections have to stay in the app and in the data.

- Hot Wheels, Matchbox, and Mattel
- Pokémon and every TCG: Magic, One Piece, Lorcana, and Yu-Gi-Oh
- Sports cards
- Sneakers
- Designer / streetwear
- LEGO
- Funko
- Apple
- Consoles
- Calendar
- Blog
- Coupons
- Inventory tracker
- Show Mode
- Barcode lookup
- Photo identification
- Learned catalog
- Search by case
- Item valuation
- Lot offer
- Privacy and compliance
