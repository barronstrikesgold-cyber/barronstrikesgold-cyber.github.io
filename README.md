# Reseller

A phone-first hunt list for one reseller walking Walmart, Target, Goodwill, Best Buy, and Dollar Tree. Five tabs: Hunt, Stores, Drops, Inventory, and Profit. It is a static PWA for GitHub Pages. It does not read live store inventory, and it does not invent a sold price.

The hunt list is the 2026 Hot Wheels and Matchbox resale sheet. Anything that clears fees is on it: Super Treasure Hunts, premium gold chases, Fast & Furious chase, Matchbox SUPER CHASE, exclusives, multipacks, and the few mainlines that clear. Net is sold × 0.87 − $5. Cards say BUY, CHECK, or LOT ONLY. Leave on peg is everything that does not clear.

## What changed

The previous screen was a cream dashboard: portfolio stats, four equal actions, a Strong / Verify dump, and stores plus categories on the same home. Hunt now starts with “Where are you?”, then the aisle, then a short buy list. Passes stay behind “Leave these” unless the whole aisle is a pass.

Cards use a black, flame-orange, and gold layout with large tap targets, Buy / Pass chips, and full-bleed photos when a real picture exists. A hunt card can show a late September 2026 sheet last sold and net (`sold × 0.87 − $5`). That figure is not a live sale and it does not fill Profit. Anything without a sheet sold says “No sold data”. A sourced comp still needs a real URL.

## How a hunt works

| Tab | What it is |
| --- | --- |
| Hunt | Every peg line is on this screen: Super TH, Premium chase, F&F, Matchbox Super Chase, Exclusives, Premium, Multipacks, Mainline, Leave on peg, Selective, and Pokémon. A store chip opens that store’s copy. Search still finds the book, including both Subarus. |
| Catalog | Every Hot Wheels release the wiki lists from 1968 on, one year file at a time. Search name, toy number, or series. Filter by year, line, and worth reselling (the hunt list). Photos hotlink to Mattel Creations when the toy number matches, otherwise to the Hot Wheels Wiki. |
| Stores | That store’s buy list, plus a search link for the store, Google, and Google Shopping. A link is not a shelf count. |
| Drops | The dates that change a hunt. Other releases stay under Other dates. |
| Inventory | The 78-package book, with sell-first and verify flags. |
| Profit | 13% fees and shipping. The result stays blank until you type a sold, then it is labeled an estimate. |

Aisles are Hot Wheels Supers, Car Culture chase, Fast & Furious chase, Matchbox Super Chase, Leave these, and Selective. Supers are gold-flame only: Spectraflame, Real Riders, and the tiny TH. They share a UPC with the regular, so the card says to read the card. Early 2027 Supers are a buy when the card matches and say “No sold data”. Car Culture and Fast & Furious buys are the chase card only. Matchbox is a buy only when the card says SUPER CHASE. Leave these covers mainlines, silver-flame Treasure Hunts, common Boulevard, ZAMAC, and Red, Team Transport about MSRP, and regular Matchbox or Cars movie cars. Selective stays Pass unless a sold clears fees. Pokémon is the 30th Celebration ETB at printed $49.99, and Japanese M6a 30th CELEBRATION near ¥7200. Golf is name-brand clubs with no stored sold. Sneakers, tech, and streetwear are secondary pass lanes. Sports blisters are a Pass at printed price.

Drops mark the 2026 pegs and early 2027 Super / Super Chase freight. A case code is not a national day. Restocks are a typical pattern to confirm with the store: Walmart Monday, Tuesday, or midweek; Target Sunday night or Monday; Dollar Tree freight; Kroger is a vendor stop, not a tab.

You mark On shelf, Not here, or Sold out yourself. Refresh does not write a price.

## Inventory

`data/inventory-seed.json` is the 78-package book dated 2026-09-21.

- Invested band $125–$155. Book target band $285–$415. Those bands are the book, not live solds.
- Lotus Sport Elise (`inv-73`) is STH, Mix H Super, book target $20–$40, and the sell-first piece.
- Both Subaru Impreza WRX STI rows stay Verify STH until the card shows spectraflame blue, Real Riders, a TH on the hood scoop, and a gold flame circle.

Local storage key: `reseller-inventory-v2`. An empty store is seeded. A later visit merges by id. Removed ids stay removed.

## Develop

```bash
npm test
npm run smoke
npx serve .
npm run catalog
```

`npm run catalog` rebuilds `data/hw/` from the Hot Wheels Wiki and Mattel Creations. It only reads public product JSON and the read-only catalog search. It does not create a cart or a checkout, and it does not download image files.

## Deploy

This repository is a GitHub user site. Pages serves the root of `main`. Merging to `main` is what updates https://barronstrikesgold-cyber.github.io/. A pull request branch does not.
