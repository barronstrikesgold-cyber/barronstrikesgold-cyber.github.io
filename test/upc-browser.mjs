/* Barcode lookup end to end: local server (or BASE=https://... for live), iPhone WebKit + Chromium.
 * Types real UPCs into the Scan tab (camera denied), Show Mode, and the tracker. Needs network for the web lookup.
 * SHOTS=/path saves screenshots. ASSORT_ONLY=1 runs only the assortment (one UPC per case) flows. */
import { webkit, chromium, devices } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = process.env.SHOTS || path.join(root, "test-results/upc");
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

const CASES = (process.env.UPCS ? JSON.parse(process.env.UPCS) : [
  { code: "889698487405", label: "funko", lane: "Funko", title: /Child/i },
  { code: "196214105133", label: "pokemon-etb", lane: "Pokémon", title: /Prismatic Evolutions/i },
  { code: "194735151295", label: "hot-wheels", lane: "Hot Wheels", title: /Hot Wheels/i },
]);

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const results = [];

async function boot(browser, opts, name) {
  const context = await browser.newContext(Object.assign({ serviceWorkers: "block" }, opts));
  await context.addInitScript(() => {
    if (!navigator.mediaDevices) Object.defineProperty(navigator, "mediaDevices", { value: {}, configurable: true });
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.setDefaultTimeout(25000);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "What did you find?" }).waitFor();
  return { context, page, errors, name };
}

async function scanTab(page, code) {
  await page.getByRole("tab", { name: "Scan", exact: true }).click();
  await page.locator("#scan-q").waitFor();
  await page.locator("#scan-q").fill(code);
  await page.locator("#scan-form button").click();
}

async function imgState(loc) {
  return loc.evaluate((el) => new Promise((r) => {
    const done = () => r(el.complete && el.naturalWidth > 0 && !/photo-needed/.test(el.src) ? el.src : "fallback:" + el.src);
    if (el.complete && el.naturalWidth) done(); else { el.addEventListener("load", done, { once: true }); el.addEventListener("error", () => setTimeout(done, 1500), { once: true }); setTimeout(done, 8000); }
  })).catch(() => null);
}

async function showTop(page, sel) {
  await page.locator(sel).first().evaluate((el) => { el.scrollIntoView({ block: "start" }); window.scrollBy(0, -170); });
}

