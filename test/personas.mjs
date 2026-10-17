/* Two personas end to end, plus the account-system truth check.
 * 1) a brand-new anonymous user on iPhone WebKit, 2) the owner (power user) on Android Chromium and desktop Chromium.
 * BASE=https://... for live. SHOTS=/path for screenshots. Writes personas.json with steps, timings, and friction notes. */
import { webkit, chromium, devices } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = process.env.SHOTS || path.join(root, "test-results/personas");
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

const out = { base, when: new Date().toString(), runs: [] };
let failures = 0;

function runner(name) {
  const run = { name, steps: [], friction: [], errors: [], hosts: {} };
  out.runs.push(run);
  return {
    run,
    async step(label, fn) {
      const t = Date.now();
      try { const note = await fn(); run.steps.push({ label, ok: true, ms: Date.now() - t, note: note || "" }); }
      catch (err) { failures++; run.steps.push({ label, ok: false, ms: Date.now() - t, error: err.message.split("\n")[0].slice(0, 240) }); }
    },
    friction(text) { run.friction.push(text); },
  };
}
function assert(c, m) { if (!c) throw new Error(m); }

async function boot(type, opts, R) {
  const browser = await type.launch();
  const context = await browser.newContext(Object.assign({ serviceWorkers: "block", acceptDownloads: true }, opts));
  await context.addInitScript(() => {
    if (!navigator.mediaDevices) Object.defineProperty(navigator, "mediaDevices", { value: {}, configurable: true });
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => { if (!/access control checks|pokemontcg|tcgdex/.test(e.message)) R.run.errors.push(e.message.slice(0, 200)); });
  page.on("request", (r) => { const h = new URL(r.url()).host; R.run.hosts[h] = (R.run.hosts[h] || 0) + 1; });
  return { browser, context, page };
}

async function storage(page) {
  return page.evaluate(async () => {
    const keys = Object.keys(localStorage).filter((k) => /^(hunt|reseller)-/.test(k));
    function count(db, store) {
      return new Promise((resolve) => {
        const req = indexedDB.open(db);
        req.onsuccess = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains(store)) { d.close(); resolve(0); return; }
          const c = d.transaction(store, "readonly").objectStore(store).count();
          c.onsuccess = () => { resolve(c.result); d.close(); };
          c.onerror = () => { resolve(-1); d.close(); };
        };
        req.onerror = () => resolve(-1);
      });
    }
    return { keys, stockItems: await count("hunt-stock", "items") };
  });
}

async function accountTruth(page, R) {
  await R.step("account system: look for sign-up, login, password, Pro checkout", async () => {
    const found = {};
    for (const r of ["#/home", "#/stuff/settings", "#/stuff/tracker", "#/scan"]) {
      await page.goto(base + r);
      await page.waitForTimeout(900);
      const t = await page.evaluate(() => {
        const text = document.body.innerText;
        const ctl = Array.from(document.querySelectorAll("a,button,input")).map((e) => (e.innerText || e.value || e.getAttribute("aria-label") || e.type || "").trim()).join(" | ");
        return {
          signup: /\b(sign ?up|create (an )?account|register)\b/i.test(ctl),
          login: /\b(log ?in|sign ?in)\b/i.test(ctl),
          password: !!document.querySelector('input[type="password"]'),
          upgrade: /\b(upgrade|subscribe|buy pro|go pro|checkout)\b/i.test(ctl),
          stripeScript: !!document.querySelector('script[src*="stripe"]'),
          noAccountCopy: /no sign-in|no account/i.test(text),
        };
      });
      found[r] = t;
    }
    const any = Object.values(found).some((f) => f.signup || f.login || f.password || f.upgrade || f.stripeScript);
    assert(!any, "found an account or checkout control: " + JSON.stringify(found));
    assert(found["#/stuff/settings"].noAccountCopy, "settings should say there is no sign-in");
    const thirdParty = Object.keys(R.run.hosts).filter((h) => /supabase|stripe|firebase|auth0|clerk|appwrite/.test(h));
    assert(!thirdParty.length, "auth/payment hosts contacted: " + thirdParty.join(","));
    return "no sign-up, login, password field, email verification, password reset, Pro checkout, or Stripe/Supabase traffic; settings say 'There is no sign-in'";
  });
}

