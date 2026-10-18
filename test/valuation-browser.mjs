/* Item value + Lot offer, end to end: local server (or BASE=https://... for live), iPhone WebKit + Chromium.
 * 1. Identify from photo -> Add to tracker -> the item card's Value section (last sale, guide, trend, pop, call, projection).
 * 2. A card item: PSA pop needs the proxy; a cheap item with cost: Keep.
 * 3. A mocked value proxy (https://value.test, intercepted; nothing real is called): eBay-style sold comps -> trend, Hold, projection.
 * 4. Lot offer: a drawn photo of a table with 3 carded cars, boxes dragged on the canvas, on-device OCR, offers, edit, add by
 *    name (STH flag), totals, CSV, share. 5. A mocked AI vision /detect. SHOTS=/path saves screenshots. */
import { webkit, chromium, devices } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = process.env.SHOTS || path.join(root, "test-results/valuation");
fs.mkdirSync(shots, { recursive: true });
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".webmanifest": "application/manifest+json" };
let server = null;
let base = process.env.BASE;
if (!base) {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (url.pathname === "/") file = path.join(root, "index.html");
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end("missing"); return; }
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(buf);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/`;
}
if (!base.endsWith("/")) base += "/";

function assert(cond, msg) { if (!cond) throw new Error(msg); }
/* optional axe-core WCAG 2.2 AA pass on the new screens: AXE=/path/to/axe.min.js (default /tmp/axe/...) */
const axePath = process.env.AXE || "/tmp/axe/node_modules/axe-core/axe.min.js";
async function axe(page, label, profile) {
  if (!fs.existsSync(axePath)) return;
  await page.addScriptTag({ content: fs.readFileSync(axePath, "utf8") });
  const out = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id + ": " + v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", "));
  });
  results.push({ profile, flow: "axe-" + label, ok: !out.length, violations: out });
  assert(!out.length, "axe " + label + ": " + out.join(" | "));
}
const results = [];
const proxyCalls = [];

async function boot(browser, opts) {
  const context = await browser.newContext(Object.assign({ serviceWorkers: "block", acceptDownloads: true }, opts));
  await context.addInitScript(() => {
    if (!navigator.mediaDevices) Object.defineProperty(navigator, "mediaDevices", { value: {}, configurable: true });
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    Object.defineProperty(navigator, "share", { configurable: true, value: (d) => { window.__shared = d && d.text; return Promise.resolve(); } });
  });
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  /* mocked owner proxies: nothing leaves the test machine */
  await context.route("https://value.test/**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    proxyCalls.push({ url: route.request().url(), body: route.request().postData() });
    const sales = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(Date.parse("2026-06-20") + i * 12 * 86400000).toISOString().slice(0, 10);
      sales.push({ price: Math.round((30 * Math.pow(1.05, i)) * 100) / 100, date: d, url: "https://www.ebay.com/itm/1000" + i, title: "Test sold listing " + (i + 1), source: "eBay sold (test proxy)" });
    }
    return route.fulfill({ status: 200, headers: Object.assign({ "Content-Type": "application/json" }, cors), body: JSON.stringify({ sales, current: { price: 47, source: "PriceCharting (test)", asOf: "2026-10-18" }, pop: null }) });
  });
  await context.route("https://vision.test/**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    proxyCalls.push({ url: route.request().url(), size: (route.request().postData() || "").length });
    return route.fulfill({ status: 200, headers: Object.assign({ "Content-Type": "application/json" }, cors), body: JSON.stringify({ items: [{ name: "Honda Civic Custom Super", confidence: 0.82, box: [0.36, 0.08, 0.28, 0.8] }, { name: "Mystery loose car", confidence: 0.3, box: [0.7, 0.1, 0.25, 0.75] }] }) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => { if (!/access control checks/.test(err.message)) errors.push(err.message); });
  page.setDefaultTimeout(30000);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "What did you find?" }).waitFor();
  return { context, page, errors };
}

async function drawPhoto(page, lines) {
  const b64 = await page.evaluate((ls) => {
    const c = document.createElement("canvas");
    c.width = 1400; c.height = 160 + ls.length * 110;
    const x = c.getContext("2d");
    x.fillStyle = "#f4f1ea"; x.fillRect(0, 0, c.width, c.height);
    x.translate(30, 10); x.rotate(-0.012);
    x.fillStyle = "#111"; x.font = "bold 72px Arial, Helvetica, sans-serif";
    ls.forEach((l, i) => x.fillText(l, 50, 130 + i * 110));
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  }, lines);
  return Buffer.from(b64, "base64");
}

/* a "table": wood background, three blister cards side by side with the name printed big */
async function drawTable(page, names) {
  const b64 = await page.evaluate((ns) => {
    const c = document.createElement("canvas");
    c.width = 1800; c.height = 1000;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 1800, 1000); g.addColorStop(0, "#6b4a2b"); g.addColorStop(1, "#8a6239");
    x.fillStyle = g; x.fillRect(0, 0, 1800, 1000);
    ns.forEach((n, i) => {
      const left = 60 + i * 590;
      x.fillStyle = "#1b4fd6"; x.fillRect(left, 80, 520, 840);
      x.fillStyle = "#f4f1ea"; x.fillRect(left + 30, 120, 460, 520);
      x.fillStyle = "#e10600"; x.beginPath(); x.arc(left + 260, 760, 90, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#111"; x.font = "bold 58px Arial, Helvetica, sans-serif";
      n.split(" ").reduce((rows, w) => { const last = rows[rows.length - 1]; if (last && (last + " " + w).length <= 11) rows[rows.length - 1] = last + " " + w; else rows.push(w); return rows; }, [])
        .forEach((line, k) => x.fillText(line, left + 50, 210 + k * 80));
    });
    return c.toDataURL("image/jpeg", 0.92).split(",")[1];
  }, names);
  return Buffer.from(b64, "base64");
}

async function openScan(page) {
  await page.getByRole("tab", { name: "Scan", exact: true }).click();
  await page.locator("#photo-camera").waitFor({ state: "attached" });
}
async function showTop(page, sel, off) {
  await page.locator(sel).first().evaluate((el, o) => { el.scrollIntoView({ block: "start" }); window.scrollBy(0, -(o || 120)); }, off || 120);
  await page.waitForTimeout(400);
}
async function seed(page, raw) {
  return page.evaluate(async (r) => {
    await window.HuntStock.ensure();
    const saved = await window.HuntStock.store.save(window.HuntStockData.normalize(r));
    return saved.id;
  }, raw);
}
async function openItem(page, id) {
  await page.goto(base + "#/stuff/tracker/item/" + id, { waitUntil: "domcontentloaded" });
  await page.locator("#val-section").waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
}
/* drag a box on the lot canvas with pointer events (fractions of the canvas) */
async function dragBox(page, b) {
  await page.evaluate((box) => {
    const cv = document.getElementById("lot-canvas");
    const r = cv.getBoundingClientRect();
    const at = (fx, fy) => ({ clientX: r.left + fx * r.width, clientY: r.top + fy * r.height, bubbles: true, pointerId: 7, pointerType: "touch", isPrimary: true });
    cv.dispatchEvent(new PointerEvent("pointerdown", at(box[0], box[1])));
    cv.dispatchEvent(new PointerEvent("pointermove", at(box[0] + box[2] / 2, box[1] + box[3] / 2)));
    cv.dispatchEvent(new PointerEvent("pointermove", at(box[0] + box[2], box[1] + box[3])));
    cv.dispatchEvent(new PointerEvent("pointerup", at(box[0] + box[2], box[1] + box[3])));
  }, b);
}

async function flows(page, profile) {
  /* 1. photo -> tracker -> Value */
  if (process.env.DEBUG) console.log("keys0", await page.evaluate(() => Object.keys(window.HuntStock || {}).join(",")));
  await openScan(page);
  let t0 = Date.now();
  await page.locator("#photo-library").setInputFiles({ name: "ferrari.jpg", mimeType: "image/jpeg", buffer: await drawPhoto(page, ["HOT WHEELS", "FERRARI F40 COMPETIZIONE", "SUPER TREASURE HUNT"]) });
  await page.locator("#scan-lookup .photo-cand").first().waitFor({ timeout: 150000 });
  const cand = page.locator("#scan-lookup .photo-cand", { hasText: "Ferrari F40 Competizione" }).first();
  assert(await cand.count(), "photo finds Ferrari F40 Competizione Super");
  await cand.click();
  if (process.env.DEBUG) console.log("keys1", await page.evaluate(() => Object.keys(window.HuntStock || {}).join(",")));
  await page.locator('#scan-lookup .upc-picked button[data-stk="res-add"]').click();
  await page.locator("#val-section").waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  const v1 = await page.locator("#val-section").innerText();
  assert(/Sales-based guide|Last sale/i.test(v1) && /\$145/.test(v1), "Value shows the comp ($145): " + v1.slice(0, 200));
  assert(/avg \$145/.test(v1) && /21 recent sales/.test(v1), "guide stats parsed");
  assert(/No pop data/.test(v1), "Hot Wheels: no pop data");
  assert(/Not enough data/.test(v1) && /Projections are never a promise/.test(v1), "thin history: projection says not enough data");
  assert(/Sell|Hold|Keep|Not enough data/.test(await page.locator(".val-badge").innerText()), "a call is shown");
  assert(/× 0\.87 − \$5/.test(v1), "the fee math is printed");
  await showTop(page, "#val-section");
  await page.screenshot({ path: path.join(shots, `${profile}-1-photo-to-card-value.png`) });
  results.push({ profile, flow: "photo-to-value", ok: true, ms: Date.now() - t0, call: (await page.locator(".val-badge").innerText()).trim() });

  /* refresh keeps working offline-first (no proxy) */
  await page.locator('[data-stk="value-refresh"]').click();
  await page.waitForFunction(() => /Value refreshed/.test((document.querySelector(".stk-flash") || {}).textContent || ""), null, { timeout: 15000 });
  assert(/Value refreshed from Hunt's comps/.test(await page.locator(".stk-flash").innerText()), "refresh without proxy uses free comps");

  /* 2a. a card: PSA pop needs the proxy + spec */
  const pk = await seed(page, { name: "Pokémon 30th Celebration ETB", lane: "pokemon", compId: "m:" + (await page.evaluate(() => { const s = window.HuntApp.data().market.sections.find((x) => x.id === "pokemon"); return s.items.find((i) => /30th Celebration ETB/.test(i.name)).id; })), cost: 59.99, qty: 1 });
  await openItem(page, pk);
  const v2 = await page.locator("#val-section").innerText();
  assert(/PSA spec ID/i.test(v2) && /CGC and Beckett/.test(v2), "cards explain PSA pop + proxy");
  assert(/Last sale/i.test(v2) && /\$163\.21/.test(v2), "sealed Pokémon shows its sold comp");
  await showTop(page, "#val-section");
  await page.screenshot({ path: path.join(shots, `${profile}-2-pokemon-value-pop.png`) });
  results.push({ profile, flow: "card-pop", ok: true, call: (await page.locator(".val-badge").innerText()).trim() });

  /* 2b. a common bought too high: Keep */
  const lotus = await seed(page, { name: "Lotus Sport Elise Super", lane: "hot-wheels", compId: "c:lotus", cost: 30, qty: 1 });
  await openItem(page, lotus);
  const v3 = await page.locator(".val-rec").innerText();
  assert(/Keep/.test(v3) && /would not cover your cost/.test(v3), "eBay net under cost: Keep — " + v3.slice(0, 160));
  await showTop(page, "#val-section");
  await page.screenshot({ path: path.join(shots, `${profile}-3-keep-under-cost.png`) });
  results.push({ profile, flow: "keep", ok: true });

  /* 3. mocked value proxy: sold comps -> rising -> Hold + projection */
  await page.evaluate(() => localStorage.setItem("hunt-value-proxy", "https://value.test"));
  const civic = await seed(page, { name: "Honda Civic Custom Super", lane: "hot-wheels", compId: "c:civic", cost: 10, qty: 1 });
  await openItem(page, civic);
  await page.locator('[data-stk="value-refresh"]').click();
  await page.waitForFunction(() => /Value refreshed/.test((document.querySelector(".stk-flash") || {}).textContent || ""), null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const v4 = await page.locator("#val-section").innerText();
  assert(/Value refreshed with your proxy/.test(await page.locator(".stk-flash").innerText().catch(() => "")) || /Your value proxy is on/.test(v4), "refresh used the proxy");
  assert(/Hold/.test(await page.locator(".val-badge").innerText()) && /rising/i.test(v4), "rising sold comps: Hold — " + v4.slice(0, 200));
  assert(/Projection, not a promise\./.test(v4) && /Range \$/.test(v4) && /confidence/.test(v4) && /Log-linear/.test(v4), "projection shows range, confidence, method, label");
  assert(/Proxy current value: \$47/.test(v4), "proxy current value shown");
  const sent = proxyCalls.filter((c) => /value\.test\/value/.test(c.url)).pop();
  assert(sent && /Honda Civic Custom Super/.test(sent.body) && !/cost|qty/.test(sent.body), "proxy gets only name/code/lane");
  await page.locator(".val-comps summary").click();
  await showTop(page, ".val-rec");
  await page.screenshot({ path: path.join(shots, `${profile}-4-proxy-hold-projection.png`) });
  await showTop(page, ".val-proj", 80);
  await page.screenshot({ path: path.join(shots, `${profile}-4b-projection-comps.png`) });
  await axe(page, "value-card", profile);
  results.push({ profile, flow: "proxy-projection", ok: true, projection: (await page.locator(".val-proj").innerText()).replace(/\s+/g, " ").slice(0, 120) });
  await page.evaluate(() => localStorage.removeItem("hunt-value-proxy"));

  /* 4. Lot offer from a table photo */
  await openScan(page);
  await page.locator(".lot-entry a").click();
  await page.locator("#lot-page h1").waitFor();
  t0 = Date.now();
  await page.locator("#lot-library").setInputFiles({ name: "table.jpg", mimeType: "image/jpeg", buffer: await drawTable(page, ["FERRARI F40 COMPETIZIONE", "HONDA CIVIC CUSTOM", "LOTUS SPORT ELISE"]) });
  await page.locator("#lot-canvas").waitFor();
  await page.waitForTimeout(500);
  await dragBox(page, [0.04, 0.09, 0.28, 0.6]);
  await dragBox(page, [0.36, 0.09, 0.28, 0.6]);
  await dragBox(page, [0.69, 0.09, 0.28, 0.6]);
  await page.waitForFunction(() => document.querySelectorAll("#lot-rows .lot-row").length === 3 && !document.querySelector("#lot-rows .lot-status") || (document.querySelectorAll("#lot-rows .lot-row").length === 3 && ![...document.querySelectorAll("#lot-rows .lot-status")].some((s) => /Reading/.test(s.textContent))), null, { timeout: 180000 });
  const names = await page.locator('#lot-rows input[data-lot-f="name"]').evaluateAll((els) => els.map((e) => e.value));
  const matched = names.filter((n, i) => [/Ferrari F40/, /Civic Custom/, /Lotus Sport Elise/][i].test(n)).length;
  await showTop(page, "#lot-canvas", 70);
  await page.screenshot({ path: path.join(shots, `${profile}-5-lot-boxes.png`) });
  results.push({ profile, flow: "lot-ocr", ok: matched >= 2, matched, names, ms: Date.now() - t0 });
  assert(matched >= 2, "lot OCR matched at least 2 of 3 cards: " + names.join(" | "));
  const offers = await page.locator('#lot-rows input[data-lot-f="offer"]').evaluateAll((els) => els.map((e) => Number(e.value)));
  assert(offers.every((o) => o > 0), "every piece has an offer");
  const ferrari = names.findIndex((n) => /Ferrari F40/.test(n));
  if (ferrari !== -1) assert(offers[ferrari] === 84, "Ferrari offer = (145×0.87−5)×0.7 → $84, got " + offers[ferrari]);
  const flags = await page.locator("#lot-rows .lot-flag").allInnerTexts();
  assert(flags.some((f) => /STH/.test(f)), "STH flags on 'Super' names");

  /* edit an offer, add by name, change margin */
  await page.locator('#lot-rows input[data-lot-f="offer"]').nth(2).fill("20");
  await page.locator('#lot-rows input[data-lot-f="offer"]').nth(2).dispatchEvent("change");
  await page.locator("#lot-add").fill("Drift-Ender");
  await page.locator("#lot-add-form button").click();
  await page.waitForFunction(() => document.querySelectorAll("#lot-rows .lot-row").length === 4);
  const drift = await page.locator("#lot-rows .lot-row").nth(3).innerText();
  assert(/STH/.test(drift) && /Verify/i.test(drift), "an STH name is flagged and a non-exact name match is marked verify: " + drift.slice(0, 160));
  await page.locator("#lot-margin").fill("40");
  await page.locator("#lot-margin").dispatchEvent("change");
  await page.waitForTimeout(300);
  const tot = await page.locator("#lot-totals").innerText();
  assert(/Your offer/i.test(tot) && /Est\. profit/i.test(tot) && /to verify/i.test(tot), "lot totals: " + tot.replace(/\s+/g, " "));
  const kept = await page.locator('#lot-rows input[data-lot-f="offer"]').nth(2).inputValue();
  assert(kept === "20", "an edited offer stays when the margin changes");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.locator('[data-lot="csv"]').click()]);
  const csv = fs.readFileSync(await dl.path(), "utf8");
  assert(/^#,Item,Qty/.test(csv) && /Lot total/.test(csv) && csv.split("\n").length >= 6, "CSV offer sheet");
  fs.writeFileSync(path.join(shots, `${profile}-lot-offer.csv`), csv);
  await page.locator('[data-lot="share"]').click();
  const shared = await page.evaluate(() => window.__shared || "");
  assert(/Hunt lot offer/.test(shared) && /Drift-Ender/.test(shared), "share sheet text");
  await showTop(page, "#lot-rows", 90);
  await page.screenshot({ path: path.join(shots, `${profile}-6-lot-sheet.png`) });
  await showTop(page, "#lot-totals", 200);
  await page.screenshot({ path: path.join(shots, `${profile}-7-lot-totals.png`) });
  await axe(page, "lot-sheet", profile);
  results.push({ profile, flow: "lot-sheet", ok: true, totals: tot.replace(/\s+/g, " ").slice(0, 160) });

  /* persisted on the phone, without the photo */
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("hunt-lot")));
  assert(stored.rows.length === 4 && !JSON.stringify(stored).includes("data:image"), "hunt-lot keeps rows, never the photo");

  /* 5. mocked AI vision /detect */
  await page.evaluate(() => localStorage.setItem("hunt-vision-proxy", "https://vision.test"));
  await page.locator('[data-lot="clear"]').evaluate((b) => { window.confirm = () => true; b.click(); });
  await page.locator("#lot-library").setInputFiles({ name: "table2.jpg", mimeType: "image/jpeg", buffer: await drawTable(page, ["FERRARI F40 COMPETIZIONE", "HONDA CIVIC CUSTOM", "LOTUS SPORT ELISE"]) });
  await page.locator('[data-lot="detect"]').click();
  await page.waitForFunction(() => document.querySelectorAll("#lot-rows .lot-row").length === 2, null, { timeout: 15000 });
  const ai = await page.locator("#lot-rows").innerText();
  const aiNames = await page.locator('#lot-rows input[data-lot-f="name"]').evaluateAll((els) => els.map((e) => e.value));
  assert(aiNames[0] === "Honda Civic Custom Super" && /AI guess/i.test(ai) && /Verify/i.test(ai), "AI rows matched and low confidence marked verify: " + aiNames.join(" | ") + " / " + ai.slice(0, 200));
  const det = proxyCalls.filter((c) => /vision\.test\/detect/.test(c.url)).pop();
  assert(det && det.size < 1500000, "detect sent one downsized photo");
  await showTop(page, "#lot-canvas", 70);
  await page.screenshot({ path: path.join(shots, `${profile}-8-lot-ai-detect.png`) });
  results.push({ profile, flow: "lot-ai", ok: true });
  await page.evaluate(() => localStorage.removeItem("hunt-vision-proxy"));
}

const runs = [
  { name: "iphone-webkit", type: webkit, opts: devices["iPhone 13"] },
  { name: "iphone-chromium", type: chromium, opts: Object.assign({}, devices["iPhone 13"]) },
].filter((r) => !process.env.ONLY || r.name.includes(process.env.ONLY));

let failed = 0;
for (const run of runs) {
  const opts = Object.assign({}, run.opts);
  delete opts.defaultBrowserType;
  const browser = await run.type.launch();
  const s = await boot(browser, opts);
  try {
    await flows(s.page, run.name);
    assert(!s.errors.length, "page errors: " + s.errors.join(" | "));
  } catch (err) {
    failed += 1;
    const dbg = await s.page.evaluate(() => { let vf = ""; try { const id = location.hash.split("/").pop(); vf = JSON.stringify(window.HuntStock.valuationFor(window.HuntStock.store.get(id))).slice(0, 200); } catch (e) { vf = "ERR " + e.message + " " + (e.stack || "").slice(0, 300); } return { hash: location.hash, val: !!document.getElementById("val-section"), sp: document.getElementById("screen").innerHTML.indexOf("Show pricing"), vf }; }).catch((e) => ({ e: e.message }));
    results.push({ profile: run.name, ok: false, error: String(err.message || err).slice(0, 500), errors: s.errors.slice(0, 5), dbg });
    await s.page.screenshot({ path: path.join(shots, `${run.name}-FAILED.png`) }).catch(() => {});
  }
  await browser.close();
}
if (server) server.close();
fs.writeFileSync(path.join(shots, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
console.log(failed ? `FAILED ${failed}` : `valuation browser ok (${results.length} checks)`);
process.exit(failed ? 1 : 0);
