"use strict";

const fs = require("fs");
const path = require("path");
const Scan = require("../lib/scan.js");
const ZXing = require("../vendor/zxing.min.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const upc = "036000291452";
const ean = "0036000291452";

assert(Scan.FORMATS.join(",") === "upc_a,ean_13,code_128", "detector formats are UPC-A, EAN-13, and Code 128");
assert(Scan.cameraConstraints().video.facingMode === "environment", "camera asks for the back camera");
assert(Scan.cameraConstraints().audio === false, "camera does not request a microphone");
assert(Scan.cameraErrorKind({ name: "NotAllowedError" }) === "denied", "a denied prompt is permission denied");
assert(Scan.cameraErrorKind({ name: "PermissionDeniedError" }) === "denied", "older denied prompts stay permission denied");
assert(Scan.cameraErrorKind({ name: "NotFoundError" }) === "no-camera", "a missing device is no camera");
assert(Scan.cameraErrorKind({ name: "OverconstrainedError" }) === "no-camera", "an impossible camera request is no camera");
assert(Scan.cameraErrorKind({ name: "NotReadableError" }) === "busy", "a busy camera is named");
assert(Scan.MESSAGES.denied.indexOf("Camera permission was denied") === 0, "denied copy");
assert(Scan.MESSAGES["no-camera"].indexOf("No camera was found") === 0, "no-camera copy");
assert(Scan.MESSAGES.https.indexOf("HTTPS") !== -1, "https copy");

assert(Scan.normalize(upc).format === "upc_a" && Scan.normalize(upc).key === upc, "UPC-A normalizes");
assert(Scan.normalize("03600029145-2").key === upc, "spaces and dashes are ignored");
assert(Scan.normalize(ean).format === "ean_13", "EAN-13 normalizes");
assert(Scan.normalize("036000291453").error === "check", "a bad UPC check digit is rejected");
assert(Scan.normalize("JHX94").format === "code_128" && Scan.normalize("jhx94").key === "JHX94", "Code 128 keeps letters");
assert(Scan.normalize("ab") === null, "two letters are not a code");
assert(Scan.normalize("nope").format === "code_128", "a four-character token can be Code 128");
assert(Scan.sameCode(upc, ean), "EAN-13 with a leading zero is the same UPC-A");

const catalog = [
  { id: "cuda", name: "Gold Cuda", upc: upc, resale: { toyNo: "—" } },
  { id: "other", name: "Other", toy: "JHX94" },
];
const inventory = [
  { id: "inv-9", name: "Already scanned", barcode: ean },
];
const upcHits = Scan.match(Scan.normalize(upc), { catalog: catalog, inventory: inventory });
assert(upcHits.catalog.length === 1 && upcHits.catalog[0].id === "cuda", "UPC matches the catalog item");
assert(upcHits.inventory.length === 1 && upcHits.inventory[0].id === "inv-9", "the same code matches inventory stored as EAN-13");
const toyHits = Scan.match(Scan.normalize("JHX94"), { catalog: catalog, inventory: [] });
assert(toyHits.catalog.length === 1 && toyHits.catalog[0].id === "other", "Code 128 matches a stored toy number");
assert(Scan.normalize("012345678905").format === "upc_a", "012345678905 is a valid sample UPC");
assert(Scan.match(Scan.normalize("012345678905"), { catalog: catalog, inventory: inventory }).catalog.length === 0, "an unknown UPC stays off the list");

const image = Scan.renderUpcA(upc);
const decoded = Scan.decodeImageData(ZXing, { width: image.width, height: image.height, data: image.data });
assert(decoded && decoded.rawValue === upc && decoded.format === "upc_a", "ZXing reads the sample UPC-A");

const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const sw = fs.readFileSync(path.join(__dirname, "../sw.js"), "utf8");
const scanSrc = fs.readFileSync(path.join(__dirname, "../lib/scan.js"), "utf8");
assert(app.includes('loadScript("lib/scan.js")'), "scan helper loads when the scanner opens");
assert(!html.includes('src="lib/scan.js"'), "scan helper stays off the first paint");
assert(scanSrc.includes('facingMode: "environment"'), "camera asks for the back camera in the helper");
assert(app.includes("playsinline") && app.includes('setAttribute("muted"'), "the camera element is inline and muted");
assert(app.includes("BarcodeDetector") && app.includes("vendor/zxing.min.js"), "BarcodeDetector is preferred and ZXing is the fallback");
assert(app.includes("Scan.MESSAGES"), "denied permission and the other camera errors use the scan copy");
assert(app.includes("add-scan-code") && app.includes("data-scan-catalog"), "a scan can add a catalog match or an unknown code");
assert(sw.includes("reseller-shell-20261012q"), "service worker cache is bumped for the scanner");
assert(sw.includes("./lib/scan.js"), "scan helper is precached");
assert(!sw.includes("./vendor/zxing.min.js"), "zxing loads with the scanner, not the first install");

console.log("scan.test.js OK");
