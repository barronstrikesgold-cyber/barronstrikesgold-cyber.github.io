import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
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
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(buf);
  });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const shots = path.join(root, "test-results");
fs.mkdirSync(shots, { recursive: true });

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function assertFullPackage(locator, label, src) {
  const img = locator.locator(".peg-photo.is-hero img");
  await img.waitFor();
  await locator.scrollIntoViewIfNeeded();
  await img.evaluate((el) => {
    if (el.complete && el.naturalWidth) return true;
    return new Promise((resolve, reject) => {
      el.addEventListener("load", () => resolve(true), { once: true });
      el.addEventListener("error", () => reject(new Error("photo failed to load")), { once: true });
    });
  });
  const text = await locator.innerText();
  assert(!/photo needed/i.test(text), label + " is not Photo needed");
  const framed = await img.evaluate((el) => {
    const frame = el.parentElement.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      fit: style.objectFit,
      position: style.objectPosition,
      frameH: frame.height,
      imgH: box.height,
      src: el.getAttribute("src"),
      naturalRatio: el.naturalWidth / el.naturalHeight,
      shownRatio: box.width / box.height,
      capped: box.height >= window.innerHeight * 0.78 - 2,
    };
  });
  assert(framed.src === src, label + " photo is " + src);
  assert(framed.fit === "contain", label + " photo uses contain");
  assert(framed.position === "50% 50%", label + " photo is centered");
  assert(framed.imgH > 120, label + " photo is tall enough to include the car");
  assert(Math.abs(framed.frameH - framed.imgH) < 2, label + " photo fills the frame");
  assert(Math.abs(framed.shownRatio - 4 / 3) < 0.08, label + " photo uses the fixed frame");
  assert(framed.naturalRatio > 0, label + " photo loaded");
}

