# Identify from photo

Scan tab → **Identify from photo** (camera) or **Pick a photo from your library**. Works in iPhone Safari: the camera
button is `<input type="file" accept="image/*" capture="environment">`, the library button is the same input without
`capture`, so iOS offers Photo Library / Take Photo / Choose File.

## What happens (free, on the phone)

1. The photo is drawn to a canvas (max 1600 px), turned grayscale, and contrast-stretched.
2. **Tesseract.js v5** reads the text in the browser. It is lazy-loaded the first time you pick a photo:
   script, worker, WASM core, and English data come from `cdn.jsdelivr.net` (about 7 MB once, then cached by the browser).
   No API key, no upload.
3. `lib/photo-id.js` pulls out:
   - Mattel item codes (`JDP89`, `JDP89-0910`, with fixes for OCR slips like `JDPB9` → `JDP89`)
   - assortment codes (`FYJ44`, `C4982`, from `data/upc/assortments.json`)
   - UPC / EAN digits (check digit enforced, spaces allowed)
   - card numbers (`158/128`) and LEGO set numbers (only when "LEGO" is on the box)
   - name words (stop words dropped)
4. **Codes go through the normal scan path.** An item code Hunt knows, then a UPC, then an assortment code is handed to
   the same lookup the barcode scanner uses: buy list, catalog, `data/upc` index, learned catalog, the assortment
   "Which one is it?" picker, and the keyless web UPC lookup.
5. **No code?** Name words are fuzzy-matched (typo tolerant) against the price list (catalog + market), Monster Trucks
   1:64, your tracker, and your learned catalog. Card numbers and Pokémon markers also ask the keyless
   **Pokémon TCG API** (`api.pokemontcg.io`, with keyless **TCGdex** as the fallback when it is busy). The top 5 show with photos and a % match. Tap one → confirm card →
   **Add to tracker**.
6. **Nothing matches?** Hunt shows the text it read and links: Google Shopping, eBay sold, Amazon (tag `hempsply02-20`),
   and Google Lens (open Lens and pick the same photo; Lens has no URL for a local photo).

## Learned catalog (updates the catalog)

- **On the phone, right away.** Every item you confirm (Add to tracker / save) is written to IndexedDB `hunt-upc` →
  store `learned`, keyed by UPC (GTIN-14) and by `code:<CODE>` (Mattel item code, card number). Shared assortment UPCs
  never learn one truck's name. Future scans and photo matches check it, and **Search** lists matches under
  "Your learned catalog".
