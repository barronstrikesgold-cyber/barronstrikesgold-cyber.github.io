/* Before/after screenshots of the main screens in light and dark on an iPhone 17 Pro Max-size viewport (440×956 @3x).
 * BASE=https://... for live, else a local server. SHOTS=/dir, LABEL=before|after. Also prints layout checks. */
import { webkit } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const label = process.env.LABEL || "after";
const shots = path.join(process.env.SHOTS || path.join(root, "test-results/redesign"), label);
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

const screens = [
  ["home", "#/home"], ["drops", "#/calendar"], ["catalog", "#/catalog"], ["scan", "#/scan"], ["mystuff", "#/stuff/watchlist"],
  ["tracker", "#/stuff/tracker"], ["showmode", "#/stuff/show"], ["itemcard", "ITEM"], ["settings", "#/stuff/settings"],
];
const browser = await webkit.launch();
const out = [];
for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: theme, serviceWorkers: "block",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("hunt-theme", t); } catch (e) {} }, theme);
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(base + "#/home", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const id = await page.evaluate(async () => {
    await window.HuntStock.ensure();
    const all = window.HuntStock.store.all();
    const have = all.find((i) => i.name === "Honda Civic Custom Super");
    if (have) return have.id;
    const s = await window.HuntStock.store.save(window.HuntStockData.normalize({ name: "Honda Civic Custom Super", lane: "hot-wheels", compId: "c:civic", cost: 10, qty: 2, bin: "A3", purchaseDate: "2026-10-12", store: "Target" }));
    await window.HuntStock.store.save(window.HuntStockData.normalize({ name: "Pokémon 30th Celebration ETB", lane: "pokemon", cost: 59.99, qty: 1, bin: "C1" }));
    return s.id;
  });
  for (const [name, hash] of screens) {
    const h = hash === "ITEM" ? "#/stuff/tracker/item/" + id : hash;
    await page.goto(base + h, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(name === "home" || name === "catalog" ? 2200 : 1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const file = path.join(shots, `${name}-${theme}.png`);
    await page.screenshot({ path: file });
    const m = await page.evaluate(() => {
      const tb = document.querySelector(".tabbar"); const r = tb ? tb.getBoundingClientRect() : null;
      return { overflowX: document.documentElement.scrollWidth > window.innerWidth + 1, tabbar: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null };
    });
    out.push({ theme, name, file, ...m });
  }
  // Extras: the case page scrolled under the header, and the iPad/desktop layout.
  await page.goto(base + "#/case/" + encodeURIComponent("2026 A"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, 420));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shots, `case-scrolled-${theme}.png`) });
  await ctx.close();
  for (const [w, h, tag] of [[1180, 820, "ipad"], [1440, 900, "desktop"]]) {
    const dctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: theme, serviceWorkers: "block" });
    await dctx.addInitScript((t) => { try { localStorage.setItem("hunt-theme", t); } catch (e) {} }, theme);
    const dp = await dctx.newPage();
    await dp.goto(base + "#/home", { waitUntil: "domcontentloaded" });
    await dp.waitForTimeout(2500);
    await dp.screenshot({ path: path.join(shots, `${tag}-home-${theme}.png`) });
    await dp.goto(base + "#/stuff/settings", { waitUntil: "domcontentloaded" });
    await dp.waitForTimeout(1500);
    await dp.screenshot({ path: path.join(shots, `${tag}-settings-${theme}.png`) });
    await dctx.close();
  }
}
await browser.close();
if (server) server.close();
console.log(JSON.stringify(out, null, 1));
