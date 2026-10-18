# Item value and Lot offer

Two features, both free by default and both run on the phone. Anything that costs money stays **off until the owner
says yes** and sets it up on their own accounts. Hunt never holds an API key.

## 1. Value on every item card

Any item that lands in the tracker (Identify from photo, barcode, Search by case "Look up just this car", the
assortment picker, Show Mode, or by hand) opens on its card. The card's **Value** section fills in on its own and has a
**Refresh value** button.

| Field | Where it comes from |
| --- | --- |
| Last sale (date, price, source link) | The comp linked to the item (`compId`), else one exact code match, else an exact name match in Hunt's price list (`data/market.json`, `data/catalog.json`). Guides are labeled "Sales-based guide", not "sale". |
| Recent comps | Every dated price Hunt has published for that comp (`data/market-history.json`), prices this phone saw on earlier refreshes, and eBay sold comps from the optional proxy. |
| Guide stats | Parsed from the source line when the guide publishes them (e.g. HWPriceGuide "avg $96, 24 recent sales, 30-day range $70–$150"). |
| Trend | Log-linear fit of dated prices. Needs 3+ prices over 14+ days, else "Unknown". Under ±5% per 30 days is "Flat". |
| Grading pop | Hot Wheels / Matchbox: "No pop data" (PSA, CGC, Beckett do not publish pops for diecast). Cards: PSA pop through the optional proxy with a PSA spec ID typed on the card. CGC and Beckett have no public API, so Hunt says so. |
| Sell / Hold / Keep | See rules below. Reasons and the fee math are printed under the call. |
| Projected value | See below. |

### Sell-or-keep rules (lib/valuation.js `recommend`)

