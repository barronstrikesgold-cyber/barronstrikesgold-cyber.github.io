/* Search by case, end to end: local server (or BASE=https://... for live), iPhone WebKit + Chromium.
 * Draws test photos on a canvas, feeds them to the Scan tab's photo input, and checks what Hunt resolves.
 * Needs network (Tesseract.js from jsDelivr, Pokémon TCG API, product photos). SHOTS=/path saves screenshots.
 * REAL_PHOTO=/path/to.jpg adds the owner's card-back photo (expects JDP89 / TV Series Batmobile). */
import { webkit, chromium, devices } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = process.env.SHOTS || path.join(root, "test-results/hw-cases");
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
const results = [];
const thirdParty = [];

async function boot(browser, opts) {
  const context = await browser.newContext(Object.assign({ serviceWorkers: "block" }, opts));
  await context.addInitScript(() => {
    if (!navigator.mediaDevices) Object.defineProperty(navigator, "mediaDevices", { value: {}, configurable: true });
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
  });
  const page = await context.newPage();
  const errors = [];
  /* WebKit reports a failed third-party API call (e.g. the keyless Pokémon TCG API answering 500 without CORS) as a page
   * error; Hunt retries and falls back, so count those separately instead of failing the run. */
  page.on("pageerror", (err) => {
    if (/due to access control checks/.test(err.message) && /api\.pokemontcg\.io|api\.tcgdex\.net/.test(err.message)) { thirdParty.push(err.message.slice(0, 120)); return; }
    errors.push(err.message);
  });
  page.setDefaultTimeout(30000);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "What did you find?" }).waitFor();
  return { context, page, errors };
}

/* a plain "photo": dark text on a light card, slightly tilted like a hand-held shot */
async function drawPhoto(page, lines) {
  const b64 = await page.evaluate((ls) => {
    const c = document.createElement("canvas");
    c.width = 1400;
    c.height = 160 + ls.length * 110;
    const x = c.getContext("2d");
    x.fillStyle = "#f4f1ea";
    x.fillRect(0, 0, c.width, c.height);
    x.translate(30, 10);
    x.rotate(-0.012);
    x.fillStyle = "#111";
    x.font = "bold 72px Arial, Helvetica, sans-serif";
    ls.forEach((l, i) => x.fillText(l, 50, 130 + i * 110));
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  }, lines);
  return Buffer.from(b64, "base64");
}

