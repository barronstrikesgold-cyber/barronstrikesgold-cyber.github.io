"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function startServer() {
  const server = http.createServer(function (req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const file = path.normalize(path.join(root, rel));
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, function (err, buf) {
      if (err) {
        res.writeHead(404);
        res.end("missing");
        return;
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(buf);
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, "127.0.0.1", function () { resolve(server); });
  });
}

function expectedProducts() {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/catalog.json"), "utf8"));
  const market = JSON.parse(fs.readFileSync(path.join(root, "data/market.json"), "utf8"));
  const drops = JSON.parse(fs.readFileSync(path.join(root, "data/drops.json"), "utf8"));
  const golf = JSON.parse(fs.readFileSync(path.join(root, "data/golf.json"), "utf8"));
  let catalogCount = 0;
  Object.keys(catalog).forEach(function (key) { catalogCount += (catalog[key] || []).length; });
  let marketCount = 0;
  (market.sections || []).forEach(function (section) { marketCount += (section.items || []).length; });
  return {
    catalog: catalogCount,
    market: marketCount,
    golf: (golf.look || []).length,
    drops: drops.length,
    total: catalogCount + marketCount + (golf.look || []).length + drops.length,
  };
}

function classify(status, body) {
  const title = ((body.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim();
  const bot = status === 503 || status === 429 || /api-services-support@amazon\.com/.test(body);
  const notFound = status === 404 || /page not found/i.test(title) || /Dogs of Amazon/i.test(body) || /couldn't find that page/i.test(body);
  if (notFound && !bot) return "missing";
  if (bot) return "inconclusive";
  if (status >= 200 && status < 400) return "ok";
  return "inconclusive";
}

async function checkDp(urls) {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
  const broken = [];
  let ok = 0;
  let inconclusive = 0;
  for (let i = 0; i < urls.length; i += 4) {
    const batch = urls.slice(i, i + 4);
    const results = await Promise.all(batch.map(async function (url) {
      const ctrl = new AbortController();
      const timer = setTimeout(function () { ctrl.abort(); }, 20000);
      try {
        const res = await fetch(url, {
          redirect: "follow",
          signal: ctrl.signal,
          headers: { "User-Agent": ua, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
        });
        const text = res.status === 503 || res.status === 429 ? "" : await res.text();
        return { url: url, status: res.status, kind: classify(res.status, text.slice(0, 120000)) };
      } catch (err) {
        return { url: url, status: 0, kind: "inconclusive", error: err.name };
      } finally {
        clearTimeout(timer);
      }
    }));
    results.forEach(function (row) {
      if (row.kind === "missing") broken.push(row.url + " status " + row.status);
      else if (row.kind === "ok") ok += 1;
      else inconclusive += 1;
    });
  }
  return { broken: broken, ok: ok, inconclusive: inconclusive };
}

async function main() {
  const counts = expectedProducts();
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  let report;
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:" + port + "/#/home", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(function () {
      return window.HuntAmazonRender && window.HuntAmazonRender.ready();
    }, null, { timeout: 30000 });
    report = await page.evaluate(function () { return window.HuntAmazonRender.audit(); });
  } finally {
    await browser.close();
    server.close();
  }

  if (report.problems.length) {
    console.error(report.problems.slice(0, 30).join("\n"));
  }
  assert(report.problems.length === 0, report.problems.length + " product views failed the Amazon link check");
  assert(report.disclosure, "footer disclosure is still on the page");
  assert(report.products === counts.total, "rendered " + report.products + " products, data has " + counts.total);
  assert(report.dp + report.search === report.products, "every product is either an exact /dp/ link or a search link");
  assert(report.calendar === counts.drops, "calendar entries were rendered");
  assert(report.videoGameDrops === 25, "video game calendar entries were rendered");
  assert(report.sections.games === 25, "video games category was rendered");
  ["pokemon", "magic", "onepiece", "lorcana", "yugioh", "sports", "sneakers", "designer", "lego", "funko", "apple", "consoles", "matchbox", "mattel", "games"].forEach(function (id) {
    assert(report.sections[id] > 0, "category " + id + " rendered");
  });
  assert(report.views > report.products, "detail, verdict, and calendar views were all rendered");

  const checked = await checkDp(report.dpUrls);
  assert(checked.broken.length === 0, "broken /dp/ links: " + checked.broken.join(", "));
  console.log("amazon-offers.test.js OK");
  console.log("products " + report.products + " dp " + report.dp + " search " + report.search + " views " + report.views);
  console.log("dp check ok " + checked.ok + " inconclusive " + checked.inconclusive + " broken " + checked.broken.length);
  console.log("catalog " + counts.catalog + " market " + counts.market + " golf " + counts.golf + " calendar " + counts.drops);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