- net = sold × 0.87 − $5; cost = what you paid × (1 + 9.7% tax) (the item's own tax % if you changed it).
- **Hold** if the price is rising.
- **Sell** if it is falling, or it is past the release spike (peaked within 45 days of release, now 30+ days after
  release, and 15%+ under that peak).
- **Keep** if an eBay sale would not cover your cost (or sell locally with no fees).
- Otherwise **Sell** (flat or unknown trend with positive fee math). No sold comp = "Not enough data".
- Not financial advice; the card says so.

### Projection (lib/valuation.js `project`)

- Method: log-linear trend fit of dated prices, extended 90 days. Range: an 80% band from how far prices scatter around
  the trend, capped at 0.5×–2× the last sale. Confidence: high (12+ prices over 60+ days, R² ≥ 0.5), medium (8+, R² ≥
  0.3), else low.
- Labeled **"Projection, not a promise."**
- Under 5 dated prices over 30 days it shows **"Not enough data"** with the counts. Today that is almost every item:
  Hunt's published price list keeps one comp per item and its history in git only goes back to Oct 10, 2026. The history
  file grows by one snapshot a day from the market refresh, so projections start to appear as prices change over weeks.
  eBay sold comps from the proxy (up to 90 days) are what make projections useful sooner.

### Price history (free)

`scripts/build-market-history.mjs` writes `data/market-history.json`: per comp id (`m:<market id>`, `c:<catalog id>`),
every dated sold comp and guide value Hunt has published. Nothing estimated. `--from-git` replayed all past commits once;
`.github/workflows/refresh-market.yml` appends after each daily refresh and commits it with `data/market.json`. On the
phone, each refresh also logs the comp price it saw when the price changed (saved with the item in `hunt-stock`).

## 2. Lot offer (#/lot)

Scan → **Price a table or lot from one photo**.

1. Snap the table, pile, or lot (or pick a photo). It is drawn to a canvas on the phone, never saved or uploaded.
2. **Drag a box** around each car, or **tap** a car to drop a box. Each box is cropped, upscaled, and read by the same
   on-device OCR as Identify from photo, then fuzzy-matched to Hunt's comps, Monster Trucks, your tracker, and the
   learned catalog. Other matches show in a picker. Nothing read? Type the name (suggestions from Hunt's Hot Wheels list),
   or use **Add a piece by name**.
3. Each piece gets an offer:
   - **max offer = (expected sold × 0.87 − $5) × (1 − target margin)**. Default margin 30% of net, so at least 30% of
     the net is profit. Stepped down to the quarter (whole dollars at $20+).
   - **Commons floor**: no comp, or net too thin → floor (default $0.25, adjustable to $1 or anything up to $5).
   - **Flags**: STH / TH / Chase from the name and text read ("Super Treasure Hunt", "Treasure Hunt", "chase",
     price-list names ending in "Super"), plus the 2026 case lists (TH castings; STH castings marked "STH?" because the
     regular version looks the same at a glance: check for Spectraflame paint and Real Riders).
   - **Verify**: match under 60%, or no name.
4. Edit any name, qty, sold price, or offer (an edited offer stays yours; clear it to go back to the rule). Totals: pieces,
   your offer, expected sold, net after fees, estimated profit, how many to verify, how many flagged.
5. **Share offer sheet** (iPhone share sheet, else copy) or **Export CSV** (formula-safe). Rows and settings save on this
   phone in `hunt-lot`; Delete my data clears them.

### Optional: automatic car finding (off)

With an AI vision proxy URL saved on Scan (`hunt-vision-proxy`), Lot offer shows **Find cars (your AI proxy)**. It POSTs
a 1024 px JPEG to `<proxy>/detect` and expects
`{ "items": [ { "name": "...", "confidence": 0.0-1.0, "box": [x, y, w, h] } ] }` with the box as 0–1 fractions of the
photo. Every AI name is re-matched to Hunt's comps, and the lower of the two confidences decides "Verify".

## Optional value proxy (off by default)

Scan → **Optional: value proxy for sold comps and pop** → paste an https URL → Save (`hunt-value-proxy`). Refresh value
then POSTs `{ q, code, upc, lane, psaSpec }` to `<proxy>/value` and expects
`{ "sales": [ { "price", "date", "url", "title", "source" } ], "current": { "price", "source", "url", "asOf" }, "pop": { "total", "psa10", "asOf", "source", "url" } }`.
Every field is sanitized on the phone (https links only, numbers only, 60 sales max).

### Sources checked

| Source | Access | Terms that matter | Cost |
| --- | --- | --- | --- |
| Hunt price list + history | Built in | Hunt's own published comps with source links | Free |
| eBay sold (Marketplace Insights API) | **Limited release**: eBay must approve your developer app for the `buy.marketplace.insights` scope. The free Browse API only shows active listings, so Hunt does not use it for sold prices. | eBay API License Agreement; sold data is last 90 days | No published fee; approval is not guaranteed |
| PriceCharting / SportsCardsPro API | Paid subscription with API/CSV access (Legendary tier, listed at $49/month when checked). Token is a `t` parameter, 1 call per second. | **Licensed for internal use only.** Showing it in an app used by others needs a commercial license and written permission. Current values only, no historic sales. Data must be purged when the subscription ends. Covers games, cards, comics, coins; check Hot Wheels coverage before paying. SportsCardsPro is the same company; assume the same terms and verify. | $49/month (owner's yes required) |
| PSA population (PSA Public API) | Bearer token from your PSA account. `GET https://api.psacard.com/publicapi/pop/GetPSASpecPopulation/{specID}` needs the PSA spec ID. | Daily call cap. A free tier of 100 calls/day was documented; 2026 reports say free access may have ended or moved to a paid membership. **Confirm on psacard.com/publicapi before relying on it.** | Free or paid, unconfirmed |
| CGC, Beckett pop | No public API | Hunt links out only | — |
| HWPriceGuide (Hot Wheels) | No API | Hunt's Hot Wheels guide values come from its public pages via the market refresh | Free |
| Cloudflare Worker (the proxy itself) | Your Cloudflare account | Free plan: 100,000 requests/day. Paid plan $5/month only if you outgrow it. | $0 for one owner |
| AI vision (Find cars / photo match) | Your provider account | Provider's terms and privacy policy | About $0.002–$0.02 per lot photo |

### Monthly cost estimate (one owner)

| Setup | What you get | Est. per month |
| --- | --- | --- |
| **Free (default)** | Hunt comps, history, trend/projection when history allows, Hot Wheels "no pop", on-device lot reading | **$0** |
| + Worker with eBay sold (if eBay approves) | Real recent sold comps, so trend and projection work sooner | $0 (Worker free plan) |
| + PSA pop | Card pops by spec ID | $0 if the free tier still exists; otherwise PSA's membership price |
| + AI vision for Find cars | Automatic boxes and names on lot photos | ~$0.10–$1 for 50 lot photos |
| + PriceCharting API | Current graded/ungraded values for cards, games | **$49** |

Set a spending limit on every paid account. Hunt calls nothing paid unless you save a proxy URL, and the proxy calls
nothing paid unless you add that provider's secret.

### Cloudflare Worker template (not deployed)

Cloudflare → Workers → Create → paste → Settings → Variables. `ALLOWED_ORIGIN` =
`https://barronstrikesgold-cyber.github.io`. Each source stays off until you add its secret (encrypted, never in Hunt):
`EBAY_CLIENT_ID` + `EBAY_CLIENT_SECRET` (approved for Marketplace Insights), `PRICECHARTING_TOKEN`, `PSA_TOKEN`,
`VISION_API_URL` + `VISION_MODEL` + `VISION_API_KEY`. This one Worker serves `/value`, `/detect`, and the photo match
from docs/photo-id.md (any other path), so the same URL works for both Scan settings.

```js
const day = () => new Date().toISOString().slice(0, 10);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

export default {
  async fetch(req, env, ctx) {
    const origin = env.ALLOWED_ORIGIN;
    const cors = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" };
    const json = (o) => new Response(JSON.stringify(o), { headers: { ...cors, "Content-Type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST" || req.headers.get("Origin") !== origin) return new Response("no", { status: 403, headers: cors });
    const body = await req.json().catch(() => ({}));
    const path = new URL(req.url).pathname.replace(/\/+$/, "");
    if (path === "/value") {
      // cache answers for 12 h so repeat refreshes do not spend API calls
      const key = new Request("https://cache.local/value?" + encodeURIComponent(JSON.stringify(body)));
      const hit = await caches.default.match(key);
      if (hit) return new Response(hit.body, { headers: { ...cors, "Content-Type": "application/json" } });
      const out = await value(body, env);
      const res = json(out);
      ctx.waitUntil(caches.default.put(key, new Response(JSON.stringify(out), { headers: { "Cache-Control": "max-age=43200" } })));
      return res;
    }
    if (path === "/detect") return json(await vision(env, body.image, "detect"));
    return json(await vision(env, body.image, "guess", body.hint));
  },
};

async function value(b, env) {
  const q = String(b.q || "").slice(0, 160);
  const out = { sales: [], current: null, pop: null };
  // eBay sold: Marketplace Insights (limited release, needs eBay approval)
  if (env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET && q) {
    const t = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + btoa(env.EBAY_CLIENT_ID + ":" + env.EBAY_CLIENT_SECRET) },
      body: "grant_type=client_credentials&scope=" + encodeURIComponent("https://api.ebay.com/oauth/api_scope/buy.marketplace.insights"),
    }).then((r) => r.json()).catch(() => ({}));
    if (t.access_token) {
      const r = await fetch("https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search?limit=50&q=" + encodeURIComponent(q), { headers: { Authorization: "Bearer " + t.access_token, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } });
      if (r.ok) {
        const j = await r.json();
        out.sales = (j.itemSales || []).map((s) => ({ price: num(s.lastSoldPrice && s.lastSoldPrice.value), date: String(s.lastSoldDate || "").slice(0, 10), url: s.itemWebUrl || "", title: s.title || "", source: "eBay sold" })).filter((s) => s.price > 0);
      }
    }
  }
  // PriceCharting: current value (paid subscription; internal use only)
  if (env.PRICECHARTING_TOKEN && (q || b.upc)) {
    const u = new URL("https://www.pricecharting.com/api/product");
    u.searchParams.set("t", env.PRICECHARTING_TOKEN);
    if (b.upc) u.searchParams.set("upc", b.upc); else u.searchParams.set("q", q);
    const j = await fetch(u).then((r) => r.json()).catch(() => ({}));
    const cents = j.status === "success" ? j["loose-price"] || j["new-price"] : null;
    if (cents) out.current = { price: cents / 100, source: "PriceCharting", url: "https://www.pricecharting.com/game/" + j.id, asOf: day() };
  }
  // PSA pop by spec ID. Check the field names against PSA's Swagger page for your token before relying on them.
  if (env.PSA_TOKEN && /^\d{1,12}$/.test(String(b.psaSpec || ""))) {
    const r = await fetch("https://api.psacard.com/publicapi/pop/GetPSASpecPopulation/" + b.psaSpec, { headers: { Authorization: "bearer " + env.PSA_TOKEN } });
    if (r.ok) {
      const j = await r.json();
      const p = j.PSAPop || j;
      out.pop = { total: num(p.Total), psa10: num(p.Grade10), asOf: day(), source: "PSA Public API", url: "https://www.psacard.com/pop" };
    }
  }
  return out;
}

async function vision(env, image, mode, hint) {
  const empty = mode === "detect" ? { items: [] } : { guesses: [] };
  if (!env.VISION_API_KEY || !/^data:image\/(jpeg|png|webp);base64,/.test(image || "") || image.length > 2_000_000) return empty;
  const prompt = mode === "detect"
    ? 'Find every toy car (Hot Wheels, Matchbox, diecast) in this photo. Reply JSON only: {"items":[{"name":"","confidence":0.0,"box":[x,y,w,h]}]} with box as 0-1 fractions of the image width and height, at most 40 items. Use the exact name printed on the card when readable; otherwise your best guess with a low confidence. Do not invent names.'
    : "Identify this collectible or product. Text read from the photo: " + String(hint || "").slice(0, 400) + ' Reply JSON only: {"guesses":[{"name":"","brand":"","lane":"","code":"","confidence":0.0}]}, at most 3. Do not invent codes.';
  const r = await fetch(env.VISION_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.VISION_API_KEY },
    body: JSON.stringify({ model: env.VISION_MODEL, temperature: 0, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] }] }),
  });
  if (!r.ok) return empty;
  try { return JSON.parse(String((await r.json()).choices[0].message.content).replace(/^```json|```$/g, "")); } catch (e) { return empty; }
}
```

## Accuracy limits (real)

- **Comps are thin.** Hunt publishes one sold or guide value per item. Without the eBay proxy, "Recent comps" is usually
  1–2 rows, trend is "Unknown", and the projection says "Not enough data". That is by design: no made-up numbers.
- **Guides are not sales.** HWPriceGuide values are averages of recent sales; their "Oct 2026" date is month-only.
- **Name matching.** An item is valued against an exact name or code match. A near-miss name gets no comp until you link
  one in Edit.
- **Loose cars have no text.** Lot offer reads printed names. Carded cars facing the camera read well in good light;
  loose cars, blister glare, and cards at an angle often read nothing, so you type those. The AI proxy helps with loose
  cars but still guesses, so its rows start as "Verify" when unsure.
- **STH/TH from a photo** are flags to check, not proof. The case lists flag castings that have a TH or STH in 2026.
- **Release spike** needs a release date; only some market items carry one.
- **PSA pop** needs the spec ID (from the PSA pop report), not the card name.
