import { chromium, webkit, devices } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = "/opt/cursor/artifacts/screenshots/customer";
fs.mkdirSync(shots, { recursive: true });
const sample = "036000291452";
const missCode = "012345678905";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".webmanifest": "application/manifest+json",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (url.pathname === "/") file = path.join(root, "index.html");
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    if (url.pathname === "/data/catalog.json") {
      const data = JSON.parse(buf.toString("utf8"));
      Object.keys(data).forEach((key) => {
        (data[key] || []).forEach((item) => {
          if (item && item.id === "cuda") item.upc = sample;
        });
      });
      buf = Buffer.from(JSON.stringify(data));
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(buf);
  });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port + "/";
const failures = [];
let shotN = 0;

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

async function check(page, profile, name, steps, fn) {
  try {
    await fn();
    console.log("OK", profile, name);
    return true;
  } catch (err) {
    shotN += 1;
    const file = profile + "-" + String(shotN).padStart(2, "0") + "-" + slug(name) + ".png";
    try {
      await page.screenshot({ path: path.join(shots, file), fullPage: false });
    } catch (shotErr) {
      console.error("screenshot failed", shotErr.message);
    }
    const message = err && err.message ? err.message.split("\n")[0] : String(err);
    failures.push({ profile, name, steps, error: message, screenshot: "screenshots/customer/" + file });
    console.error("FAIL", profile, name, message);
    return false;
  }
}

function cameraStub(mode) {
  return (cameraMode) => {
    const videoProto = HTMLVideoElement.prototype;
    Object.defineProperty(videoProto, "srcObject", {
      configurable: true,
      get() { return this.__srcObject || null; },
      set(value) {
        this.__srcObject = value;
        this.__frame = value && value.__frame ? value.__frame : null;
      },
    });
    Object.defineProperty(videoProto, "videoWidth", {
      configurable: true,
      get() { return this.__frame ? this.__frame.width : 0; },
    });
    Object.defineProperty(videoProto, "videoHeight", {
      configurable: true,
      get() { return this.__frame ? this.__frame.height : 0; },
    });
    videoProto.play = function () { return Promise.resolve(); };
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (source) {
      if (source && source.__frame) {
        const frame = source.__frame;
        const image = this.createImageData(frame.width, frame.height);
        image.data.set(frame.data);
        this.putImageData(image, 0, 0);
        return;
      }
      return drawImage.apply(this, arguments);
    };
    const devices = navigator.mediaDevices || {};
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: devices });
    }
    navigator.mediaDevices.getUserMedia = function () {
      if (cameraMode === "denied") {
        return Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
      }
      const rendered = window.ResellerScan && window.ResellerScan.renderUpcA
        ? window.ResellerScan.renderUpcA("036000291452", 3, 120, 11)
        : null;
      return Promise.resolve({
        __frame: rendered,
        getTracks() { return [{ stop() {} }]; },
        getVideoTracks() { return [{ stop() {} }]; },
      });
    };
  };
}

async function openApp(browser, contextOptions, mode) {
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(cameraStub(mode), mode);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.setDefaultTimeout(15000);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "What did you find?" }).waitFor();
  page.pageErrors = pageErrors;
  return { context, page };
}

async function gotoHash(page, hash) {
  await page.evaluate((next) => { location.hash = next; }, hash);
  await page.waitForTimeout(200);
}

async function armFakeCamera(page, mode) {
  await page.evaluate((cameraMode) => {
    const gum = function () {
      if (cameraMode === "denied") {
        return Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
      }
      const rendered = window.ResellerScan && window.ResellerScan.renderUpcA
        ? window.ResellerScan.renderUpcA("036000291452", 3, 120, 11)
        : null;
      return Promise.resolve({
        __frame: rendered,
        getTracks() { return [{ stop() {} }]; },
        getVideoTracks() { return [{ stop() {} }]; },
      });
    };
    const devices = navigator.mediaDevices || {};
    devices.getUserMedia = gum;
    if (!navigator.mediaDevices) {
      try {
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: devices });
      } catch (err) {
        navigator.mediaDevices = devices;
      }
    }
  }, mode);
}