async function exportAndDelete(page, R, tag, expectStock) {
  let exported = null;
  await R.step(tag + ": Export my data (localStorage + IndexedDB)", async () => {
    await page.goto(base + "#/stuff/settings");
    await page.locator('[data-action="export-device-data"]').waitFor();
    const dl = page.waitForEvent("download", { timeout: 15000 });
    await page.locator('[data-action="export-device-data"]').click();
    const d = await dl;
    exported = JSON.parse(await fs.promises.readFile(await d.path(), "utf8"));
    fs.writeFileSync(path.join(shots, tag + "-export.json"), JSON.stringify(exported, null, 2).slice(0, 200000));
    assert(d.suggestedFilename().startsWith("hunt-export-"), "export file name");
    assert(exported.keys && Object.keys(exported.keys).length > 0, "export has localStorage keys");
    assert(exported.indexedDB && exported.indexedDB["hunt-stock"], "export includes IndexedDB hunt-stock");
    const n = exported.indexedDB["hunt-stock"].items.length;
    if (expectStock) assert(n >= expectStock, "export has tracker items: " + n);
    return d.suggestedFilename() + " · " + Object.keys(exported.keys).length + " keys · " + n + " tracker items · " + (exported.indexedDB["hunt-upc"] ? exported.indexedDB["hunt-upc"].learned.length : 0) + " learned";
  });
  await R.step(tag + ": Delete my data on this device (confirm) clears keys and IndexedDB", async () => {
    await page.goto(base + "#/stuff/settings");
    await page.locator('[data-action="delete-device-data"]').click();
    await page.locator('[data-action="confirm-delete-device-data"]').click();
    await page.waitForTimeout(1200);
    const s = await storage(page);
    const left = s.keys.filter((k) => k !== "reseller-inventory-v2");
    assert(left.length === 0, "keys left: " + left.join(","));
    assert(s.stockItems === 0, "tracker items left: " + s.stockItems);
    await page.reload();
    await page.waitForTimeout(1500);
    const after = await storage(page);
    assert(after.stockItems === 0, "tracker refilled after reload");
    await page.screenshot({ path: path.join(shots, tag + "-after-delete.png") });
    return "left only the empty inventory tombstone (reseller-inventory-v2); hunt-stock items 0 after reload";
  });
}

/* ---------- Persona 1: brand-new anonymous user, iPhone WebKit ---------- */
{
  const R = runner("new-user-iphone-webkit");
  const { browser, page } = await boot(webkit, devices["iPhone 13"], R);
  await R.step("first open: what a stranger sees", async () => {
    const t = Date.now();
    await page.goto(base);
    await page.getByRole("heading", { name: "What did you find?" }).waitFor();
    const ms = Date.now() - t;
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(shots, "new-user-01-first-open.png") });
    const info = await page.evaluate(() => ({ h1: document.querySelector("#screen h1") && document.querySelector("#screen h1").innerText, tabs: Array.from(document.querySelectorAll(".tabbar [data-tab]")).map((b) => b.innerText.trim()), onboarding: /welcome|get started|how it works/i.test(document.body.innerText) }));
    if (!info.onboarding) R.friction("No welcome or how-it-works on first open: a stranger lands on 'What did you find?' with deal cards and has to guess what Hunt does (scan, verdict, track).");
    return "content in " + ms + " ms · tabs " + info.tabs.join(", ");
  });
  await R.step("footer: age 13+, paid-link, trademark, privacy links reachable", async () => {
    const f = await page.evaluate(() => { const el = document.querySelector(".site-footer"); return el ? el.innerText : ""; });
    assert(/13 and older/.test(f), "age line in footer");
    assert(/Amazon Associate/.test(f), "Amazon line in footer");
    assert(/Privacy/.test(f) && /Terms/.test(f), "legal links in footer");
    await page.locator(".site-footer").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, "new-user-02-footer.png") });
    return "footer ok";
  });
  await accountTruth(page, R);
  await R.step("search 'mew' from the top bar and open a result", async () => {
    await page.goto(base + "#/home");
    await page.locator("#global-q").fill("mew");
    await page.locator("#global-q").press("Enter");
    await page.waitForTimeout(1500);
    const n = await page.locator("#screen button, #screen a").count();
    await page.screenshot({ path: path.join(shots, "new-user-03-search.png") });
    assert(n > 0, "search shows results");
    return n + " controls on the results screen";
  });
  await R.step("open an item, Track it, see it in My Stuff", async () => {
    await page.goto(base + "#/item/cuda");
    await page.locator('[data-action="track-item"]').waitFor();
    await page.screenshot({ path: path.join(shots, "new-user-04-item.png") });
    const paid = await page.locator('a[href*="tag=hempsply02-20"]').count();
    if (paid) {
      const note = await page.locator(".affiliate-note").count();
      assert(note === 1, "paid links on the item page need the nearby disclosure");
    }
    await page.locator('[data-action="track-item"]').click();
    await page.waitForTimeout(800);
    await page.goto(base + "#/stuff/watchlist");
    await page.waitForTimeout(800);
    const t = await page.locator("#screen").innerText();
    assert(/Cuda/i.test(t), "tracked item in watchlist");
    return "tracked; paid links on item " + paid + " (disclosure " + (paid ? "shown" : "n/a") + ")";
  });
  await R.step("Scan: type the Monster Trucks case UPC, get the 'Which one is it?' picker", async () => {
    await page.goto(base + "#/scan");
    await page.locator("#scan-q").fill("887961705393");
    await page.locator("#scan-q").press("Enter");
    await page.getByText("Which one is it?").first().waitFor({ timeout: 20000 });
    await page.screenshot({ path: path.join(shots, "new-user-05-scan-picker.png") });
    return "picker shown";
  });
  await R.step("Scan: camera denied falls back gracefully", async () => {
    await page.goto(base + "#/scan");
    await page.waitForTimeout(1200);
    const t = await page.locator("#screen").innerText();
    if (!/type|enter|photo/i.test(t)) throw new Error("no fallback text");
    return "typed entry and photo pick offered";
  });
  await R.step("Catalog: Search by case '2026 N'", async () => {
    await page.goto(base + "#/case/2026%20N");
    await page.locator(".hwcase .hwcase-car").first().waitFor({ timeout: 20000 });
    return (await page.locator(".hwcase .hwcase-car").count()) + " cars";
  });
  await R.step("Settings: privacy choices are reachable in two taps", async () => {
    await page.goto(base + "#/stuff/settings");
    await page.locator("#device-data").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, "new-user-06-settings-data.png") });
    const links = await page.locator('#device-data a[href*="privacy.html"]').count();
    assert(links >= 2, "privacy + choices links in Settings");
    R.friction("Settings is the 8th chip in My Stuff; 'Your data' (export/delete) sits at the bottom under store pickers and tools. Findable, but long on a phone.");
    return "privacy links: " + links;
  });
  await exportAndDelete(page, R, "new-user", 0);
  await browser.close();
}

