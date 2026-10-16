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

Show Mode is the pricing agent for a vendor table. Search or scan an item and it shows the market value from Hunt's own price data with its source and date, the eBay net (sold × 0.87 − $5), a round show ticket price under market, a floor that never drops below cost plus a margin, and lot pricing for commons. One tap records Sold at show, takes it out of qty, and logs cash or card. A daily show summary totals sales and profit. Show Mode works offline. With no comp it says No verified comp and never invents a price.

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
