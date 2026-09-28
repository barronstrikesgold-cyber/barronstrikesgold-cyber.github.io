# Reseller

A phone-first hunt list for one reseller walking Walmart, Target, Goodwill, Best Buy, and Dollar Tree. Five tabs: Hunt, Stores, Drops, Inventory, and Profit. It is a static PWA for GitHub Pages. It does not read live store inventory, and it does not invent a sold price.

The locked rule is on the header and in the lists: if it is not on the buy list, leave it.

## What changed

The previous screen was a cream dashboard: portfolio stats, four equal actions, a Strong / Verify dump, and stores plus categories on the same home. Hunt now starts with “Where are you?”, then the aisle, then a short buy list. Passes stay behind “Leave these” unless the whole aisle is a pass.

Cards use a black, flame-orange, and gold layout with large tap targets, Buy / Pass chips, and full-bleed photos when a real picture exists. A comp is shown only when a source URL is stored. Everything else says “No sold data”.

## How a hunt works

| Tab | What it is |
| --- | --- |
| Hunt | Store, then aisle, then the short buy list. Search still finds the book, including both Subarus. |
| Stores | That store’s buy list, plus a search link for the store, Google, and Google Shopping. A link is not a shelf count. |
| Drops | The dates that change a hunt. Other releases stay under Other dates. |
| Inventory | The 78-package book, with sell-first and verify flags. |
| Profit | 13% fees and shipping. The result stays blank until you type a sold, then it is labeled an estimate. |

Hot Wheels buys are gold-flame Supers only: Spectraflame, Real Riders, and the tiny TH. Regular mainlines are not flips. Supers share a UPC with the regular, so the card says to read the card. Matchbox is a buy only when the card says SUPER CHASE. Pokémon is the 30th Celebration ETB at printed $49.99, and Japanese M6a 30th CELEBRATION near ¥7200. Golf is name-brand clubs with no stored sold. Sneakers, tech, and streetwear are secondary pass lanes. Sports blisters are a Pass at printed price.

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
```

## Deploy

This repository is a GitHub user site. Pages serves the root of `main`. Merging to `main` is what updates https://barronstrikesgold-cyber.github.io/. A pull request branch does not.
