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
      srcset: el.getAttribute("srcset") || "",
      naturalRatio: el.naturalWidth / el.naturalHeight,
      shownRatio: box.width / box.height,
      capped: box.height >= window.innerHeight * 0.78 - 2,
    };
  });
  const thumb = src.match(/^photos\/([^/]+)\.(jpe?g|png)$/i);
  const shown = thumb ? "photos/thumbs/" + thumb[1] + ".webp" : src;
  assert(framed.src === shown, label + " photo is " + shown);
  if (shown !== src) assert(framed.srcset.includes(src), label + " full photo stays in srcset");
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
    await page.getByRole("heading", { name: "What did you find?" }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert(!overflow, `horizontal overflow at ${width}`);
    const tabs = ["Home", "Tracked", "Alerts", "Account"];
    for (const name of tabs) {
      const tab = page.getByRole("tab", { name, exact: true });
      await tab.click();
      assert(await tab.getAttribute("aria-selected") === "true", `${name} selected at ${width}`);
    }
    await page.getByRole("tab", { name: "Tracked", exact: true }).click();
    await page.getByRole("tab", { name: /Bought/ }).click();
    await page.locator("[data-inv]").first().waitFor();
    for (let step = 0; step < 6 && (await page.locator("[data-inv]").count()) < 78; step++) {
      await page.locator("[data-inv-more]").click();
    }
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
      await page.getByRole("tab", { name: "Home", exact: true }).click();
      await page.getByRole("heading", { name: "What did you find?" }).waitFor();
      const strip = page.locator(".drops-strip");
      await strip.waitFor();
      const stripText = await strip.innerText();
      assert(/next/i.test(stripText), "drops strip shows the next drop");
      assert(/\bnew\b/i.test(stripText), "drops strip shows what is new");
      assert(stripText.includes("Matchbox Super Chase still landing"), "next buy drop is pinned on Hunt");
      await page.locator("#status-live").getByText("Updated just now").waitFor();
      assert(await page.locator("#update-banner").isHidden(), "update banner stays hidden until a new shell is waiting");
      await strip.click();
      await page.getByRole("heading", { name: "Calendar" }).waitFor();
      await page.getByRole("tab", { name: "Account", exact: true }).click();
      await page.getByRole("heading", { name: "Where are you?" }).waitFor();
      await page.locator(".store-pick").filter({ hasText: "Walmart" }).click();
      await page.getByRole("heading", { name: "Walmart", exact: true }).waitFor();
      const laneTitles = ["Super TH", "Premium chase", "F&F", "Matchbox Super Chase", "Exclusives", "Premium", "Multipacks", "Mainline", "Leave on peg", "Selective", "Pokémon"];
      for (const line of laneTitles) {
        await page.locator("button.lane-card").filter({ has: page.locator("b", { hasText: new RegExp("^" + line + "$") }) }).waitFor();
      }
      let resaleCount = 0;
      const bare = [];
      for (const line of laneTitles) {
        await page.locator("button.lane-card").filter({ has: page.locator("b", { hasText: new RegExp("^" + line + "$") }) }).click();
        await page.getByRole("heading", { name: line, exact: true }).waitFor();
        const cards = page.locator("[data-resale]");
        resaleCount += await cards.count();
        bare.push(...await cards.evaluateAll((els) => els.filter((el) => !el.querySelector("img")).map((el) => el.getAttribute("data-resale"))));
        await page.getByRole("button", { name: "Walmart", exact: true }).click();
        await page.getByRole("heading", { name: "Walmart", exact: true }).waitFor();
      }
      assert(resaleCount === 87, "all 87 resale cards are on the store lanes");
      assert(bare.length === 0, "every resale card has a photo tag, missing " + bare.join(","));
      await page.locator("button.lane-card").filter({ has: page.locator("b", { hasText: /^Premium chase$/ }) }).click();
      await page.getByRole("heading", { name: "Premium chase", exact: true }).waitFor();
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
      await page.locator("#header-back").click();
      await page.getByRole("heading", { name: "Premium chase", exact: true }).waitFor();
      await page.getByRole("button", { name: /Bel Air/ }).waitFor();
      await page.screenshot({ path: path.join(shots, "hunt-lines-390.png"), fullPage: false });
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.getByRole("heading", { name: "Walmart", exact: true }).waitFor();
      await page.locator("button.lane-card").filter({ has: page.locator("b", { hasText: /^Super TH$/ }) }).click();
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
      await page.locator("button.lane-card").filter({ has: page.locator("b", { hasText: /^Leave on peg$/ }) }).click();
      await page.getByRole("heading", { name: "Leave on peg" }).waitFor();
      assert(await page.getByRole("button", { name: /Black Nissan Skyline/ }).count() === 0, "skyline TH left the pass lane");
      await page.getByRole("button", { name: /Basic Hot Wheels mainline/ }).waitFor();
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.locator("button.lane-card").filter({ has: page.locator("b", { hasText: /^Premium chase$/ }) }).click();
      await page.getByRole("button", { name: /Bel Air/ }).waitFor();
      await assertFullPackage(page.getByRole("button", { name: /Bel Air/ }), "belair", "photos/belair.jpg");
      await assertFullPackage(page.getByRole("button", { name: /Datsun 510/ }), "datsun", "photos/datsun.jpg");
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.locator("button.lane-card").filter({ has: page.locator("b", { hasText: /^Matchbox Super Chase$/ }) }).click();
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
      assert((await defender.locator("img").evaluate((el) => el.getAttribute("src") || el.getAttribute("data-src"))) === "images/hw-defender.webp", "defender has a product photo");
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.locator("button.lane-card").filter({ has: page.locator("b", { hasText: /^F&F$/ }) }).click();
      await assertFullPackage(page.getByRole("button", { name: /Fast & Furious Supra/ }), "ff-supra", "photos/ff-supra.jpg");
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.locator("button.lane-card").filter({ has: page.locator("b", { hasText: /^Pokémon$/ }) }).click();
      await assertFullPackage(page.getByRole("button", { name: /Knockout/ }), "knockout", "photos/knockout.jpg");
      await assertFullPackage(page.getByRole("button", { name: /Tech Sticker/ }), "tech-sticker", "photos/tech-sticker.jpg");
      await assertFullPackage(page.getByRole("button", { name: /M6a/ }), "m6a", "photos/m6a.jpg");
      const bundle = page.getByRole("button", { name: /Booster Bundle/ });
      await bundle.waitFor();
      assert((await bundle.locator("img").first().evaluate((el) => el.getAttribute("src") || el.getAttribute("data-src"))) === "images/pokemon-etb.webp", "bundle has a product photo");
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.locator("button.lane-card").filter({ has: page.locator("b", { hasText: /^Super TH$/ }) }).click();
      await page.getByRole("button", { name: /Gold '70 AAR Cuda Super/ }).click();
      await page.getByRole("link", { name: "Google", exact: true }).waitFor();
      await page.getByRole("link", { name: "Google Shopping", exact: true }).waitFor();
      await page.getByRole("link", { name: "Search on Walmart", exact: true }).waitFor();
      await page.locator("#hunt-q").waitFor({ state: "detached" });
      await page.getByRole("tab", { name: "Home", exact: true }).click();
      await page.locator("#hunt-q").fill("Skyline");
      await page.locator("#home-grid").getByRole("button", { name: /Black Nissan Skyline/ }).waitFor();
      assert(await page.locator("#home-grid").getByRole("button", { name: /Skyline/ }).count() >= 1, "home search filters the deal grid");
      await page.locator("#hunt-q").fill("");
      await page.getByRole("tab", { name: "Account", exact: true }).click();
      await page.locator(".store-pick").filter({ hasText: "Target" }).click();
      await page.getByRole("heading", { name: "Target", exact: true }).waitFor();
      await page.locator("button.lane-card").first().waitFor();
      await page.screenshot({ path: path.join(shots, "stores-390.png"), fullPage: false });
      await page.getByRole("tab", { name: "Home", exact: true }).click();
      await page.locator(".drops-strip").click();
      await page.getByText("Latest drops", { exact: true }).waitFor();
      await page.getByText("dated drops", { exact: false }).waitFor();
      const sneakers = page.getByRole("button", { name: "Sneakers", exact: true });
      await sneakers.scrollIntoViewIfNeeded();
      await sneakers.click();
      await page.locator("#drop-calendar").waitFor();
      await page.locator(".auth-note").waitFor();
      await page.locator("[data-market]").first().waitFor();
      assert(/CHECK/.test(await page.locator("[data-market]").first().innerText()), "sneaker card is CHECK without a verified sold");
      assert(/No sold data/.test(await page.locator("[data-market]").first().innerText()), "sneaker card does not invent a sold");
      await page.getByRole("button", { name: "Jordan", exact: true }).click();
      await page.locator(".brand-word", { hasText: "Jordan" }).first().waitFor();
      assert(await page.locator(".brand-word img, .peg img[alt='Nike'], .peg img[alt='Jordan']").count() === 0, "brand chips and cards use text, not a logo");
      const designer = page.getByRole("button", { name: "Designer", exact: true });
      await designer.scrollIntoViewIfNeeded();
      await designer.click();
      await page.locator("#drop-calendar").getByText("Supreme", { exact: true }).first().waitFor();
      await page.getByRole("button", { name: "Sneakers", exact: true }).click();
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
      await page.locator("#calendar-list").waitFor();
      await page.getByText("Released").first().waitFor();
      await page.screenshot({ path: path.join(shots, "drops-390.png"), fullPage: false });
      await page.getByRole("tab", { name: "Account", exact: true }).click();
      await page.getByRole("button", { name: "Profit calculator" }).click();
      await page.getByRole("heading", { name: "Profit calculator" }).waitFor();
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
        var footer = document.querySelector(".site-footer");
        var tab = document.querySelector(".tabbar");
        var pad = parseFloat(getComputedStyle(footer).paddingBottom);
        return pad >= tab.getBoundingClientRect().height;
      });
      assert(clears, "footer padding clears the tab bar");
      const disclosure = page.getByText("As an Amazon Associate I earn from qualifying purchases.", { exact: true });
      await disclosure.scrollIntoViewIfNeeded();
      const visible = await disclosure.evaluate((el) => {
        var rect = el.getBoundingClientRect();
        var tab = document.querySelector(".tabbar").getBoundingClientRect();
        var style = getComputedStyle(el);
        return rect.height > 0 && style.visibility !== "hidden" && rect.bottom <= tab.top + 1;
      });
      assert(visible, "associates disclosure sits above the tab bar");
      await page.getByRole("tab", { name: "Home", exact: true }).click();
      await page.getByRole("button", { name: /^Catalog/ }).click();
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
      await page.getByRole("tab", { name: "Home", exact: true }).click();
      await page.getByRole("heading", { name: "What did you find?" }).waitFor();
      if (width === 375) {
        const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        assert(!homeOverflow, "home has no horizontal overflow");
        await page.locator('footer a[href="privacy.html"]').waitFor();
        await page.locator('footer a[href="terms.html"]').waitFor();
        await page.getByRole("button", { name: /^Blog/ }).click();
        await page.getByRole("heading", { name: "Blog", exact: true }).waitFor();
        await page.locator("#blog-list").getByRole("link", { name: "How Hunt scores a find" }).waitFor();
        await page.locator("#screen").getByRole("button", { name: "Home" }).click();
        await page.getByRole("heading", { name: "What did you find?" }).waitFor();
        await page.getByRole("button", { name: /^Coupons/ }).click();
        await page.getByRole("heading", { name: "Coupons", exact: true }).waitFor();
        const couponsText = await page.locator("#coupons-area").innerText();
        assert(!/EXPIRED-FIXTURE|INACTIVE-FIXTURE/.test(couponsText), "public coupons hide fixture codes");
        assert(/No active codes/.test(couponsText), "coupons area has no active codes");
        await page.getByRole("button", { name: "This device is the owner" }).click();
        await page.locator("#coupon-label").fill("Owner test");
        await page.locator("#coupon-code").fill("OWNER-LIVE");
        await page.locator("#coupon-expires").fill("2020-01-01");
        await page.getByRole("button", { name: "Save code" }).click();
        assert(!/OWNER-LIVE/.test(await page.locator("#coupons-area").innerText()), "an expired owner code is removed");
        await page.locator("#coupon-label").fill("Owner test");
        await page.locator("#coupon-code").fill("OWNER-LIVE");
        await page.locator("#coupon-expires").fill("2099-01-01");
        await page.getByRole("button", { name: "Save code" }).click();
        await page.locator("#coupons-area").getByText("OWNER-LIVE").waitFor();
        await page.getByRole("button", { name: "Remove" }).click();
        assert(!/OWNER-LIVE/.test(await page.locator("#coupons-area").innerText()), "a removed code leaves the coupons area");
        await page.locator("#screen").getByRole("button", { name: "Home" }).click();
        await page.getByRole("heading", { name: "What did you find?" }).waitFor();
        await page.goto(base + "blog/", { waitUntil: "networkidle" });
        await page.getByRole("heading", { name: "Blog", exact: true }).waitFor();
        await page.getByRole("link", { name: "How Hunt scores a find" }).click();
        await page.getByRole("heading", { name: "How Hunt scores a find" }).waitFor();
        const blogOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        assert(!blogOverflow, "blog has no horizontal overflow");
        await page.goto(base, { waitUntil: "networkidle" });
        await page.getByRole("heading", { name: "What did you find?" }).waitFor();
      }
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