async function openScan(page) {
  await page.getByRole("tab", { name: "Scan", exact: true }).click();
  await page.locator("#photo-camera").waitFor({ state: "attached" });
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

async function flows(page, profile) {
  /* 1. Catalog: a card code with the case letter */
  await page.getByRole("tab", { name: "Catalog", exact: true }).click();
  await page.locator("#case-q").waitFor();
  await page.locator("#case-q").fill("JJK58-N9C0N");
  await page.locator("#case-form button").click();
  await page.locator(".hwcase .hwcase-car").first().waitFor({ timeout: 20000 });
  let txt = await page.locator(".hwcase").innerText();
  assert(/2026 case N/i.test(txt), "JJK58-N9C0N opens 2026 case N: " + txt.slice(0, 80));
  assert(/STH '23 Ram 1500/.test(txt) && /TH Fast Fish/.test(txt), "case N flags STH '23 Ram 1500 and TH Fast Fish");
  assert(/Qty per case: not published/.test(txt), "quantities say not published");
  const hit = await page.locator(".hwcase-car.is-hit").innerText();
  assert(/'23 Ram 1500/.test(hit) && /JJK58/.test(hit), "the scanned card's car is highlighted");
  await page.locator(".hwcase-car.is-hit").scrollIntoViewIfNeeded();
  const img = await imgState(page.locator(".hwcase-car.is-hit img"));
  assert(img && !/^fallback:/.test(img), "the highlighted car has a photo");
  await page.locator("#case-cost").fill("1.25");
  await page.locator("#case-cost").dispatchEvent("change");
  await page.waitForTimeout(500);
  const fees = await page.locator(".hwcase-fee").allInnerTexts();
  await page.locator(".hwcase-flags").first().evaluate((el) => { el.scrollIntoView({ block: "start" }); window.scrollBy(0, -200); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shots, `${profile}-case-N-JJK58.png`) });
  results.push({ profile, flow: "catalog-card-code", ok: true, image: img, feeLines: fees.length, fee: fees[0] || "" });

  /* 2. letter chip: case P */
  await page.locator(".case-chips a", { hasText: /^P$/ }).click();
  await page.locator(".hwcase h3", { hasText: "case P" }).waitFor();
  txt = await page.locator(".hwcase").innerText();
  assert(/STH '70 Plymouth AAR Cuda/.test(txt) && /TH Nissan Skyline HT 2000GT-X/.test(txt), "case P flags STH '70 AAR Cuda and TH Nissan Skyline HT 2000GT-X");
  await page.locator(".hwcase-car.is-chase").first().evaluate((el) => { el.scrollIntoView({ block: "start" }); window.scrollBy(0, -260); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shots, `${profile}-case-P.png`) });
  results.push({ profile, flow: "catalog-case-P", ok: true });

  /* 3. year + letter */
  await page.locator("#case-q").fill("2026 Q");
  await page.locator("#case-form button").click();
  await page.locator(".hwcase h3", { hasText: "case Q" }).waitFor();
  results.push({ profile, flow: "catalog-year-letter", ok: true });

  /* 4. Scan box: case-box code, then a bare assortment */
  await page.getByRole("tab", { name: "Scan", exact: true }).click();
  await page.locator("#scan-q").waitFor();
  await page.locator("#scan-q").fill("L2593-973N");
  await page.locator("#scan-form button").click();
  await page.locator("#scan-case .hwcase-car").first().waitFor({ timeout: 20000 });
  txt = await page.locator("#scan-case").innerText();
  assert(/2026 case N/i.test(txt) && /L2593/.test(txt), "L2593-973N in the Scan box shows case N");
  await showTop(page, "#scan-case");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shots, `${profile}-scan-L2593-973N.png`) });
  await page.getByRole("tab", { name: "Scan", exact: true }).click();
  await page.locator("#scan-q").fill("C4982");
  await page.locator("#scan-form button").click();
  await page.locator("#scan-case .case-chips a").first().waitFor({ timeout: 20000 });
  assert((await page.locator("#scan-case .case-chips a").count()) === 15, "a bare C4982 offers the 15 case letters");
  results.push({ profile, flow: "scan-box-case", ok: true });

  /* 5. photo of a case-box label */
  await page.getByRole("tab", { name: "Scan", exact: true }).click();
  await page.locator("#photo-library").waitFor({ state: "attached" });
  await page.locator("#photo-library").setInputFiles({ name: "box.jpg", mimeType: "image/jpeg", buffer: await drawPhoto(page, ["HOT WHEELS BASIC CAR ASST.", "L2593-973N PN", "72 PCS"]) });
  await page.locator("#scan-case .hwcase-car").first().waitFor({ timeout: 120000 });
  txt = await page.locator("#scan-case").innerText();
  assert(/2026 case N/i.test(txt), "a case-box photo shows case N");
  await showTop(page, "#scan-case");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shots, `${profile}-photo-case-box-N.png`) });
  results.push({ profile, flow: "photo-case-box", ok: true });
}

const runs = [
  { name: "iphone-webkit", type: webkit, opts: devices["iPhone 13"] },
  { name: "iphone-chromium", type: chromium, opts: Object.assign({}, devices["iPhone 13"], { defaultBrowserType: undefined }) },
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
    results.push({ profile: run.name, ok: false, error: String(err.message || err).slice(0, 400) });
    await s.page.screenshot({ path: path.join(shots, `${run.name}-FAILED.png`) }).catch(() => {});
  }
  await browser.close();
}
if (server) server.close();
console.log(JSON.stringify(results, null, 2));
if (thirdParty.length) console.log("third-party API network errors (retried / fell back): " + thirdParty.length);
console.log(failed ? `FAILED ${failed}` : `case browser ok (${results.length} checks)`);
process.exit(failed ? 1 : 0);