- **Shared catalog (everyone's Hunt).** Web finds (barcode web lookup, Pokémon TCG API, vision guesses with a source)
  show **Suggest for the shared Hunt catalog**. It opens a prefilled GitHub issue (label `catalog-add`) with
  `{ name, upc, codes, brand, lane, line, year, imageUrl, sourceUrl, source }`. Nothing is sent until you press
  **Submit** on GitHub.
- `.github/workflows/catalog-intake.yml` runs daily (09:17 UTC = 04:17 CDT / 03:17 CST), when a `catalog-add` issue is
  opened, and on demand. `scripts/catalog-intake.mjs` reads **only issues opened by the repo owner** and re-runs the
  lookup:
  - the photo URL must be https and answer with `image/*`; the source URL must be https;
  - UPC: the keyless web lookup must know it and name the same product; assortment UPCs are refused;
  - card number: the Pokémon TCG API must list that number with that name;
  - otherwise the source page must answer and mention the code or the name.
  Verified entries go to `data/catalog-learned.json`, the code index is rebuilt (`npm run upc-index`), tests run, and
  the workflow commits. Every issue gets a comment and is closed (verified, or why not). Network hiccups are retried
  next run. It uses only the workflow's own `GITHUB_TOKEN`; no secrets are committed.
- Label: the workflow creates the `catalog-add` label on its first run (it runs once when this ships). If you ever see
  an issue without it, add the label by hand and the intake picks it up.

## Optional: AI photo match (off by default)

Scan → **Optional: AI photo match** → paste an https proxy URL → Save (stored in `localStorage` `hunt-vision-proxy`).
When set, Hunt also POSTs a 768 px JPEG plus the OCR text to your proxy and merges its guesses (labelled
"AI vision (your proxy)") into the top 5. **Turn off** removes the URL. Hunt never holds a key.

Request: `POST { "image": "data:image/jpeg;base64,...", "hint": "text Hunt read" }`
Response: `{ "guesses": [ { "name": "...", "brand": "...", "lane": "pokemon|hot-wheels|lego|funko|sneakers|other", "code": "...", "confidence": 0.0-1.0 } ] }`

Lot offer's **Find cars** button uses the same proxy URL at `/detect`. The combined Worker in `docs/valuation.md` serves
this photo match, `/detect`, and `/value`; use it instead of the one below if you want all three.

### Cloudflare Worker template (key stays server-side)

Nothing here is deployed. To use it: Cloudflare dashboard → Workers → Create → paste this → Settings → Variables:
`VISION_API_URL` (an OpenAI-compatible chat-completions endpoint that accepts images), `VISION_MODEL`,
`ALLOWED_ORIGIN` = `https://barronstrikesgold-cyber.github.io`, and the secret `VISION_API_KEY` (encrypted; never in Hunt).

```js
export default {
  async fetch(req, env) {
    const cors = { "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST" || req.headers.get("Origin") !== env.ALLOWED_ORIGIN) return new Response("no", { status: 403, headers: cors });
    const { image, hint } = await req.json();
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(image || "") || image.length > 1_500_000) return new Response("bad image", { status: 400, headers: cors });
    const prompt = "Identify this collectible or product (Hot Wheels, Pokémon card, LEGO, Funko, sneakers...). " +
      "Text read from the photo: " + String(hint || "").slice(0, 400) +
      ' Reply JSON only: {"guesses":[{"name":"","brand":"","lane":"","code":"","confidence":0.0}]}, at most 3, best first. Do not invent codes.';
    const r = await fetch(env.VISION_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.VISION_API_KEY },
      body: JSON.stringify({ model: env.VISION_MODEL, temperature: 0, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] }] }),
    });
    if (!r.ok) return new Response(JSON.stringify({ guesses: [] }), { headers: { ...cors, "Content-Type": "application/json" } });
    const out = await r.json();
    let guesses = [];
    try { guesses = JSON.parse(String(out.choices[0].message.content).replace(/^```json|```$/g, "")).guesses || []; } catch (e) { guesses = []; }
    return new Response(JSON.stringify({ guesses: guesses.slice(0, 5) }), { headers: { ...cors, "Content-Type": "application/json" } });
  },
};
```

### Cost

- Cloudflare Workers free plan: 100,000 requests/day at no charge. A personal Hunt will not exceed it.
- The vision API is the only paid part, billed per image by your provider. A 768 px JPEG is roughly 1,000 input tokens,
  usually a fraction of a cent per photo on current small vision models (about $0.001–$0.01; check your provider's
  price page before turning it on). 100 photos a month ≈ $0.10–$1.
- Set a monthly spending limit on the provider account. Hunt does nothing paid unless you save a proxy URL.

## Privacy

Photos stay on the phone unless you turn on the proxy. See `privacy.html`.

## Limits

- First photo downloads ~7 MB of OCR code/data (cached afterwards). Allow 5–20 s on a phone.
- OCR struggles with glossy blister packs, curved cards, and tiny print. Fill the frame with the code area, avoid glare.
- There is no free, keyless general product search by name; without a code, Hunt matches its own data, the Pokémon TCG
  API, and (if you set it up) your vision proxy, then gives you search links.
- Photo matches are guesses until you check the card. Variants (STH, TH, chase) are not read from photos.
