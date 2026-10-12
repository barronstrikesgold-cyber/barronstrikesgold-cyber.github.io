import { webkit, devices } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = "/opt/cursor/artifacts/screenshots/scan";
fs.mkdirSync(shots, { recursive: true });
const sample = "036000291452";

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
const browser = await webkit.launch();
const iphone = devices["iPhone 13"];
const results = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function boot(mode) {
  const context = await browser.newContext({ ...iphone });
  await context.addInitScript((cameraMode) => {
    // This Playwright WebKit build crashes if a real MediaStream is assigned to
    // video.srcObject. The fake feed still has the sample UPC pixels: the video
    // element reports that frame, and drawImage paints it for the decoder.
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
    navigator.mediaDevices.getUserMedia = function (constraints) {
      window.__gum = window.__gum || [];
      window.__gum.push(constraints);
      if (cameraMode === "denied") {
        const err = new DOMException("Permission denied", "NotAllowedError");
        return Promise.reject(err);
      }
      if (cameraMode === "none") {
        const err = new DOMException("No camera", "NotFoundError");
        return Promise.reject(err);
      }
      const rendered = window.ResellerScan.renderUpcA("036000291452", 3, 120, 11);
      return Promise.resolve({
        __frame: rendered,
        getTracks() { return [{ stop() {} }]; },
        getVideoTracks() { return [{ stop() {} }]; },
      });
    };
    if (cameraMode === "detector") {
      window.BarcodeDetector = class {
        constructor(opts) {
          window.__detectorFormats = (opts && opts.formats) || [];
        }
        detect(source) {
          window.__detectCalls = (window.__detectCalls || 0) + 1;
          if (!source || !source.videoWidth) return Promise.resolve([]);
          return Promise.resolve([{ rawValue: "036000291452", format: "upc_a" }]);
        }
      };
    }
  }, mode);
  const page = await context.newPage();
  page.on("pageerror", (err) => console.error("PAGE", err.message));
  page.setDefaultTimeout(20000);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "What did you find?" }).waitFor();
  return { context, page };
}

async function openScanner(page) {
  await page.locator('button.scan[data-action="scan"]').click();
  await page.locator("#scan-q").waitFor();
}

try {
  const zxing = await boot("camera");
  await openScanner(zxing.page);
  const preview = await zxing.page.locator("#scan-video").evaluate((el) => ({
    playsInline: el.hasAttribute("playsinline") || el.playsInline === true,
    muted: el.muted === true || el.hasAttribute("muted"),
    hidden: el.hidden,
  }));
  assert(preview.playsInline && preview.muted, "preview is playsinline and muted");
  await zxing.page.getByRole("heading", { name: "Gold '70 AAR Cuda Super" }).waitFor({ timeout: 20000 });
  const detail = await zxing.page.locator("#screen").innerText();
  assert(detail.includes("Code · " + sample), "decoded UPC was stored on the inventory row");
  const gum = await zxing.page.evaluate(() => window.__gum);
  assert(gum && gum[0] && gum[0].audio === false, "camera request has no microphone");
  assert(gum[0].video && gum[0].video.facingMode === "environment", "first camera request uses the back camera");
  const detectorKind = await zxing.page.evaluate(() => typeof window.BarcodeDetector);
  assert(detectorKind === "undefined", "this WebKit build has no native BarcodeDetector, saw " + detectorKind);
  await zxing.page.screenshot({ path: path.join(shots, "zxing-upc-detail.png") });
  results.push({ name: "zxing-fake-camera", ok: true, code: sample, facingMode: gum[0].video.facingMode, playsInline: preview.playsInline, muted: preview.muted });
  await zxing.context.close();

  const detector = await boot("detector");
  await openScanner(detector.page);
  await detector.page.getByRole("heading", { name: "Gold '70 AAR Cuda Super" }).waitFor({ timeout: 15000 });
  const formats = await detector.page.evaluate(() => window.__detectorFormats);
  assert(formats.indexOf("upc_a") !== -1 && formats.indexOf("ean_13") !== -1 && formats.indexOf("code_128") !== -1, "BarcodeDetector was asked for UPC-A, EAN-13, and Code 128");
  const calls = await detector.page.evaluate(() => window.__detectCalls);
  assert(calls >= 1, "BarcodeDetector.detect saw the camera frame");
  await detector.page.screenshot({ path: path.join(shots, "barcode-detector-detail.png") });
  results.push({ name: "barcode-detector", ok: true, formats: formats, detectCalls: calls });
  await detector.context.close();

  const denied = await boot("denied");
  await openScanner(denied.page);
  await denied.page.locator("#scan-msg.is-error").waitFor();
  const deniedText = await denied.page.locator("#scan-msg").innerText();
  assert(deniedText.startsWith("Camera permission was denied"), "denied permission copy: " + deniedText);
  assert(await denied.page.locator("#scan-video").isHidden(), "the preview is hidden when permission is denied");
  await denied.page.screenshot({ path: path.join(shots, "permission-denied.png") });
  await denied.page.locator("#scan-q").fill(sample);
  await denied.page.locator("#scan-form button").click();
  await denied.page.getByRole("heading", { name: "Gold '70 AAR Cuda Super" }).waitFor();
  assert((await denied.page.locator("#screen").innerText()).includes("Code · " + sample), "typed UPC matched the catalog and was added");
  results.push({ name: "permission-denied-then-manual", ok: true, message: deniedText });
  await denied.context.close();

  const missing = await boot("none");
  await openScanner(missing.page);
  await missing.page.locator("#scan-msg.is-error").waitFor();
  const missingText = await missing.page.locator("#scan-msg").innerText();
  assert(missingText.startsWith("No camera was found"), "no-camera copy: " + missingText);
  await missing.page.screenshot({ path: path.join(shots, "no-camera.png") });
  results.push({ name: "no-camera", ok: true, message: missingText });
  await missing.context.close();

  console.log(JSON.stringify({ ok: true, results: results }, null, 2));
} catch (err) {
  console.error("SCAN WEBKIT FAIL");
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
