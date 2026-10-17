/* Full audit: every route on iPhone WebKit, Pixel Chromium and desktop Chromium.
 * Records console errors, page errors, failed requests, broken images, axe-core WCAG 2.2 AA violations,
 * keyboard focus visibility, Amazon tag/rel, and first-load performance. BASE=https://... for live.
 * SHOTS=/path for screenshots, AXE=/path/to/axe.min.js (defaults to /tmp/axe/node_modules/axe-core/axe.min.js).
 * Exit code is 1 when a blocking problem (page error, broken same-origin request/image, serious/critical axe) is found. */
import { webkit, chromium, devices } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = process.env.SHOTS || path.join(root, "test-results/full-audit");
fs.mkdirSync(shots, { recursive: true });
const axePath = process.env.AXE || "/tmp/axe/node_modules/axe-core/axe.min.js";
const axeSrc = fs.existsSync(axePath) ? fs.readFileSync(axePath, "utf8") : "";
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".webmanifest": "application/manifest+json" };
let server = null;
let base = process.env.BASE;
if (!base) {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
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
const origin = new URL(base).origin;

const ROUTES = [
  "#/home", "#/calendar", "#/drops", "#/catalog", "#/catalog/hot-wheels", "#/hw", "#/case/2026%20N", "#/scan",
  "#/search/mew", "#/stores", "#/blog", "#/coupons", "#/profit", "#/stuff/watchlist", "#/inventory",
  "#/stuff/tracker", "#/stuff/show", "#/stuff/profit", "#/alerts", "#/alerts/setup", "#/stuff/settings", "#/item/cuda",
];
const PAGES = ["privacy.html", "terms.html", "delete-account.html", "blog/", "blog/how-hunt-scores-a-find.html", "blog/why-some-cards-have-no-photo.html", "404.html"];
const PROFILES = [
  { name: "iphone-webkit", type: webkit, opts: devices["iPhone 13"] },
  { name: "android-chromium", type: chromium, opts: devices["Pixel 7"] },
  { name: "desktop-chromium", type: chromium, opts: { viewport: { width: 1366, height: 900 } } },
];
const only = process.env.PROFILES ? process.env.PROFILES.split(",") : null;
const report = { base, when: new Date().toString(), profiles: {} };
let blocking = 0;
const THIRD = /api\.pokemontcg\.io|api\.tcgdex\.net|barcode\.report|openfoodfacts|openproductsfacts/;

function slug(s) { return s.replace(/^#\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root"; }

async function audit(page, label, prof, log) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
  const imgs = await page.evaluate(() => Array.from(document.images).filter((i) => i.complete && i.currentSrc && i.naturalWidth === 0 && getComputedStyle(i).display !== "none").map((i) => i.currentSrc));
  const amazon = await page.evaluate(() => Array.from(document.querySelectorAll('a[href*="amazon.com"]')).map((a) => ({ href: a.href, rel: a.rel, tag: /[?&]tag=hempsply02-20\b/.test(a.href) })));
  const links = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).map((a) => a.href).filter((h) => /^https?:/.test(h)));
  const empty = await page.evaluate(() => (document.querySelector("#screen") || document.body).innerText.trim().length);
  let axe = [];
  if (axeSrc) {
    await page.addScriptTag({ content: axeSrc });
    axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }, resultTypes: ["violations"] });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\n").slice(1, 2).join("")) }));
    });
  }
  const shot = path.join(shots, prof + "-" + slug(label) + ".png");
  await page.screenshot({ path: shot, fullPage: false });
  const sameBroken = imgs.filter((u) => u.startsWith(origin));
  const serious = axe.filter((v) => v.impact === "serious" || v.impact === "critical");
  const row = { label, textLen: empty, brokenImages: imgs, amazon: amazon.filter((a) => a.tag && !/sponsored/.test(a.rel)), amazonCount: amazon.length, axe, links: links.length, shot };
  if (sameBroken.length || serious.length || empty < 40) blocking++;
  log.push(row);
  return links;
}

