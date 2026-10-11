import { chromium, firefox, webkit } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.env.SHOTS || "/opt/cursor/artifacts/responsive";
fs.mkdirSync(out, { recursive: true });

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
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(buf);
  });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const widths = [320, 375, 390, 430, 768, 1024, 1440, 1920];
const engines = [
  ["chromium", chromium],
  ["webkit", webkit],
  ["firefox", firefox],
];
const themes = ["dark", "light"];
const failures = [];

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

async function openHome(page) {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "What did you find?" }).waitFor({ timeout: 20000 });
  await page.locator("#status-live").waitFor();
}

async function metrics(page, width) {
  return page.evaluate((viewportWidth) => {
    const tab = document.querySelector(".tabbar").getBoundingClientRect();
    const screen = document.querySelector(".screen");
    const list = document.querySelector("#hunt-body .list");
    const scan = getComputedStyle(document.querySelector(".scan"));
    const ink = getComputedStyle(document.body).color;
    const bg = getComputedStyle(document.body).backgroundColor;
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      tabX: tab.x,
      tabY: tab.y,
      tabW: tab.width,
      tabH: tab.height,
      viewH: window.innerHeight,
      viewW: window.innerWidth,
      columns: list ? getComputedStyle(list).gridTemplateColumns.split(" ").filter(Boolean).length : 0,
      scanColor: scan.color,
      scanBg: scan.backgroundColor,
      theme: document.documentElement.getAttribute("data-theme"),
      pad: parseFloat(getComputedStyle(screen).paddingBottom),
      wordmark: document.querySelector(".wordmark").textContent,
      viewportWidth,
      ink,
      bg,
    };
  }, width);
}

try {
  for (const [name, engine] of engines) {
    const browser = await engine.launch();
    for (const theme of themes) {
      const context = await browser.newContext({ deviceScaleFactor: 1 });
      await context.addInitScript((choice) => {
        localStorage.setItem("hunt-theme", choice);
      }, theme);
      const page = await context.newPage();
      for (const width of widths) {
        await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
        await openHome(page);
        await page.locator("#hunt-q").fill("super");
        await page.locator("#hunt-body .list .flow-row").first().waitFor();
        const shot = path.join(out, `${name}-${width}-${theme}.png`);
        await page.screenshot({ path: shot });
        const info = await metrics(page, width);
        assert(info.wordmark === "Hunt", `${name} ${width} ${theme} wordmark`);
        assert(info.theme === theme, `${name} ${width} ${theme} data-theme is ${info.theme}`);
        assert(!info.overflow, `${name} ${width} ${theme} horizontal overflow`);
        const side = info.tabW < info.viewW * 0.45 && info.tabX <= 2 && info.tabH > info.viewH * 0.7;
        const bottom = info.tabW > info.viewW * 0.8 && info.tabY > info.viewH * 0.55;
        if (width >= 1024) assert(side, `${name} ${width} ${theme} side nav (${Math.round(info.tabW)}x${Math.round(info.tabH)} at ${Math.round(info.tabX)},${Math.round(info.tabY)})`);
        else assert(bottom, `${name} ${width} ${theme} bottom tabs (${Math.round(info.tabW)}x${Math.round(info.tabH)} at ${Math.round(info.tabY)})`);
        const expectedCols = width >= 1440 ? 4 : width >= 1100 ? 3 : width >= 700 ? 2 : 1;
        assert(info.columns === expectedCols, `${name} ${width} ${theme} grid columns ${info.columns} expected ${expectedCols}`);
        assert(info.scanBg.includes("255, 77, 0") || info.scanBg.includes("255,77,0"), `${name} ${width} scan background ${info.scanBg}`);
        assert(info.scanColor.includes("7, 7, 8") || info.scanColor.includes("7,7,8"), `${name} ${width} scan text ${info.scanColor}`);
        if (width < 1024) assert(info.pad >= 64, `${name} ${width} content clears the tab bar`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await openHome(page);
      await page.locator("#hunt-q").fill("cuda");
      await page.locator("#hunt-body .flow-row").first().click();
      await page.getByRole("button", { name: "Track this item" }).waitFor();
      await page.getByRole("button", { name: "Set price alert" }).waitFor();
      assert(await page.locator(".verdict-word").innerText() !== "", `${name} ${theme} verdict word`);
      await page.getByRole("button", { name: "Track this item" }).click();
      await page.getByRole("heading", { name: "Tracked" }).waitFor();
      await page.getByRole("tab", { name: /Bought/ }).click();
      await page.locator("#bought-summary").waitFor();
      await page.getByRole("tab", { name: "Account" }).click();
      await page.getByText("Broken Beaker Labs LC", { exact: true }).waitFor();
      await page.getByRole("button", { name: theme === "dark" ? "Light" : "Dark" }).click();
      const flipped = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      assert(flipped === (theme === "dark" ? "light" : "dark"), `${name} theme toggle flipped to ${flipped}`);
      await page.screenshot({ path: path.join(out, `${name}-390-account-toggle.png`) });
      await context.close();
    }
    await browser.close();
    console.log(name, "done");
  }
} finally {
  server.close();
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("responsive.mjs OK", fs.readdirSync(out).length, "shots");
