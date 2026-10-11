import { webkit, devices } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BPS = (4 * 1024 * 1024) / 8;
const RTT = 150;
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

let pipeAt = Date.now();
const started = new Map();

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function schedule(bytes) {
  const now = Date.now();
  const begin = Math.max(now, pipeAt);
  const transfer = Math.max(1, Math.ceil((bytes / BPS) * 1000));
  pipeAt = begin + transfer;
  return (begin - now) + RTT + transfer;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (url.pathname === "/") file = path.join(root, "index.html");
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end("missing");
    return;
  }
  const buf = fs.readFileSync(file);
  const delay = schedule(buf.length);
  const t0 = Date.now();
  started.set(url.pathname, (started.get(url.pathname) || 0) + buf.length);
  wait(delay).then(() => {
    if (res.destroyed) return;
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "Content-Length": buf.length,
    });
    res.end(buf);
    const mark = Date.now() - t0;
    if (buf.length > 80000) process.stdout.write("BIG " + url.pathname + " " + buf.length + " served in " + mark + "ms\n");
  });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port + "/";
const browser = await webkit.launch();
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();
page.setDefaultTimeout(90000);
const navAt = Date.now();
await page.goto(base, { waitUntil: "commit" });

async function stamp(label, locator) {
  await locator.waitFor({ timeout: 90000 });
  const perf = await page.evaluate(() => {
    const paint = performance.getEntriesByType("paint").find((entry) => entry.name === "first-contentful-paint");
    return { now: performance.now(), fcp: paint ? paint.startTime : null };
  });
  return { label, ms: Math.round(perf.now), fcp: perf.fcp == null ? null : Math.round(perf.fcp), wall: Date.now() - navAt };
}

function snapshotBytes() {
  const bytes = {};
  let total = 0;
  started.forEach((size, name) => {
    total += size;
    if (size > 20000) bytes[name] = size;
  });
  return { total, bytes };
}

const heading = await stamp("home-heading", page.getByRole("heading", { name: "What did you find?" }));
await page.locator('button.scan[data-action="scan"]').waitFor();
const ready = await stamp("interactive", page.locator(".drops-strip").getByText(/Matchbox/));
const atInteractive = snapshotBytes();
const clickAt = await page.evaluate(() => performance.now());
let catalogMs = null;
try {
  await page.getByRole("button", { name: "Full catalog" }).click();
  await page.locator(".hw-card .hw-photo img[src]").first().waitFor({ timeout: 90000 });
  catalogMs = Math.round(await page.evaluate(() => performance.now()));
} catch (err) {
  catalogMs = "timeout";
}
const atEnd = snapshotBytes();
const report = {
  profile: "4 Mbps down, 150ms RTT, shared pipe",
  fcp: heading.fcp,
  firstContentMs: heading.ms,
  interactiveMs: Math.round(clickAt),
  dropsVisibleMs: ready.ms,
  catalogFirstImageMs: catalogMs,
  bytesAtInteractive: atInteractive.total,
  bytesUntilEnd: atEnd.total,
  largeAtInteractive: atInteractive.bytes,
  large: atEnd.bytes,
};
console.log(JSON.stringify(report, null, 2));
await browser.close();
server.close();