/* Monster Trucks 1:64: UPC 887961705393 is shared by every truck in assortment FYJ44 */
async function assortFlows(page, profile) {
  const UPC = "887961705393";
  const t0 = Date.now();
  await scanTab(page, UPC);
  await page.locator("#scan-lookup .upc-assort .upc-assort-item").first().waitFor({ timeout: 30000 });
  const pickText = await page.locator("#scan-lookup").innerText();
  assert(/Which one is it\?/i.test(pickText), "assortment UPC shows Which one is it?");
  assert(/Type the item code from the back of the card \(e\.g\. JDP89\)/i.test(pickText), "the item-code field is labelled");
  assert(/FYJ44/.test(pickText), "the picker names assortment FYJ44");
  const tiles = await page.locator("#scan-lookup .upc-assort-item").count();
  const firstYear = await page.locator("#scan-lookup .upc-assort-year").first().innerText();
  await showTop(page, "#scan-lookup .upc-assort");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(shots, `${profile}-assort-picker-FYJ44.png`) });
  await page.locator("#upc-item-code").fill("batmobile");
  const batTiles = await page.locator("#scan-lookup .upc-assort-item", { hasText: "TV Series Batmobile" }).count();
  assert(batTiles >= 1, "the FYJ44 picker contains TV Series Batmobile");
  await showTop(page, "#scan-lookup .upc-assort");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(shots, `${profile}-assort-picker-filter-batmobile.png`) });
  results.push({ profile, flow: "assort-picker", code: UPC, ms: Date.now() - t0, tiles, firstYear, batmobileTiles: batTiles });
  /* typing the card-back code resolves the exact truck */
  await page.locator("#upc-item-code").fill("JDP89-0910");
  await page.locator("#scan-lookup .upc-picked").waitFor({ timeout: 10000 });
  const picked = await page.locator("#scan-lookup .upc-picked").innerText();
  assert(/TV Series Batmobile/.test(picked) && /JDP89/.test(picked) && /FYJ44/.test(picked), "JDP89 resolves to TV Series Batmobile: " + picked.slice(0, 160));
  const pickedImg = await imgState(page.locator("#scan-lookup .upc-picked .upc-img img"));
  assert(pickedImg && !/^fallback:/.test(pickedImg), "the resolved card has a photo: " + pickedImg);
  await showTop(page, "#scan-lookup .upc-picked");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shots, `${profile}-assort-resolved-JDP89-batmobile.png`) });
  results.push({ profile, flow: "assort-type-code", code: "JDP89-0910", ok: true, image: pickedImg });
  /* Not this one -> tap the tile -> one-tap add */
  await page.locator('#scan-lookup button[data-stk="assort-back"]').click();
  await page.locator("#upc-item-code").fill("batmobile");
  await page.locator("#scan-lookup .upc-assort-item", { hasText: "JDP89" }).first().click();
  await page.locator("#scan-lookup .upc-picked").waitFor();
  await page.locator('#scan-lookup .upc-picked button[data-stk="res-add"]').click();
  await page.locator(".stk-hero h1").waitFor();
  const detail = await page.locator("#screen").innerText();
  assert(/TV Series Batmobile/.test(detail) && detail.includes(UPC) && /JDP89/.test(detail), "the tracker item keeps the truck name, the UPC, and the item code");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(shots, `${profile}-assort-tracker-item-batmobile.png`), fullPage: true });
  results.push({ profile, flow: "assort-tap-add", code: UPC, ok: true, saved: (await page.locator(".stk-hero h1").innerText()).trim() });
  /* the item code works straight from the Scan box */
  await scanTab(page, "JDP89-0910");
  await page.locator("#scan-lookup .upc-picked").waitFor({ timeout: 15000 });
  const direct = await page.locator("#scan-lookup .upc-picked").innerText();
  assert(/TV Series Batmobile/.test(direct), "JDP89-0910 in the Scan box resolves to TV Series Batmobile");
  const directImg = await imgState(page.locator("#scan-lookup .upc-picked .upc-img img"));
  assert(directImg && !/^fallback:/.test(directImg), "the Scan-box item code card has a photo");
  await showTop(page, "#scan-lookup");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shots, `${profile}-scan-box-JDP89-0910.png`) });
  results.push({ profile, flow: "scan-box-item-code", code: "JDP89-0910", ok: true, image: directImg });
}

