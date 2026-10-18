import { chromium, webkit, devices } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = "/opt/cursor/artifacts/screenshots/legacy";
fs.mkdirSync(shots, { recursive: true });
const iphone = devices["iPhone 13"];
const liveCache = (fs.readFileSync(path.join(root, "sw.js"), "utf8").match(/var CACHE = "([^"]+)"/) || [])[1];
const staleCache = "reseller-shell-old-test";

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

const staleHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hunt</title>
<link rel="stylesheet" href="styles.css"></head>
<body style="margin:0;background:#000;color:#fff">
<header>Hunt Stores <button type="button">Back</button></header>
<main id="screen" style="background:#000;min-height:80vh"></main>
<nav><button type="button" aria-selected="true">Home</button></nav>
<script>navigator.serviceWorker.register("./sw.js")</script>
</body></html>`;

const staleCss = "html,body,main{background:#000;color:#fff;min-height:100vh}";
const staleApp = "/* stale shell with an empty screen */";
const staleSw = `var CACHE = "${staleCache}";
var SHELL = ["./index.html", "./app.js", "./styles.css", "./sw.js"];
self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(SHELL);
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(function (res) {
    var copy = res.clone();
    caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
    return res;
  }).catch(function () {
    return caches.match(event.request).then(function (hit) {
      return hit || new Response("offline", { status: 503 });
    });
  }));
});
`;

let shell = "live";

function fileFor(pathname) {
  if (pathname === "/") return path.join(root, "index.html");
  const file = path.join(root, decodeURIComponent(pathname));
  if (!file.startsWith(root)) return null;
  return file;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const headers = {
    "Cache-Control": "no-store",
    "Service-Worker-Allowed": "/",
  };
  if (shell === "stale" && (url.pathname === "/" || url.pathname === "/index.html")) {
    res.writeHead(200, { ...headers, "Content-Type": "text/html; charset=utf-8" });
    res.end(staleHtml);
    return;
  }
  if (shell === "stale" && url.pathname === "/app.js") {
    res.writeHead(200, { ...headers, "Content-Type": "text/javascript; charset=utf-8" });
    res.end(staleApp);
    return;
  }
  if (shell === "stale" && url.pathname === "/styles.css") {
    res.writeHead(200, { ...headers, "Content-Type": "text/css; charset=utf-8" });
    res.end(staleCss);
    return;
  }
  if (shell === "stale" && url.pathname === "/sw.js") {
    res.writeHead(200, { ...headers, "Content-Type": "text/javascript; charset=utf-8" });
    res.end(staleSw);
    return;
  }
  const file = fileFor(url.pathname);
  if (!file) {
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
      ...headers,
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
    });
    res.end(buf);
  });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port + "/";
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const routes = [
  { hash: "#/stores", tab: "home", needle: "Walmart", shot: "stores" },
  { hash: "#/archive", tab: "catalog", needle: "Hot Wheels book", shot: "archive" },
  { hash: "#/hw", tab: "catalog", needle: "Hot Wheels book", shot: "hw" },
  { hash: "#/profit", tab: "stuff", needle: "Profit calculator", shot: "profit" },
  { hash: "#/inventory", tab: "stuff", needle: "packages", shot: "inventory" },
  { hash: "#/coupons", tab: "stuff", needle: "Coupons", shot: "coupons" },
  { hash: "#/hunt", tab: "home", needle: "What did you find?", shot: "hunt" },
];

async function readRoute(page) {
  return page.evaluate(() => {
    const screen = document.querySelector("#screen");
    const zoom = document.querySelector("#zoom");
    const search = document.querySelector("#global-q");
    const selected = Array.from(document.querySelectorAll(".tabbar [data-tab]"))
      .filter((btn) => btn.getAttribute("aria-selected") === "true")
      .map((btn) => btn.getAttribute("data-tab"));
    let placeholderFits = true;
    if (search) {
      const style = getComputedStyle(search);
      const probe = document.createElement("span");
      probe.textContent = search.getAttribute("placeholder") || "";
      probe.style.font = style.font;
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      document.body.appendChild(probe);
      const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      placeholderFits = search.getBoundingClientRect().width + 1 >= probe.getBoundingClientRect().width + pad;
      probe.remove();
    }
    const rect = screen ? screen.getBoundingClientRect() : { top: 0, left: 0, width: 0, height: 0 };
    const x = Math.min(window.innerWidth - 8, Math.max(8, rect.left + Math.min(rect.width / 2, 40)));
    const y = Math.min(window.innerHeight - 8, Math.max(8, rect.top + 48));
    const hit = document.elementFromPoint(x, y);
    const screenHit = !!(screen && hit && (hit === screen || screen.contains(hit)));
    return {
      text: screen ? screen.innerText : "",
      zoom: zoom ? getComputedStyle(zoom).display : "missing",
      zoomOpen: !!(zoom && zoom.open),
      search: search ? Math.round(search.getBoundingClientRect().width) : 0,
      placeholder: search ? search.getAttribute("placeholder") : "",
      placeholderFits,
      selected,
      screenHit,
      hit: hit ? hit.id || hit.tagName : "",
    };
  });
}

async function openRoute(page, route) {
  await page.goto(base + route.hash, { waitUntil: "domcontentloaded" });
  await page.waitForFunction((needle) => {
    const screen = document.querySelector("#screen");
    return !!(screen && screen.innerText && screen.innerText.indexOf(needle) !== -1);
  }, route.needle, { timeout: 20000 });
  const info = await readRoute(page);
  assert(info.text.includes(route.needle), route.hash + " missing " + route.needle + " got " + info.text.slice(0, 180));
  assert(info.text.trim().length > 20, route.hash + " rendered an empty screen");
  assert(!info.text.includes("This page didn't load"), route.hash + " stayed on the empty-screen error");
  assert(!info.text.includes("Stores didn't load"), route.hash + " stayed on the stores error");
  assert(info.zoom === "none", route.hash + " closed lightbox display is " + info.zoom);
  assert(!info.zoomOpen, route.hash + " lightbox is open");
  assert(info.selected.length === 1 && info.selected[0] === route.tab, route.hash + " highlighted " + info.selected.join(",") + " expected " + route.tab);
  assert(info.screenHit, route.hash + " content is covered by " + info.hit);
  assert(info.search >= 180, route.hash + " search width " + info.search);
  assert(info.placeholder === "Search deals and brands", route.hash + " placeholder changed");
  assert(info.placeholderFits, route.hash + " placeholder is clipped at width " + info.search);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert(!overflow, route.hash + " overflows horizontally");
}

async function deepLinks(browserType, label) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ ...iphone });
  const page = await context.newPage();
  try {
    for (const route of routes) {
      await openRoute(page, route);
      if (route.shot === "stores") {
        await page.screenshot({ path: path.join(shots, label + "-stores.png") });
      }
      console.log("OK", label, route.hash);
    }
  } finally {
    await browser.close();
  }
}

async function upgrade(browserType, label) {
  shell = "stale";
  const browser = await browserType.launch();
  const context = await browser.newContext({ ...iphone });
  const page = await context.newPage();
  try {
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 });
    const stale = await page.evaluate(async () => {
      const text = (document.querySelector("#screen") || {}).innerText || "";
      const keys = await caches.keys();
      return { text: text.trim(), keys, controlled: !!navigator.serviceWorker.controller };
    });
    assert(stale.controlled, label + " stale page is not controlled");
    assert(stale.text === "", label + " stale screen was not empty: " + stale.text.slice(0, 80));
    assert(stale.keys.indexOf(staleCache) !== -1, label + " missing stale cache " + stale.keys.join(","));
    shell = "live";
    await page.evaluate(() => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("controllerchange timeout")), 15000);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        clearTimeout(timer);
        resolve("changed");
      }, { once: true });
      navigator.serviceWorker.getRegistration().then((reg) => reg.update()).catch(reject);
    }));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction((name) => {
      const search = document.querySelector("#global-q");
      return !!(search && navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL.indexOf("sw.js") !== -1);
    }, liveCache, { timeout: 15000 });
    const keys = await page.evaluate(async () => caches.keys());
    assert(keys.indexOf(liveCache) !== -1, label + " new cache missing: " + keys.join(","));
    assert(keys.indexOf(staleCache) === -1, label + " stale cache still present: " + keys.join(","));
    for (const route of routes) {
      await openRoute(page, route);
      console.log("OK", label, "upgrade", route.hash);
    }
    await page.screenshot({ path: path.join(shots, label + "-upgrade-stores.png") });
  } finally {
    shell = "live";
    await browser.close();
  }
}

try {
  shell = "live";
  await deepLinks(webkit, "webkit");
  let webkitUpgrade = "";
  try {
    await upgrade(webkit, "webkit");
    webkitUpgrade = "webkit service worker upgraded";
  } catch (err) {
    webkitUpgrade = "webkit service worker: " + (err && err.message ? err.message.split("\n")[0] : err);
    console.error("WEBKIT SW", webkitUpgrade);
    await upgrade(chromium, "chromium-iphone");
  }
  console.log("legacy-routes.mjs OK");
  console.log(webkitUpgrade);
} catch (err) {
  failures.push(err && err.message ? err.message : String(err));
  console.error("FAIL", failures[0]);
  process.exitCode = 1;
} finally {
  await new Promise((resolve) => server.close(resolve));
}

if (failures.length) process.exit(1);