async function walk(browser, profile, contextOptions) {
  const { context, page } = await openApp(browser, contextOptions, "camera");
  const desktop = profile.indexOf("desktop") !== -1;

  await check(page, profile, "Home loads with deals", [
    "Open the site.",
    "Expect the heading What did you find? and a deal list.",
  ], async () => {
    await page.getByRole("heading", { name: "What did you find?" }).waitFor();
    await page.locator("#home-grid, #hunt-body .list, #hunt-body .state-card").first().waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) throw new Error("home overflows horizontally");
  });

  await check(page, profile, "Primary tabs", [
    "Look at the primary navigation.",
    "Expect Home, Drops & Calendar, Catalog, Scan, and My Stuff.",
  ], async () => {
    for (const name of ["Home", "Drops & Calendar", "Catalog", "Scan", "My Stuff"]) {
      const tab = page.getByRole("tab", { name, exact: true });
      if (await tab.count() !== 1) throw new Error("missing tab " + name);
    }
    const bar = await page.locator(".tabbar").boundingBox();
    const view = page.viewportSize();
    if (!bar || !view) throw new Error("tab bar has no box");
    if (desktop) {
      if (bar.x > 80 || bar.width > 320) throw new Error("desktop nav is not the left sidebar, x=" + Math.round(bar.x) + " w=" + Math.round(bar.width));
      if (bar.height < view.height * 0.5) throw new Error("desktop sidebar is too short, h=" + Math.round(bar.height));
    } else if (bar.y < view.height * 0.6) {
      throw new Error("mobile tab bar is not at the bottom, y=" + Math.round(bar.y));
    }
  });

  await check(page, profile, "Global search on Home", [
    "On Home, type Skyline in the header search.",
    "Expect the deal grid to show the Skyline.",
  ], async () => {
    await page.getByRole("tab", { name: "Home", exact: true }).click();
    await page.locator("#global-q").fill("Skyline");
    await page.locator("#home-grid").getByRole("button", { name: /Skyline/ }).first().waitFor();
    await page.locator("#global-q").fill("");
  });

  await check(page, profile, "Global search leaves Home", [
    "Open Catalog.",
    "Type Skyline in the header search.",
    "Expect a Search page with matches.",
  ], async () => {
    await page.getByRole("tab", { name: "Catalog", exact: true }).click();
    await page.getByRole("heading", { name: "Catalog", exact: true }).waitFor();
    await page.locator("#global-q").fill("Skyline");
    await page.getByRole("heading", { name: "Search", exact: true }).waitFor();
    await page.locator("#search-results").getByRole("button", { name: /Skyline/ }).first().waitFor();
    if (!page.url().includes("#/search/")) throw new Error("search did not deep-link, url " + page.url());
  });

  await check(page, profile, "Search result opens a detail", [
    "From Search, open the Skyline result.",
    "Expect a detail heading and a back control.",
  ], async () => {
    await page.locator("#search-results").getByRole("button", { name: /Skyline/ }).first().click();
    await page.getByRole("heading", { name: /Skyline/ }).waitFor();
    if (await page.locator("#header-back").isHidden()) throw new Error("header back is hidden on a detail");
  });

  await check(page, profile, "Buy link opens a new tab", [
    "On the detail page, click the Amazon buy link.",
    "Expect a new tab whose address is the tagged Amazon search.",
  ], async () => {
    const link = page.getByRole("link", { name: "Buy on Amazon", exact: true }).first();
    await link.waitFor();
    const href = await link.getAttribute("href");
    if (!href || !href.includes("amazon.com") || !href.includes("tag=hempsply02-20")) {
      throw new Error("Amazon href is not a tagged search: " + href);
    }
    const popupPromise = page.waitForEvent("popup", { timeout: 8000 });
    await link.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
    const landed = popup.url();
    await popup.close().catch(() => {});
    if (landed && landed !== "about:blank" && !/amazon\.com|chrome-error|webkit-error/i.test(landed)) {
      throw new Error("buy link opened " + landed);
    }
  });

  await check(page, profile, "Back from a detail", [
    "On a detail page, tap the header back button.",
    "Expect to return to Search.",
  ], async () => {
    await page.locator("#header-back").click();
    await page.getByRole("heading", { name: "Search", exact: true }).waitFor();
  });

  await check(page, profile, "Home category filter", [
    "Open Home.",
    "Tap the Pokémon category chip.",
    "Expect the deal list to change to that category.",
  ], async () => {
    await page.getByRole("tab", { name: "Home", exact: true }).click();
    await page.locator('[aria-label="Category"]').getByRole("button", { name: "Pokémon", exact: true }).click();
    await page.locator("#hunt-body").waitFor();
    const text = await page.locator("#hunt-body").innerText();
    if (!/pok[eé]mon|card|no items|nothing/i.test(text)) throw new Error("category filter did not update the home list");
    if (!page.url().includes("#/category/pokemon")) throw new Error("category filter has no deep link, url " + page.url());
  });

  await check(page, profile, "Catalog chips", [
    "Open Catalog.",
    "Tap Sneakers, then Designer, then TCG, then Tech.",
    "Expect each chip to show that brand and a deep link.",
  ], async () => {
    await page.getByRole("tab", { name: "Catalog", exact: true }).click();
    await page.getByRole("heading", { name: "Catalog", exact: true }).waitFor();
    const chips = [
      ["Sneakers", "#/catalog/sneakers", /nike|jordan|adidas|sneaker/i],
      ["Designer", "#/catalog/designer", /supreme|kith|palace|designer/i],
      ["TCG", "#/catalog/tcg", /pok[eé]mon|magic|lorcana|yu-gi-oh|one piece/i],
      ["Tech", "#/catalog/tech", /apple|console|beats/i],
    ];
    for (const [label, hash, pattern] of chips) {
      await page.locator('[aria-label="Catalog category"]').getByRole("button", { name: label, exact: true }).click();
      await page.waitForTimeout(150);
      if (!page.url().includes(hash)) throw new Error(label + " chip url is " + page.url());
      const text = await page.locator("#screen").innerText();
      if (!pattern.test(text)) throw new Error(label + " catalog did not show matching rows");
    }
    const crumb = page.locator('nav.crumbs[aria-label="Breadcrumb"]');
    if (await crumb.count() !== 1) throw new Error("catalog has no breadcrumb");
  });

  await check(page, profile, "Breadcrumb returns Home", [
    "On Catalog, tap Home in the breadcrumb.",
    "Expect the home heading.",
  ], async () => {
    await page.locator('nav.crumbs a[href="#/home"]').click();
    await page.getByRole("heading", { name: "What did you find?" }).waitFor();
  });

  await check(page, profile, "Calendar and add to calendar", [
    "Open Drops & Calendar.",
    "Open the first dated drop.",
    "Tap Add to calendar.",
    "Expect a hunt-YYYYMMDD.ics download.",
  ], async () => {
    await page.getByRole("tab", { name: "Drops & Calendar", exact: true }).click();
    await page.getByRole("heading", { name: "Drops & Calendar" }).waitFor();
    await page.locator("#calendar-list, [data-drop]").first().waitFor();
    await page.locator("[data-drop]").first().click();
    await page.getByRole("button", { name: "Add to calendar" }).waitFor();
    const downloadPromise = page.waitForEvent("download", { timeout: 8000 });
    await page.getByRole("button", { name: "Add to calendar" }).click();
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    if (!/^hunt-\d{8}\.ics$/.test(filename)) throw new Error("calendar file name is " + filename);
    const body = (await fs.promises.readFile(await download.path(), "utf8"));
    if (!body.includes("BEGIN:VCALENDAR") || !body.includes("DTSTART;VALUE=DATE:")) {
      throw new Error("calendar file is not an all-day event");
    }
  });

  await check(page, profile, "Back from a calendar drop", [
    "On a drop detail, tap the header back button.",
    "Expect Drops & Calendar.",
  ], async () => {
    await page.locator("#header-back").click();
    await page.getByRole("heading", { name: "Drops & Calendar" }).waitFor();
  });

  await check(page, profile, "Scan tab reads the fake camera", [
    "Open the Scan tab.",
    "Point the fake camera at UPC 036000291452.",
    "Expect the Gold '70 AAR Cuda Super detail.",
  ], async () => {
    await armFakeCamera(page, "camera");
    await page.getByRole("tab", { name: "Scan", exact: true }).click();
    await page.getByRole("heading", { name: "Scan", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Gold '70 AAR Cuda Super" }).waitFor({ timeout: 20000 });
    const text = await page.locator("#screen").innerText();
    if (!text.includes("Code · " + sample)) throw new Error("decoded UPC was not stored");
  });

  await check(page, profile, "Track an item on the watchlist", [
    "Open Home and open the first deal.",
    "Tap Track this item.",
    "Open My Stuff.",
    "Expect the item under the watchlist.",
  ], async () => {
    await page.getByRole("tab", { name: "Home", exact: true }).click();
    await page.locator("#home-grid button.flow-row").first().click();
    await page.getByRole("button", { name: "Track this item" }).waitFor();
    const title = await page.locator("#screen h1").first().innerText();
    await page.getByRole("button", { name: "Track this item" }).click();
    await page.getByRole("heading", { name: "My Stuff" }).waitFor();
    await page.locator("#screen").getByText(title, { exact: false }).first().waitFor();
  });

  await check(page, profile, "Add a purchase and see profit", [
    "Open My Stuff, then Inventory, then Add.",
    "Save a purchase named Customer Pass Car at cost 4.",
    "Open Profit, enter a sold price of 40.",
    "Expect an estimate, not a blank result.",
  ], async () => {
    await page.getByRole("tab", { name: "My Stuff", exact: true }).click();
    await page.locator('[aria-label="My Stuff"]').getByRole("button", { name: "Inventory", exact: true }).click();
    await page.getByRole("heading", { name: "Inventory", exact: true }).waitFor();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("heading", { name: "Add purchase" }).waitFor();
    await page.locator("#inv-name").fill("Customer Pass Car");
    await page.locator("#inv-cost").fill("4");
    await page.locator("#inv-form").getByRole("button", { name: "Add to inventory" }).click();
    await page.locator("#just-added").getByRole("button", { name: /Customer Pass Car/ }).waitFor();
    await page.locator('[aria-label="My Stuff"]').getByRole("button", { name: "Profit", exact: true }).click();
    await page.getByRole("heading", { name: "Profit calculator" }).waitFor();
    await page.locator("#profit-sold").fill("40");
    await page.getByText("Estimate only. Not a realized return.").waitFor();
    const net = await page.locator("#profit-net").innerText();
    if (!/\$/.test(net)) throw new Error("profit net is blank: " + net);
  });

  await check(page, profile, "Read the blog", [
    "Open Home and tap Blog.",
    "Open How Hunt scores a find.",
    "Expect the article heading.",
  ], async () => {
    await page.getByRole("tab", { name: "Home", exact: true }).click();
    await page.getByRole("button", { name: /^Blog/ }).click();
    await page.getByRole("heading", { name: "Blog", exact: true }).waitFor();
    await page.locator("#blog-list").getByRole("link", { name: "How Hunt scores a find" }).click();
    await page.getByRole("heading", { name: "How Hunt scores a find" }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) throw new Error("blog article overflows horizontally");
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "What did you find?" }).waitFor();
  });

  await check(page, profile, "Promos are visible and codes stay private", [
    "Open Home and tap Coupons.",
    "Expect the published promo offers and no fixture codes.",
    "Save a code on this device, save an expired code, then a future code, then remove it.",
  ], async () => {
    await page.getByRole("button", { name: /^Coupons/ }).click();
    await page.getByRole("heading", { name: "My Stuff", exact: true }).waitFor();
    if (await page.getByRole("heading", { name: "Coupons", exact: true }).count()) throw new Error("coupons repeats its own heading");
    await page.locator("#coupons-area article").first().waitFor();
    const hidden = await page.locator("#coupons-area").innerText();
    if (/EXPIRED-FIXTURE|INACTIVE-FIXTURE/.test(hidden)) throw new Error("fixture codes are visible");
    if (!/Offer/.test(hidden) || !/Source/.test(hidden)) throw new Error("promo terms are missing");
    if ((await page.locator("#coupons-area article").count()) < 1) throw new Error("expected promo offers");
    await page.locator("#coupons-area summary", { hasText: "Add private code" }).click();
    await page.getByRole("button", { name: "Save a code on this device" }).click();
    await page.locator("#coupon-code").fill("OWNER-DEAD");
    await page.locator("#coupon-expires").fill("2020-01-01");
    await page.getByRole("button", { name: "Save code" }).click();
    if (/OWNER-DEAD/.test(await page.locator("#coupons-area").innerText())) throw new Error("expired code stayed on screen");
    await page.locator("#coupon-code").fill("OWNER-LIVE");
    await page.locator("#coupon-expires").fill("2099-01-01");
    await page.getByRole("button", { name: "Save code" }).click();
    await page.locator("#coupons-area").getByText("OWNER-LIVE").waitFor();
    await page.getByRole("button", { name: "Remove" }).click();
    if (/OWNER-LIVE/.test(await page.locator("#coupons-area").innerText())) throw new Error("removed code stayed on screen");
  });

  await check(page, profile, "Offline banner", [
    "Go offline on Home.",
    "Expect the offline banner.",
    "Go back online and expect the banner to leave.",
  ], async () => {
    await gotoHash(page, "#/home");
    await page.getByRole("heading", { name: "What did you find?" }).waitFor();
    await context.setOffline(true);
    await page.getByText("Offline. The buy list and your inventory are still on this phone.").waitFor();
    await context.setOffline(false);
    await page.getByText("Offline. The buy list and your inventory are still on this phone.").waitFor({ state: "hidden" });
  });

  await check(page, profile, "Deep links", [
    "Open #/catalog/lego, #/stuff/alerts, #/stuff/settings, #/hw, and #/scan directly.",
    "Expect each page's heading.",
  ], async () => {
    const routes = [
      ["#/catalog/lego", "Catalog"],
      ["#/stuff/alerts", "Alerts"],
      ["#/stuff/settings", "Where are you?"],
      ["#/hw", "Hot Wheels book"],
      ["#/blog", "Blog"],
    ];
    for (const [hash, heading] of routes) {
      await gotoHash(page, hash);
      await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    }
  });

  if (page.pageErrors.length) {
    failures.push({
      profile,
      name: "Page errors during the walk",
      steps: ["Use the app through the customer walk.", "Watch the console."],
      error: page.pageErrors.slice(0, 4).join(" | "),
      screenshot: "",
    });
  }

  await context.close();

  const manual = await openApp(browser, contextOptions, "denied");
  await check(manual.page, profile, "Scan manual entry", [
    "Open the Scan tab with the camera denied.",
    "Type 012345678905 and look it up.",
    "Tap Add this code to inventory.",
    "Expect a new inventory row for that code.",
    "Return to Scan and type 036000291452.",
    "Expect the Cuda detail.",
  ], async () => {
    await armFakeCamera(manual.page, "denied");
    await manual.page.getByRole("tab", { name: "Scan", exact: true }).click();
    await manual.page.locator("#scan-msg.is-error").waitFor();
    const denied = await manual.page.locator("#scan-msg").innerText();
    if (!denied.startsWith("Camera permission was denied")) throw new Error("denied copy: " + denied);
    await manual.page.locator("#scan-q").fill(missCode);
    await manual.page.locator("#scan-form button").click();
    await manual.page.getByRole("button", { name: "Add this code to inventory" }).click();
    await manual.page.getByRole("heading", { name: "Code " + missCode }).waitFor();
    const saved = await manual.page.locator("#screen").innerText();
    if (!saved.includes("Code · " + missCode)) throw new Error("typed miss was not saved");
    await manual.page.locator("#header-back").click();
    await armFakeCamera(manual.page, "denied");
    await manual.page.getByRole("tab", { name: "Scan", exact: true }).click();
    await manual.page.locator("#scan-q").fill(sample);
    await manual.page.locator("#scan-form button").click();
    await manual.page.getByRole("heading", { name: "Gold '70 AAR Cuda Super" }).waitFor();
  });
  await manual.context.close();
}

const iphone = devices["iPhone 13"];
const webkitBrowser = await webkit.launch();
const chromeBrowser = await chromium.launch({ channel: "chrome", headless: true });

try {
  if (process.env.ONLY !== "desktop") await walk(webkitBrowser, "iphone", iphone);
  if (process.env.ONLY !== "iphone") await walk(chromeBrowser, "desktop", { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
} finally {
  await webkitBrowser.close();
  await chromeBrowser.close();
  server.close();
}

const report = {
  ok: failures.length === 0,
  failureCount: failures.length,
  failures,
};
fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
fs.writeFileSync("/opt/cursor/artifacts/customer-pass.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