async function walk(browser, profile, opts) {
  const s = await boot(browser, opts, profile);
  const { page } = s;
  if (process.env.ASSORT_ONLY) {
    await assortFlows(page, profile);
    assert(s.errors.length === 0, profile + " page errors: " + s.errors.join(" | "));
    await s.context.close();
    return;
  }
  for (const c of CASES) {
    const t0 = Date.now();
    await scanTab(page, c.code);
    await page.locator("#scan-lookup .upc-card").first().waitFor({ timeout: 30000 });
    const miss = await page.locator("#scan-lookup .upc-card.is-miss").count();
    const text = await page.locator("#scan-lookup").innerText();
    const ms = Date.now() - t0;
    const imgOk = miss ? null : await page.locator("#scan-lookup .upc-img img").evaluate((el) => new Promise((r) => {
      const done = () => r(el.complete && el.naturalWidth > 0 && !/photo-needed/.test(el.src) ? el.src : "fallback:" + el.src);
      if (el.complete) done(); else { el.addEventListener("load", done, { once: true }); el.addEventListener("error", () => setTimeout(done, 1500), { once: true }); setTimeout(done, 8000); }
    })).catch(() => null);
    await page.locator("#scan-lookup").evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(shots, `${profile}-scan-${c.label}.png`), fullPage: false });
    results.push({ profile, flow: "scan", code: c.code, hit: !miss, ms, title: miss ? "" : (text.split("\n").find((l) => c.title.test(l)) || ""), image: imgOk, laneOk: text.includes(c.lane) });
    if (!miss) assert(c.title.test(text), `${profile} ${c.code}: title ${c.title} not in card: ${text.slice(0, 200)}`);
    await page.locator("#header-back").click().catch(() => {});
  }
  /* one-tap add from the Scan tab */
  const first = CASES[0];
  await scanTab(page, first.code);
  await page.locator("#scan-lookup .upc-card").first().waitFor({ timeout: 30000 });
  const repeatMs = await page.evaluate(() => performance.now());
  const add = page.locator('#scan-lookup button[data-stk="res-add"]');
  if (await add.count()) {
    await add.first().click();
    await page.locator(".stk-hero h1").waitFor();
    const detail = await page.locator("#screen").innerText();
    assert(detail.includes(first.code), "the saved item keeps the scanned code");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(shots, `${profile}-tracker-item-${first.label}.png`), fullPage: true });
    results.push({ profile, flow: "one-tap-add", code: first.code, ok: true, saved: (detail.match(/Brand\n?\s*([^\n]+)/) || [])[1] || "" });
  }
  /* repeat scan is cached */
  const t1 = Date.now();
  await scanTab(page, first.code);
  await page.locator("#scan-lookup").waitFor();
  await page.locator("#scan-lookup .stk-hit[data-stk='res-open']").first().waitFor({ timeout: 10000 });
  await page.locator("#scan-lookup .upc-card").first().waitFor({ timeout: 10000 });
  const cachedText = await page.locator("#scan-lookup").innerText();
  results.push({ profile, flow: "repeat-scan", code: first.code, ms: Date.now() - t1, cached: /saved on this phone/i.test(cachedText), inTracker: /In your tracker/i.test(cachedText) });
  await page.locator("#scan-lookup").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: path.join(shots, `${profile}-repeat-scan-cached.png`) });
  /* Show Mode price check uses the scan flow */
  await page.goto(base + "#/stuff/show", { waitUntil: "domcontentloaded" });
  await page.locator("#stk-show-q").waitFor();
  await page.locator("#stk-show-q").fill(CASES[1].code);
  await page.locator("#stk-res .upc-card").first().waitFor({ timeout: 30000 });
  await page.locator("#stk-res").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shots, `${profile}-show-mode-${CASES[1].label}.png`) });
  results.push({ profile, flow: "show-mode", code: CASES[1].code, hit: (await page.locator("#stk-res .upc-card.is-miss").count()) === 0 });
  /* Mattel peg code hits Hunt's own catalog */
  await scanTab(page, "JHX94");
  await page.locator("#scan-lookup .upc-row").first().waitFor({ timeout: 15000 });
  const mattel = await page.locator("#scan-lookup").innerText();
  assert(/Honda Civic Type R/.test(mattel), "JHX94 matches the catalog");
  await page.locator("#scan-lookup").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(shots, `${profile}-mattel-code-JHX94.png`) });
  results.push({ profile, flow: "mattel-code", code: "JHX94", ok: true });
  /* real code no keyless database knows (Hot Wheels Alfa Romeo GTV6, Retro Racers): search links */
  const missCode = process.env.MISS || "194735103133";
  await scanTab(page, missCode);
  await page.locator("#scan-lookup .upc-card.is-miss").waitFor({ timeout: 30000 });
  const links = await page.locator("#scan-lookup .upc-links a").evaluateAll((as) => as.map((a) => a.href));
  assert(links.some((h) => h.includes("tag=hempsply02-20")), "Amazon link carries the tag");
  assert(await page.getByRole("button", { name: "Add this code to inventory" }).count() === 1, "bare-code button stays");
  await page.locator("#scan-lookup").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shots, `${profile}-unknown-code-links.png`) });
  const missText = await page.locator("#scan-lookup").innerText();
  results.push({ profile, flow: "miss-links", code: missCode, links: links.length, prefixBrand: /prefix belongs to ([^.]+)/i.exec(missText) ? /prefix belongs to ([^.]+)/i.exec(missText)[1] : "" });
  await assortFlows(page, profile);
  assert(s.errors.length === 0, profile + " page errors: " + s.errors.join(" | "));
  await s.context.close();
}

const iphone = devices["iPhone 13"];
try {
  if (process.env.ONLY !== "chromium") {
    const wk = await webkit.launch();
    try { await walk(wk, "iphone-webkit", iphone); } finally { await wk.close(); }
  }
  if (process.env.ONLY !== "webkit") {
    const cr = await chromium.launch();
    try { await walk(cr, "iphone-chromium", { viewport: iphone.viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: iphone.userAgent.replace("Version/15.0 Mobile/15E148 Safari/604.1", "CriOS/129.0 Mobile/15E148 Safari/604.1") }); } finally { await cr.close(); }
  }
  console.log(JSON.stringify({ ok: true, base, results }, null, 2));
} catch (err) {
  console.error(JSON.stringify({ ok: false, base, results }, null, 2));
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
} finally {
  if (server) server.close();
}
