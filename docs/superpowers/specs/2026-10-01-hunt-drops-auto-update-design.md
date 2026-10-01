# Hunt drops strip and auto-update

**Status:** Approved (Approach A). Hunt stays the home tab.

## Goals

1. The phone shows the latest drops and buy-list data without a hunt for Refresh or a hard refresh.
2. Drops are known first: a pinned strip on Hunt, with the full Drops tab one tap away.
3. The phone UI stays reactive: open, leave, and come back all behave the way a PWA should.

## Locked decisions

- Hunt remains the default tab.
- A Drops strip is pinned at the top of Hunt. It shows the next buy drop and what just landed. Tapping it opens the Drops tab.
- Data reloads on app open and when the page becomes visible again (`visibilitychange`, `pageshow`, and `focus`). A short quiet window collapses the burst of events on first open.
- `drops.json`, `catalog.json`, and the other hunt JSON files are network-first (`cache: "no-store"`). If the network fails and a previous copy exists, that copy stays on screen.
- The service worker cache name is bumped when the shell changes. A new shell shows a one-tap **Update available** banner. Update posts `SKIP_WAITING`, the new worker claims the page, and the page reloads. The header Refresh button stays as a backup and also reloads hunt JSON.
- Buy / Leave rules, full package photos (`object-fit: contain`, no crop), and the existing lanes stay as they are. The strip does not invent a sold price or a drop date.
- Visual polish stays inside the current dark, flame, and gold styles.

## Strip

Product clock is `ResellerDates.APP_TODAY`, the same clock as the Drops tab.

- **Next:** earliest upcoming row whose drop verdict is Buy. If no buy is upcoming, the earliest upcoming row.
- **New:** latest released row whose drop verdict is Buy. If no buy has released, the latest released row.
- Upcoming means `iso >= today`. Released means `iso < today`.
- Empty calendar copy is “Nothing dated”. The strip is still a button to Drops.

## Status line

`#status-live` is only the data status:

- `Checking…` while hunt JSON is in flight
- `Updated just now` after a network success
- `Could not update. Showing the last copy on this phone.` when the network fails and a cached or previous copy is shown

A background refresh does not wipe a focused field, an open sheet, or scroll position.

## Out of scope

Live third-party scrape backends, invented drop dates, and changes to shelf buy rules.
