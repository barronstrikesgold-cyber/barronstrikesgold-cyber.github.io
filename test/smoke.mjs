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

try {
  for (const width of [375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Hunt" }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert(!overflow, `horizontal overflow at ${width}`);
    const tabs = ["Hunt", "Stores", "Drops", "Inventory", "Profit"];
    for (const name of tabs) {
      const tab = page.getByRole("tab", { name });
      await tab.click();
      assert(await tab.getAttribute("aria-selected") === "true", `${name} selected at ${width}`);
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
      await page.getByRole("button", { name: /Walmart/ }).click();
      await page.getByRole("heading", { name: "Walmart" }).waitFor();
      await page.getByRole("button", { name: /Hot Wheels/ }).click();
      await page.getByRole("heading", { name: "Hot Wheels" }).waitFor();
      await page.getByText("Read the card").first().waitFor();
      const cuda = page.getByRole("button", { name: /Gold '70 AAR Cuda Super/ });
      await cuda.waitFor();
      const cudaText = await cuda.innerText();
      assert(/buy/i.test(cudaText), "hunt card action is Buy");
      assert(/pay/i.test(cudaText), "cuda shows peg price");
      assert(/last sold/i.test(cudaText) && /\$82/.test(cudaText), "cuda shows sheet last sold and net");
      const lincoln = page.getByRole("button", { name: /Lincoln Continental/ });
      await lincoln.waitFor();
      assert((await lincoln.innerText()).includes("No sold data"), "2027 super has no sold");
      await page.screenshot({ path: path.join(shots, "hunt-390.png"), fullPage: false });
      assert(await page.getByRole("button", { name: /Black Nissan Skyline/ }).count() === 0, "regular TH stays out of the buy list");
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.getByRole("button", { name: /Leave these/ }).click();
      await page.getByRole("heading", { name: "Leave these" }).waitFor();
      await page.getByRole("button", { name: /Black Nissan Skyline/ }).waitFor();
      await page.getByRole("button", { name: /Basic Hot Wheels mainline/ }).waitFor();
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.getByRole("button", { name: /Car Culture/ }).click();
      await page.getByRole("button", { name: /Bel Air/ }).waitFor();
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.getByRole("button", { name: /Matchbox Super Chase/ }).click();
      await page.getByRole("button", { name: /Integra Type R/ }).waitFor();
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
      await page.getByRole("button", { name: /Hot Wheels/ }).click();
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
    }
    await page.close();
  }
  console.log("smoke.mjs OK");
} finally {
  await browser.close();
  server.close();
}