try {
  for (const width of [375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Hunt" }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert(!overflow, `horizontal overflow at ${width}`);
    const tabs = ["Hunt", "Catalog", "Stores", "Drops", "Inventory", "Profit"];
    for (const name of tabs) {
      const tab = page.getByRole("tab", { name });
      await tab.click();
      assert(await tab.getAttribute("aria-selected") === "true", `${name} selected at ${width}`);
      if (name === "Drops") {
        await page.getByText("Latest drops", { exact: true }).waitFor();
        await page.getByText("On the buy list", { exact: true }).waitFor();
        const dropsOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        assert(!dropsOverflow, `drops overflow at ${width}`);
      }
    }
    await page.getByRole("tab", { name: "Inventory" }).click();
    await page.getByRole("heading", { name: "Inventory" }).waitFor();
    await page.getByText("78 packages").waitFor();
    const rows = await page.locator("[data-inv]").count();
    assert(rows === 78, `expected 78 inventory rows at ${width}, saw ${rows}`);
    await page.getByRole("button", { name: /Lotus Sport Elise STH/ }).waitFor();
    await page.getByRole("button", { name: /Subaru Impreza WRX STI rally \(2nd\)/ }).waitFor();
    await page.getByRole("button", { name: /Subaru Impreza WRX STI rally/ }).first().waitFor();
    const lotus = page.getByRole("button", { name: /Lotus Sport Elise STH/ });
    assert((await lotus.innerText()).includes("STH"), "Lotus row shows STH");
    assert((await lotus.innerText()).includes("Sell this first"), "Lotus is a sell-first piece");
    const sub = page.getByRole("button", { name: /Subaru Impreza WRX STI rally \(2nd\)/ });
    assert((await sub.innerText()).includes("Verify STH"), "second Subaru is Verify STH");
    if (width === 390) {
      await page.screenshot({ path: path.join(shots, "inventory-390.png"), fullPage: false });
      await page.getByRole("tab", { name: "Hunt" }).click();
      await page.getByRole("heading", { name: "Where are you?" }).waitFor();
      const strip = page.locator(".drops-strip");
      await strip.waitFor();
      const stripText = await strip.innerText();
      assert(/next/i.test(stripText), "drops strip shows the next drop");
      assert(/\bnew\b/i.test(stripText), "drops strip shows what is new");
      assert(stripText.includes("Matchbox Super Chase still landing"), "next buy drop is pinned on Hunt");
      await page.locator("#status-live").getByText("Updated just now").waitFor();
      assert(await page.locator("#update-banner").isHidden(), "update banner stays hidden until a new shell is waiting");
      await strip.click();
      await page.getByRole("heading", { name: "Drops" }).waitFor();
      await page.getByRole("tab", { name: "Hunt" }).click();
      await page.getByRole("heading", { name: "Where are you?" }).waitFor();
      for (const line of ["Super TH", "Premium chase", "F&F", "Matchbox Super Chase", "Exclusives", "Premium", "Multipacks", "Mainline", "Leave on peg", "Selective", "Pokémon"]) {
        await page.getByRole("heading", { name: line, exact: true }).waitFor();
      }
      assert(await page.locator("[data-resale]").count() === 87, "all 87 resale cards are on Hunt");
      const bare = await page.locator("[data-resale]").evaluateAll((els) => els.filter((el) => !el.querySelector("img")).map((el) => el.getAttribute("data-resale")));
      assert(bare.length === 0, "every resale card has a photo tag, missing " + bare.join(","));
      await assertFullPackage(page.getByRole("button", { name: /Aero Styles/ }), "aero", "photos/resale/hw26-001.jpg");
      assert(/BUY/.test(await page.getByRole("button", { name: /Aero Styles/ }).innerText()), "aero is BUY");
      assert(/\$204\.67/.test(await page.getByRole("button", { name: /Aero Styles/ }).innerText()), "aero shows net");
      await page.getByRole("button", { name: /Aero Styles/ }).click();
      await page.getByRole("heading", { name: /Aero Styles/ }).waitFor();
      await page.getByRole("link", { name: "eBay sold" }).waitFor();
      await page.getByRole("link", { name: "eBay active" }).waitFor();
      const amazonHref = await page.getByRole("link", { name: "Amazon", exact: true }).getAttribute("href");
      const amazonRel = await page.getByRole("link", { name: "Amazon", exact: true }).getAttribute("rel");
      assert(amazonHref.includes("tag=hempsply02-20") && amazonHref.includes("/s?k="), "detail Amazon link is a tagged search");
      assert((await page.getByRole("link", { name: "eBay sold" }).getAttribute("href")).includes("LH_Sold=1"), "detail eBay link is sold listings");
      assert(amazonRel === "sponsored noopener", "detail buy links are sponsored");
      const detailImg = page.locator(".peg-photo.is-hero img").first();
      await detailImg.evaluate((el) => {
        if (el.complete && el.naturalWidth) return true;
        return new Promise((resolve, reject) => {
          el.addEventListener("load", () => resolve(true), { once: true });
          el.addEventListener("error", () => reject(new Error("detail photo failed")), { once: true });
        });
      });
      assert((await detailImg.getAttribute("referrerpolicy")) === "no-referrer", "detail photo omits the referrer");
      await page.getByRole("button", { name: "Back" }).click();
      await page.getByRole("heading", { name: "Where are you?" }).waitFor();
      await page.getByRole("button", { name: /Bel Air/ }).waitFor();
      await page.getByRole("button", { name: /Integra Type R/ }).waitFor();
      await page.getByRole("button", { name: /Fast & Furious Supra/ }).waitFor();
      await page.getByRole("button", { name: /Lincoln Continental/ }).waitFor();
      await page.getByRole("button", { name: /Knockout/ }).waitFor();
      await page.getByRole("button", { name: /Booster Bundle/ }).waitFor();
      await page.getByRole("button", { name: /Wave 2/ }).waitFor();
      await page.screenshot({ path: path.join(shots, "hunt-lines-390.png"), fullPage: false });
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.getByRole("heading", { name: "Walmart" }).waitFor();
      await page.getByRole("button", { name: /Super TH/ }).click();
      await page.getByRole("heading", { name: "Super TH" }).waitFor();
      await page.getByText("Read the card").first().waitFor();
      const cuda = page.getByRole("button", { name: /Gold '70 AAR Cuda Super/ });
      await cuda.scrollIntoViewIfNeeded();
      await cuda.waitFor();
      const cudaText = await cuda.innerText();
      assert(/buy/i.test(cudaText), "hunt card action is Buy");
      await cuda.locator(".peg-photo img").evaluate((el) => {
        if (el.complete && el.naturalWidth) return true;
        return new Promise((resolve, reject) => {
          el.addEventListener("load", () => resolve(true), { once: true });
          el.addEventListener("error", () => reject(new Error("cuda photo failed")), { once: true });
        });
      });
      const framed = await cuda.locator(".peg-photo img").evaluate((img) => {
        const frame = img.parentElement.getBoundingClientRect();
        const box = img.getBoundingClientRect();
        const style = getComputedStyle(img);
        return {
          fit: style.objectFit,
          position: style.objectPosition,
          frameH: frame.height,
          imgH: box.height,
          naturalRatio: img.naturalWidth / img.naturalHeight,
          shownRatio: box.width / box.height,
        };
      });
      assert(framed.fit === "contain", "cuda photo uses contain");
      assert(framed.position === "50% 50%", "cuda photo is centered");
      assert(framed.imgH > 120, "cuda photo is tall enough to include the car");
      assert(Math.abs(framed.frameH - framed.imgH) < 2, "cuda photo fills the frame");
      assert(Math.abs(framed.shownRatio - 4 / 3) < 0.08, "cuda photo uses the fixed frame");
      const firebird = page.getByRole("button", { name: /Firebird 400 Super/ });
      await firebird.scrollIntoViewIfNeeded();
      await firebird.locator(".peg-photo img").evaluate((el) => {
        if (el.complete && el.naturalWidth) return true;
        return new Promise((resolve, reject) => {
          el.addEventListener("load", () => resolve(true), { once: true });
          el.addEventListener("error", () => reject(new Error("firebird photo failed")), { once: true });
        });
      });
      assert(/CHECK/.test(await firebird.innerText()), "firebird is CHECK");
      const fireFrame = await firebird.locator(".peg-photo img").evaluate((img) => {
        const frame = img.parentElement.getBoundingClientRect();
        const box = img.getBoundingClientRect();
        return { frameH: frame.height, imgH: box.height, shownRatio: box.width / box.height, naturalRatio: img.naturalWidth / img.naturalHeight };
      });
      assert(fireFrame.imgH > 120, "firebird photo is tall enough to include the car");
      assert(Math.abs(fireFrame.frameH - fireFrame.imgH) < 2, "firebird photo fills the frame");
      assert(Math.abs(fireFrame.shownRatio - 4 / 3) < 0.08, "firebird photo uses the fixed frame");
      assert(/pay/i.test(cudaText), "cuda shows peg price");
      assert(/last sold/i.test(cudaText) && /\$78\.52/.test(cudaText), "cuda shows Oct 2026 last sold and net");
      assert(/Read the card/i.test(cudaText), "cuda shows how to spot");
      const lincoln = page.getByRole("button", { name: /Lincoln Continental/ });
      await lincoln.waitFor();
      assert((await lincoln.innerText()).includes("No sold data"), "2027 super has no sold");
      await page.screenshot({ path: path.join(shots, "hunt-390.png"), fullPage: false });
      const sky = page.getByRole("button", { name: /Black Nissan Skyline/ });
      await sky.waitFor();
      assert(/BUY/.test(await sky.innerText()) && /Last sold/i.test(await sky.innerText()), "skyline TH is on the resale list");
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.getByRole("button", { name: /Leave on peg/ }).click();
      await page.getByRole("heading", { name: "Leave on peg" }).waitFor();
      assert(await page.getByRole("button", { name: /Black Nissan Skyline/ }).count() === 0, "skyline TH left the pass lane");
      await page.getByRole("button", { name: /Basic Hot Wheels mainline/ }).waitFor();
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.getByRole("button", { name: /Premium chase/ }).click();
      await page.getByRole("button", { name: /Bel Air/ }).waitFor();
      await assertFullPackage(page.getByRole("button", { name: /Bel Air/ }), "belair", "photos/belair.jpg");
      await assertFullPackage(page.getByRole("button", { name: /Datsun 510/ }), "datsun", "photos/datsun.jpg");
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.getByRole("button", { name: /Matchbox Super Chase/ }).click();
      await page.getByRole("button", { name: /Integra Type R/ }).waitFor();
      await assertFullPackage(page.getByRole("button", { name: /Integra Type R/ }), "mb-integra", "photos/mb-integra.jpg");
      await assertFullPackage(page.getByRole("button", { name: /Porsche 911 Rally/ }), "mb-911", "photos/mb-911.jpg");
      await assertFullPackage(page.getByRole("button", { name: /Jaguar XJ6C/ }), "mb-jag", "photos/mb-jag.jpg");
      await assertFullPackage(page.getByRole("button", { name: /Ford Bronco/ }), "mb-bronco", "photos/mb-bronco.jpg");
      await assertFullPackage(page.getByRole("button", { name: /GT-R NISMO/ }), "mb-gtr", "photos/mb-gtr.jpg");
      await assertFullPackage(page.getByRole("button", { name: /Porsche 356A/ }), "mb-356", "photos/mb-356.jpg");
      await assertFullPackage(page.getByRole("button", { name: /Vanquish/ }), "mb-vanquish", "photos/mb-vanquish.jpg");
      const defender = page.getByRole("button", { name: /Defender 130/ });
      await defender.waitFor();
      assert(/photo needed/i.test(await defender.innerText()), "defender stays Photo needed");
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.getByRole("button", { name: /F&F/ }).click();
      await assertFullPackage(page.getByRole("button", { name: /Fast & Furious Supra/ }), "ff-supra", "photos/ff-supra.jpg");
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.getByRole("button", { name: /Pokémon/ }).click();
      await assertFullPackage(page.getByRole("button", { name: /Knockout/ }), "knockout", "photos/knockout.jpg");
      await assertFullPackage(page.getByRole("button", { name: /Tech Sticker/ }), "tech-sticker", "photos/tech-sticker.jpg");
      await assertFullPackage(page.getByRole("button", { name: /M6a/ }), "m6a", "photos/m6a.jpg");
      const bundle = page.getByRole("button", { name: /Booster Bundle/ });
      await bundle.waitFor();
      assert(/photo needed/i.test(await bundle.innerText()), "bundle stays Photo needed");
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.getByRole("button", { name: /Super TH/ }).click();
      await page.getByRole("button", { name: /Gold '70 AAR Cuda Super/ }).click();
      await page.getByRole("link", { name: "Google", exact: true }).waitFor();
      await page.getByRole("link", { name: "Google Shopping", exact: true }).waitFor();
      await page.getByRole("link", { name: "Search on Walmart", exact: true }).waitFor();
      await page.locator("#hunt-q").waitFor({ state: "detached" });
      await page.getByRole("tab", { name: "Hunt" }).click();
      await page.locator("#hunt-q").fill("spectraflame blue");
      await page.getByRole("button", { name: /Subaru Impreza WRX STI rally \(2nd\)/ }).waitFor();
      assert(await page.getByRole("button", { name: /Subaru Impreza/ }).count() === 3, "search finds both book Subarus and the Impreza Super");
      await page.locator("#hunt-q").fill("");
      await page.getByRole("tab", { name: "Stores" }).click();
      await page.getByRole("button", { name: /Target/ }).click();
      await page.getByRole("link", { name: "Search on Target", exact: true }).first().waitFor();
      await page.getByRole("button", { name: "Search on Target.com" }).waitFor();
      await page.getByRole("link", { name: "Google", exact: true }).first().waitFor();
      const href = await page.getByRole("link", { name: "Google", exact: true }).first().getAttribute("href");
      assert(href && href.includes("google.com/search"), "Google check is a search link");
      await page.screenshot({ path: path.join(shots, "stores-390.png"), fullPage: false });
      await page.getByRole("tab", { name: "Drops" }).click();
      await page.getByText("Latest drops", { exact: true }).waitFor();
      await page.getByText("On the buy list", { exact: true }).waitFor();
      const sneakers = page.getByRole("button", { name: "Sneakers", exact: true });
      await sneakers.scrollIntoViewIfNeeded();
      await sneakers.click();
      await page.locator("[data-market]").first().waitFor();
      assert(/CHECK/.test(await page.locator("[data-market]").first().innerText()), "sneaker card is CHECK without a verified sold");
      assert(/No sold data/.test(await page.locator("[data-market]").first().innerText()), "sneaker card does not invent a sold");
      await page.locator("[data-market]").first().click();
      await page.getByText("No sold data", { exact: true }).waitFor();
      await page.getByText("Net is sold × 0.87 − $5.", { exact: true }).waitFor();
      await page.locator("button.back").click();
      const lego = page.getByRole("button", { name: "LEGO", exact: true });
      await lego.scrollIntoViewIfNeeded();
      await lego.click();
      await page.locator("[data-market]").first().waitFor();
      assert(/PASS/.test(await page.locator("[data-market]").first().innerText()), "a LEGO card can be PASS");
      assert(/Sold \$/.test(await page.locator("[data-market]").first().innerText()), "a LEGO card shows the sold comp");
      await page.locator("[data-market]").first().click();
      await page.getByRole("link", { name: "Sold source" }).waitFor();
      await page.locator("button.back").click();
      const pokemon = page.getByRole("button", { name: "Pokémon", exact: true });
      await pokemon.scrollIntoViewIfNeeded();
      await pokemon.click();
      await page.locator("[data-market]").first().waitFor();
      assert(/BUY/.test(await page.locator("[data-market]").first().innerText()), "the 30th Celebration ETB can be BUY");
      await page.getByText("On the buy list", { exact: true }).waitFor();
      await page.getByText("Released").first().waitFor();
      await page.screenshot({ path: path.join(shots, "drops-390.png"), fullPage: false });
      await page.getByRole("tab", { name: "Profit" }).click();
      await page.getByRole("heading", { name: "Profit" }).waitFor();
      await page.locator("#profit-item").selectOption("c:f40");
      await page.getByText("No sold data", { exact: true }).waitFor();
      await page.getByText("Enter Your sold to see an estimate. A blank field is not a return.").waitFor();
      assert((await page.locator("#profit-roi").innerText()) === "", "blank sold does not show ROI");
      await page.locator("#profit-sold").fill("122");
      await page.getByText("Estimate only. Not a realized return.").waitFor();
      await page.getByText("Fees · $15.86 · You entered this").waitFor();
      await page.screenshot({ path: path.join(shots, "profit-390.png"), fullPage: false });
      const target = await page.locator(".tabbar button").first().evaluate((el) => el.getBoundingClientRect().height);
      assert(target >= 44, "tab target is at least 44px");
      const clears = await page.evaluate(() => {
        var screen = document.querySelector(".screen");
        var tab = document.querySelector(".tabbar");
        var pad = parseFloat(getComputedStyle(screen).paddingBottom);
        return pad >= tab.getBoundingClientRect().height + 24;
      });
      assert(clears, "screen padding clears the tab bar");
      const disclosure = page.getByText("As an Amazon Associate I earn from qualifying purchases.", { exact: true });
      await disclosure.waitFor();
      const visible = await disclosure.evaluate((el) => {
        var rect = el.getBoundingClientRect();
        var tab = document.querySelector(".tabbar").getBoundingClientRect();
        var style = getComputedStyle(el);
        return rect.height > 0 && style.visibility !== "hidden" && rect.bottom <= tab.top + 1;
      });
      assert(visible, "associates disclosure sits above the tab bar");
      await page.getByRole("tab", { name: "Catalog" }).click();
      await page.getByRole("heading", { name: "Catalog" }).waitFor();
      await page.waitForFunction(() => {
        const img = document.querySelector(".hw-card .hw-photo img");
        if (!img) return false;
        const src = img.getAttribute("src") || "";
        const hosted = src.startsWith("assets/hw/thumbs/") || src.startsWith("https://");
        return hosted && img.complete && img.naturalWidth > 0 && img.getAttribute("referrerpolicy") === "no-referrer";
      }, null, { timeout: 20000 });
      await page.locator("#archive-year").selectOption("1968");
      await page.locator("#archive-q").fill("Cougar");
      await page.locator(".hw-card h2", { hasText: "Custom Cougar" }).waitFor();
      await page.waitForFunction(() => {
        const img = document.querySelector(".hw-card .hw-photo img");
        if (!img) return false;
        const src = img.getAttribute("src") || "";
        return src.startsWith("assets/hw/thumbs/") && img.complete && img.naturalWidth > 0;
      });
      await page.getByRole("button", { name: "Worth reselling" }).click();
      assert(await page.getByRole("button", { name: "Worth reselling" }).getAttribute("aria-pressed") === "true", "worth filter toggles");
      await page.locator("#archive-q").fill("");
      await page.locator("#archive-year").selectOption("all");
      await page.locator(".hw-card, .state-card").first().waitFor();
      const overflowCatalog = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      assert(!overflowCatalog, "catalog has no horizontal overflow");
      await page.getByRole("tab", { name: "Hunt" }).click();
      await page.getByRole("heading", { name: "Where are you?" }).waitFor();
      const refresh = page.waitForRequest((req) => req.url().includes("data/drops.json"));
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      const came = await refresh;
      assert(came.url().includes("drops.json"), "returning to the page refetches drops");
      await page.locator("#status-live").getByText(/Updated just now|Could not update/).waitFor();
    }
    await page.close();
  }
  console.log("smoke.mjs OK");
} finally {
  await browser.close();
  server.close();
}