const allLinks = new Set();
for (const prof of PROFILES) {
  if (only && !only.includes(prof.name)) continue;
  const browser = await prof.type.launch();
  const context = await browser.newContext(Object.assign({ serviceWorkers: "block", acceptDownloads: true }, prof.opts));
  const page = await context.newPage();
  const P = { routes: [], pages: [], consoleErrors: [], pageErrors: [], failed: [], perf: null, keyboard: null };
  report.profiles[prof.name] = P;
  let where = "boot";
  page.on("console", (m) => { if (m.type() === "error") P.consoleErrors.push({ where, text: m.text().slice(0, 300) }); });
  page.on("pageerror", (e) => { const t = e.message.slice(0, 300); if (THIRD.test(t)) P.failed.push({ where, third: true, text: t }); else { P.pageErrors.push({ where, text: t }); blocking++; } });
  page.on("requestfailed", (r) => { const u = r.url(); const f = r.failure() && r.failure().errorText; if (/ERR_ABORTED|cancelled|NS_BINDING_ABORTED/i.test(f || "")) return; P.failed.push({ where, url: u.slice(0, 200), error: f, same: u.startsWith(origin) }); if (u.startsWith(origin)) blocking++; });
  page.on("response", (r) => { if (r.status() >= 400) { const u = r.url(); P.failed.push({ where, url: u.slice(0, 200), status: r.status(), same: u.startsWith(origin) }); if (u.startsWith(origin) && !/404\.html|missing-for-test/.test(u)) blocking++; } });
  page.setDefaultTimeout(30000);

  /* first-load performance */
  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch (e) {}
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
  });
  const t0 = Date.now();
  await page.goto(base + "#/home", { waitUntil: "load" });
  await page.getByRole("heading", { name: "What did you find?" }).waitFor();
  const ready = Date.now() - t0;
  await page.waitForTimeout(2500);
  P.perf = await page.evaluate((readyMs) => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const res = performance.getEntriesByType("resource");
    const bytes = res.reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0) + (nav.transferSize || nav.encodedBodySize || 0);
    return { readyMs, domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0), load: Math.round(nav.loadEventEnd || 0), lcp: Math.round(window.__lcp || 0), cls: Number((window.__cls || 0).toFixed(3)), requests: res.length + 1, kb: Math.round(bytes / 1024) };
  }, ready);

  for (const r of ROUTES) {
    where = r;
    try {
      await page.goto(base + r, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => { const s = document.querySelector("#screen"); return s && s.innerText.trim().length > 40 && !/^Loading/.test(s.innerText.trim()); }, null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
      (await audit(page, r, prof.name, P.routes)).forEach((l) => allLinks.add(l));
    } catch (err) { P.routes.push({ label: r, error: err.message.slice(0, 200) }); blocking++; }
  }
  for (const p of PAGES) {
    where = p;
    try {
      await page.goto(base + p, { waitUntil: "load" });
      /* 404.html forwards old deep links into the app; audit wherever it lands */
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(600);
      (await audit(page, p, prof.name, P.pages)).forEach((l) => allLinks.add(l));
    } catch (err) { P.pages.push({ label: p, error: err.message.slice(0, 200) }); blocking++; }
  }

  /* keyboard: Tab through the home screen and check every stop shows a visible focus indicator */
  if (prof.name === "desktop-chromium") {
    where = "keyboard";
    await page.goto(base + "#/home", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "What did you find?" }).waitFor();
    await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
    const stops = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      stops.push(await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return { tag: "body" };
        const cs = getComputedStyle(el);
        const visible = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== "none");
        const r = el.getBoundingClientRect();
        return { tag: el.tagName.toLowerCase(), name: (el.getAttribute("aria-label") || el.innerText || el.value || el.id || "").trim().slice(0, 40), visible, onScreen: r.width > 0 && r.height > 0 };
      }));
    }
    await page.screenshot({ path: path.join(shots, prof.name + "-keyboard-focus.png") });
    P.keyboard = { stops, invisible: stops.filter((s) => s.tag !== "body" && !s.visible) };
    /* Escape closes the sheet, and the sheet keeps focus */
    await page.goto(base + "#/stuff/settings", { waitUntil: "domcontentloaded" });
    await page.locator('[data-action="delete-device-data"]').click();
    const sheet = await page.evaluate(() => { const d = document.querySelector("dialog[open], [role=dialog]"); const a = document.activeElement; return { dialog: !!d, focusInside: !!(d && a && d.contains(a)) }; });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    sheet.closedByEscape = await page.evaluate(() => !document.querySelector("dialog[open], [role=dialog]:not([hidden])"));
    P.keyboard.sheet = sheet;
  }
  await browser.close();
}

/* link check (once): same-origin must be 200; external reported (many shops block bots) */
const linkResults = [];
for (const href of allLinks) {
  const u = href.split("#")[0];
  if (linkResults.find((l) => l.url === u)) continue;
  let status = 0;
  try {
    const r = await fetch(u, { method: u.startsWith(origin) ? "GET" : "HEAD", redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 HuntAudit" }, signal: AbortSignal.timeout(12000) });
    status = r.status;
  } catch (err) { status = "ERR " + (err.cause && err.cause.code || err.name); }
  const same = u.startsWith(origin);
  linkResults.push({ url: u, status, same });
  if (same && status !== 200) blocking++;
}
report.links = { total: linkResults.length, broken: linkResults.filter((l) => l.status !== 200 && !(l.status >= 300 && l.status < 400)) };
report.blocking = blocking;
fs.writeFileSync(path.join(shots, "audit.json"), JSON.stringify(report, null, 2));

/* summary */
for (const [name, P] of Object.entries(report.profiles)) {
  const rows = P.routes.concat(P.pages);
  const axeIds = {};
  rows.forEach((r) => (r.axe || []).forEach((v) => { axeIds[v.id + "/" + v.impact] = (axeIds[v.id + "/" + v.impact] || 0) + 1; }));
  console.log(`\n== ${name}: ${rows.length} screens, perf ${JSON.stringify(P.perf)}`);
  console.log(" page errors:", P.pageErrors.length, P.pageErrors.slice(0, 5));
  console.log(" console errors:", P.consoleErrors.length, P.consoleErrors.slice(0, 8));
  console.log(" failed requests:", P.failed.length, P.failed.slice(0, 10));
  console.log(" broken images:", rows.filter((r) => r.brokenImages && r.brokenImages.length).map((r) => r.label + ": " + r.brokenImages.slice(0, 3).join(", ")));
  console.log(" amazon issues:", rows.filter((r) => r.amazon && r.amazon.length).map((r) => r.label));
  console.log(" axe:", axeIds);
  console.log(" route errors:", rows.filter((r) => r.error || r.textLen < 40).map((r) => r.label + " " + (r.error || "empty")));
  if (P.keyboard) console.log(" keyboard invisible focus:", P.keyboard.invisible, "sheet:", P.keyboard.sheet);
}
console.log("\nlinks:", report.links.total, "broken/blocked:", report.links.broken);
console.log("blocking problems:", blocking);
if (server) server.close();
process.exit(blocking ? 1 : 0);
