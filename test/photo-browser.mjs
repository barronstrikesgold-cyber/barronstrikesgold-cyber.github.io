/* Identify from photo, end to end: local server (or BASE=https://... for live), iPhone WebKit + Chromium.
 * Draws test photos on a canvas, feeds them to the Scan tab's photo input, and checks what Hunt resolves.
 * Needs network (Tesseract.js from jsDelivr, Pokémon TCG API, product photos). SHOTS=/path saves screenshots.
 * REAL_PHOTO=/path/to.jpg adds the owner's card-back photo (expects JDP89 / TV Series Batmobile). */
import { webkit, chromium, devices } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = process.env.SHOTS || path.join(root, "test-results/photo-id");
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

async function boot(browser, opts) {
  const context = await browser.newContext(Object.assign({ serviceWorkers: "block" }, opts));
  await context.addInitScript(() => {
    if (!navigator.mediaDevices) Object.defineProperty(navigator, "mediaDevices", { value: {}, configurable: true });
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
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
  /* the controls: camera capture + library, AI match off by default */
  await openScan(page);
  const cam = page.locator("#photo-camera");
  assert((await cam.getAttribute("accept")) === "image/*" && (await cam.getAttribute("capture")) === "environment", "camera input uses accept=image/* capture=environment");
  assert((await page.locator("#photo-library").getAttribute("capture")) === null, "library input has no capture, so iOS offers the photo library");
  assert(/AI photo match \(off\)/.test(await page.locator(".photo-ai summary").innerText()), "AI photo match is off by default");
  results.push({ profile, flow: "controls", ok: true });

  /* 1. Hot Wheels card back: item code -> the normal scan path -> TV Series Batmobile */
  let t0 = Date.now();
  await cam.setInputFiles({ name: "batmobile.jpg", mimeType: "image/jpeg", buffer: await drawPhoto(page, ["HOT WHEELS MONSTER TRUCKS", "TV SERIES BATMOBILE", "JDP89-0910"]) });
  await page.locator("#scan-lookup .upc-picked").waitFor({ timeout: 120000 });
  const bat = await page.locator("#scan-lookup .upc-picked").innerText();
  assert(/TV Series Batmobile/.test(bat) && /JDP89/.test(bat), "the Batmobile photo resolves to TV Series Batmobile: " + bat.slice(0, 160));
  const batImg = await imgState(page.locator("#scan-lookup .upc-picked .upc-img img"));
  await showTop(page, "#scan-lookup");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shots, `${profile}-photo-batmobile-JDP89.png`) });
  results.push({ profile, flow: "photo-batmobile", ok: true, ms: Date.now() - t0, image: batImg });

  /* 2. Pokémon card: 158/128 + name -> Pokémon TCG API -> Mew ex candidate -> confirm card -> tracker */
  await openScan(page);
  t0 = Date.now();
  await page.locator("#photo-library").setInputFiles({ name: "mew.jpg", mimeType: "image/jpeg", buffer: await drawPhoto(page, ["Mew ex  HP 180", "Pokemon", "158/128"]) });
  await page.locator("#scan-lookup .photo-cand").first().waitFor({ timeout: 120000 });
  const first = await page.locator("#scan-lookup .photo-cand").first().innerText();
  assert(/Mew ex/i.test(first) && /158\/128/.test(first), "the top candidate is Mew ex 158/128: " + first);
  const conf = /(\d+)% match/.exec(first);
  assert(conf && Number(conf[1]) >= 50, "the candidate shows a confidence");
  const read = await page.locator("#scan-lookup .photo-read").innerText().catch(() => "");
  const links = await page.locator("#scan-lookup .upc-links a").evaluateAll((as) => as.map((a) => a.href));
  assert(links.some((h) => /amazon\.com.*tag=hempsply02-20/.test(h)) && links.some((h) => /lens\.google\.com/.test(h)) && links.some((h) => /ebay\.com.*LH_Sold=1/.test(h)), "search links include Amazon (tag), eBay sold, and Google Lens");
  const candImg = await imgState(page.locator("#scan-lookup .photo-cand .stk-thumb img").first());
  await showTop(page, "#scan-lookup");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(shots, `${profile}-photo-mew-candidates.png`) });
  await page.locator("#scan-lookup .photo-cand").first().click();
  await page.locator("#scan-lookup .upc-picked").waitFor();
  const card = await page.locator("#scan-lookup .upc-picked").innerText();
  assert(/Mew ex/.test(card) && /Pokémon TCG API|TCGdex/i.test(card), "the confirm card names Mew ex and its source");
  assert(await page.locator('#scan-lookup .upc-picked a[data-share="catalog-add"]').count() === 1, "a web find offers the shared-catalog suggestion");
  const share = await page.locator('#scan-lookup .upc-picked a[data-share="catalog-add"]').getAttribute("href");
  assert(/issues\/new\?labels=catalog-add/.test(share) && /sourceUrl/.test(decodeURIComponent(share)), "the suggestion is a prefilled catalog-add issue");
  await showTop(page, "#scan-lookup");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(shots, `${profile}-photo-mew-confirm.png`) });
  await page.locator('#scan-lookup .upc-picked button[data-stk="res-add"]').click();
  await page.locator(".stk-hero h1").waitFor();
  const saved = (await page.locator(".stk-hero h1").innerText()).trim();
  assert(/Mew ex/.test(saved), "Add to tracker saves Mew ex: " + saved);
  results.push({ profile, flow: "photo-mew", ok: true, ms: Date.now() - t0, top: first.replace(/\s+/g, " ").slice(0, 120), image: candImg, readText: read.slice(0, 80) });

  /* 3. the learned catalog: the saved find shows up in Search */
  await page.waitForTimeout(800);
  await page.goto(base + "#/search/mew", { waitUntil: "domcontentloaded" });
  await page.locator("#search-learned .flow-row").first().waitFor({ timeout: 15000 });
  const learned = await page.locator("#search-learned").innerText();
  assert(/Mew ex/.test(learned), "Search lists the learned Mew ex");
  await page.screenshot({ path: path.join(shots, `${profile}-search-learned-mew.png`) });
  results.push({ profile, flow: "learned-search", ok: true });

  /* 4. nothing matches: read text + web search links */
  await openScan(page);
  await page.locator("#photo-library").setInputFiles({ name: "misc.jpg", mimeType: "image/jpeg", buffer: await drawPhoto(page, ["ZORBLAX QUINTAVOR", "WIDGET DELUXE"]) });
  await page.locator("#scan-lookup .photo-read").waitFor({ timeout: 120000 });
  const miss = await page.locator("#scan-lookup").innerText();
  assert(/could not match|Best matches/.test(miss), "a no-match photo explains itself");
  assert(await page.locator("#scan-lookup .upc-links a").count() >= 4, "a no-match photo offers the web search links");
  await showTop(page, "#scan-lookup");
  await page.screenshot({ path: path.join(shots, `${profile}-photo-no-match.png`) });
  results.push({ profile, flow: "photo-miss", ok: true });

  if (process.env.REAL_PHOTO && fs.existsSync(process.env.REAL_PHOTO)) {
    await openScan(page);
    t0 = Date.now();
    await page.locator("#photo-library").setInputFiles(process.env.REAL_PHOTO);
    await page.locator("#scan-lookup .upc-picked, #scan-lookup .photo-read, #scan-lookup .upc-assort").first().waitFor({ timeout: 150000 });
    const txt = await page.locator("#scan-lookup").innerText();
    await page.screenshot({ path: path.join(shots, `${profile}-photo-real-card-back.png`) });
    results.push({ profile, flow: "photo-real", ok: /Batmobile|JDP89/.test(txt), ms: Date.now() - t0, text: txt.replace(/\s+/g, " ").slice(0, 200) });
  }
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
console.log(failed ? `FAILED ${failed}` : `photo browser ok (${results.length} checks)`);
process.exit(failed ? 1 : 0);