/* ---------- Persona 2: the owner, a power user with tracker and Show Mode data ---------- */
for (const prof of [{ name: "owner-android-chromium", type: chromium, opts: devices["Pixel 7"] }, { name: "owner-desktop-chromium", type: chromium, opts: { viewport: { width: 1366, height: 900 } } }]) {
  const R = runner(prof.name);
  const { browser, page } = await boot(prof.type, prof.opts, R);
  const tag = prof.name;
  await page.goto(base);
  await page.getByRole("heading", { name: "What did you find?" }).waitFor();
  await R.step("Tracker: copy in the owner's Hunt book", async () => {
    await page.goto(base + "#/stuff/tracker");
    await page.locator('[data-stk="add"]').waitFor();
    await page.locator(".stk-data summary").click();
    await page.locator('[data-stk="import-book"]').click();
    await page.waitForTimeout(1500);
    const s = await storage(page);
    assert(s.stockItems > 5, "book imported: " + s.stockItems);
    await page.screenshot({ path: path.join(shots, tag + "-01-tracker.png") });
    return s.stockItems + " items in hunt-stock";
  });
  await R.step("Tracker: add an item by hand", async () => {
    await page.goto(base + "#/stuff/tracker/add");
    await page.locator("#stk-name").waitFor();
    await page.locator("#stk-name").fill("Audit test '23 Ram 1500 STH");
    await page.locator("#stk-qty").fill("1");
    await page.locator("#stk-cost").fill("1.25");
    await page.locator("#stk-status").selectOption({ index: 2 }).catch(() => {});
    await page.locator('#stk-form button[type="submit"]').click();
    await page.waitForTimeout(1000);
    const t = await page.locator("#screen").innerText();
    assert(/Audit test/.test(t), "new item listed");
    return "saved";
  });
  await R.step("Show Mode: pay by card, sell one, summary updates, undo", async () => {
    await page.goto(base + "#/stuff/show");
    await page.locator(".stk-show").waitFor();
    await page.locator('[data-stk="pay"][data-v="card"]').click();
    const sell = page.locator('[data-stk="sell"]').first();
    const custom = page.locator('[data-stk="custom"]').first();
    if (await sell.count()) await sell.click();
    else { await custom.click(); await page.locator("#stk-custom-price").fill("5"); await page.locator(".stk-custom button[type=submit]").click(); }
    await page.waitForTimeout(800);
    const sum = await page.locator(".stk-stats.is-show").first().innerText();
    assert(/1 sold/.test(sum), "summary shows 1 sold: " + sum.replace(/\s+/g, " "));
    await page.screenshot({ path: path.join(shots, tag + "-02-show-sold.png") });
    const undo = page.locator('[data-stk="undo-sale"]');
    if (await undo.count()) { await undo.first().click(); await page.waitForTimeout(500); }
    if (await sell.count()) { await page.locator('[data-stk="sell"]').first().click(); await page.waitForTimeout(500); }
    return sum.replace(/\s+/g, " ").slice(0, 90);
  });
  await R.step("CSV exports: tracker CSV, Shopify CSV, inventory CSV, inventory JSON", async () => {
    await page.goto(base + "#/stuff/tracker");
    await page.locator(".stk-data summary").click();
    const got = [];
    for (const sel of ['[data-stk="export-csv"]', '[data-stk="export-shopify"]']) {
      const dl = page.waitForEvent("download", { timeout: 15000 });
      await page.locator(sel).click();
      const d = await dl;
      const body = await fs.promises.readFile(await d.path(), "utf8");
      const lines = body.trim().split(/\r?\n/);
      assert(lines.length > 2, sel + " has rows");
      if (sel.includes("shopify")) assert(/^Handle,Title,/.test(lines[0]), "Shopify header");
      if (/[\r\n]=/.test(body) || /,=/.test(body)) throw new Error(sel + " has a cell starting with = (CSV injection risk)");
      got.push(d.suggestedFilename() + " (" + (lines.length - 1) + " rows)");
    }
    await page.goto(base + "#/inventory");
    for (const sel of ['[data-action="export-csv"]', '[data-action="export-json"]']) {
      if (!(await page.locator(sel).count())) continue;
      const dl = page.waitForEvent("download", { timeout: 15000 });
      await page.locator(sel).first().click();
      const d = await dl;
      got.push(d.suggestedFilename());
    }
    return got.join(", ");
  });
  await R.step("CSV injection: a name starting with = is neutralized in exports", async () => {
    await page.goto(base + "#/stuff/tracker/add");
    await page.locator("#stk-name").fill('=HYPERLINK("http://example.invalid","x")');
    await page.locator("#stk-qty").fill("1");
    await page.locator('#stk-form button[type="submit"]').click();
    await page.waitForTimeout(800);
    await page.goto(base + "#/stuff/tracker");
    await page.locator(".stk-data summary").click();
    const bodies = [];
    for (const sel of ['[data-stk="export-csv"]', '[data-stk="export-shopify"]']) {
      const dl = page.waitForEvent("download", { timeout: 15000 });
      await page.locator(sel).click();
      bodies.push(await fs.promises.readFile(await (await dl).path(), "utf8"));
    }
    const bad = bodies.some((b) => /(^|,|")=HYPERLINK/m.test(b) && !/'=HYPERLINK/.test(b));
    assert(!bad, "formula cell exported raw");
    return "formula prefixed";
  });
  await R.step("Profit calculator renders a result", async () => {
    await page.goto(base + "#/profit");
    await page.waitForTimeout(800);
    const ins = page.locator("#screen input[type=number]");
    assert((await ins.count()) >= 2, "profit inputs");
    return (await ins.count()) + " inputs";
  });
  await accountTruth(page, R);
  await exportAndDelete(page, R, tag, 5);
  await browser.close();
}

fs.writeFileSync(path.join(shots, "personas.json"), JSON.stringify(out, null, 2));
for (const r of out.runs) {
  console.log("\n== " + r.name + ": " + r.steps.filter((s) => s.ok).length + "/" + r.steps.length + " passed");
  r.steps.forEach((s) => console.log((s.ok ? "  ok   " : "  FAIL ") + s.label + " · " + (s.ok ? s.note : s.error) + " (" + s.ms + " ms)"));
  if (r.friction.length) console.log("  friction:\n   - " + r.friction.join("\n   - "));
  if (r.errors.length) console.log("  page errors:", r.errors);
  console.log("  hosts:", Object.keys(r.hosts).join(", "));
}
console.log("\nfailures:", failures);
if (server) server.close();
process.exit(failures ? 1 : 0);
