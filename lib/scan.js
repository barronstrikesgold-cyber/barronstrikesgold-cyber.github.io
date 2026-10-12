(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResellerScan = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var FORMATS = ["upc_a", "ean_13", "code_128"];
  var MESSAGES = {
    denied: "Camera permission was denied. Allow the camera for this site in Settings, or type the code.",
    "no-camera": "No camera was found on this device. Type the code.",
    https: "The camera needs a secure HTTPS page. Type the code.",
    busy: "The camera is in use by another app. Close it, or type the code.",
    "no-detector": "This browser could not read a barcode from the camera. Type the code.",
    check: "That check digit does not match a UPC-A or EAN-13. Type the code again.",
    shape: "Type a UPC-A, EAN-13, or Code 128.",
    miss: "No catalog or inventory item has this code.",
  };
  var CODE_FIELDS = ["upc", "barcode", "ean", "gtin", "sku", "code", "toy", "toyNo"];
  var LEFT = {
    0: "0001101",
    1: "0011001",
    2: "0010011",
    3: "0111101",
    4: "0100011",
    5: "0110001",
    6: "0101111",
    7: "0111011",
    8: "0110111",
    9: "0001011",
  };

  function cameraConstraints() {
    return { audio: false, video: { facingMode: "environment" } };
  }

  function fallbackConstraints() {
    return { audio: false, video: true };
  }

  function cameraErrorKind(err) {
    var name = err && err.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "denied";
    if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
    if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "no-camera";
    return "no-camera";
  }

  function checkDigit(body, tripleOnEvenIndex) {
    var sum = 0;
    for (var i = 0; i < body.length; i++) {
      var n = body.charCodeAt(i) - 48;
      var triple = tripleOnEvenIndex ? i % 2 === 0 : i % 2 === 1;
      sum += triple ? n * 3 : n;
    }
    return String((10 - (sum % 10)) % 10);
  }

  function normalize(value) {
    var raw = String(value == null ? "" : value).trim();
    if (!raw) return null;
    var compact = raw.replace(/[\s-]/g, "");
    if (/^\d{12}$/.test(compact)) {
      if (checkDigit(compact.slice(0, 11), true) !== compact.charAt(11)) return { error: "check" };
      return { key: compact, format: "upc_a" };
    }
    if (/^\d{13}$/.test(compact)) {
      if (checkDigit(compact.slice(0, 12), false) !== compact.charAt(12)) return { error: "check" };
      return { key: compact, format: "ean_13" };
    }
    if (/^[\x21-\x7E]{4,48}$/.test(compact) && !/^\d{12}$/.test(compact) && !/^\d{13}$/.test(compact)) {
      if (/^\d+$/.test(compact) || /[A-Za-z]/.test(compact)) {
        return { key: /^\d+$/.test(compact) ? compact : compact.toUpperCase(), format: "code_128" };
      }
    }
    return null;
  }

  function sameCode(left, right) {
    var a = String(left == null ? "" : left).replace(/[\s-]/g, "");
    var b = String(right == null ? "" : right).replace(/[\s-]/g, "");
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.toUpperCase() === b.toUpperCase()) return true;
    if (/^\d{12}$/.test(a) && b === "0" + a) return true;
    if (/^\d{12}$/.test(b) && a === "0" + b) return true;
    return false;
  }

  function pushCode(out, value) {
    if (value == null) return;
    var text = String(value).trim();
    if (!text || text === "—" || text === "-" || text === "–") return;
    out.push(text);
  }

  function itemCodes(item) {
    var out = [];
    if (!item || typeof item !== "object") return out;
    CODE_FIELDS.forEach(function (key) {
      pushCode(out, item[key]);
    });
    if (item.resale) pushCode(out, item.resale.toyNo);
    ["upcs", "barcodes", "codes"].forEach(function (key) {
      if (Array.isArray(item[key])) item[key].forEach(function (value) { pushCode(out, value); });
    });
    return out;
  }

  function match(parsed, sources) {
    var catalogHits = [];
    var inventoryHits = [];
    if (!parsed || parsed.error || !parsed.key) return { catalog: catalogHits, inventory: inventoryHits };
    (sources && sources.catalog || []).forEach(function (item) {
      if (itemCodes(item).some(function (code) { return sameCode(code, parsed.key); })) catalogHits.push(item);
    });
    (sources && sources.inventory || []).forEach(function (item) {
      if (itemCodes(item).some(function (code) { return sameCode(code, parsed.key); })) inventoryHits.push(item);
    });
    return { catalog: catalogHits, inventory: inventoryHits };
  }

  function decodeImageData(zxing, imageData) {
    if (!zxing || !imageData || !imageData.data) return null;
    var width = imageData.width;
    var height = imageData.height;
    var src = imageData.data;
    var lum = src.length === width * height ? src : new Uint8ClampedArray(width * height);
    if (lum !== src) {
      for (var i = 0, j = 0; i < src.length; i += 4, j++) {
        lum[j] = (src[i] + (src[i + 1] << 1) + src[i + 2]) >> 2;
      }
    }
    var hints = new Map();
    hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
      zxing.BarcodeFormat.UPC_A,
      zxing.BarcodeFormat.EAN_13,
      zxing.BarcodeFormat.CODE_128,
    ]);
    hints.set(zxing.DecodeHintType.TRY_HARDER, true);
    var reader = new zxing.MultiFormatReader();
    reader.setHints(hints);
    try {
      var result = reader.decode(new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(lum, width, height))));
      var format = result.getBarcodeFormat();
      var name = format === zxing.BarcodeFormat.UPC_A ? "upc_a" : format === zxing.BarcodeFormat.EAN_13 ? "ean_13" : format === zxing.BarcodeFormat.CODE_128 ? "code_128" : "";
      if (!name) return null;
      return { rawValue: result.getText(), format: name };
    } catch (err) {
      return null;
    }
  }

  function rightBits(pattern) {
    return pattern.replace(/0/g, "x").replace(/1/g, "0").replace(/x/g, "1");
  }

  function upcABits(code) {
    var bits = "101";
    var i;
    for (i = 0; i < 6; i++) bits += LEFT[code.charAt(i)];
    bits += "01010";
    for (i = 6; i < 12; i++) bits += rightBits(LEFT[code.charAt(i)]);
    return bits + "101";
  }

  function renderUpcA(code, module, barHeight, quiet) {
    var pattern = upcABits(code);
    var mod = module || 3;
    var height = barHeight || 120;
    var pad = quiet == null ? 11 : quiet;
    var width = (pattern.length + pad * 2) * mod;
    var data = new Uint8ClampedArray(width * height * 4);
    var y;
    var x;
    for (y = 0; y < height; y++) {
      for (x = 0; x < width; x++) {
        var index = Math.floor(x / mod) - pad;
        var black = index >= 0 && index < pattern.length && pattern.charAt(index) === "1";
        var offset = (y * width + x) * 4;
        var shade = black ? 0 : 255;
        data[offset] = shade;
        data[offset + 1] = shade;
        data[offset + 2] = shade;
        data[offset + 3] = 255;
      }
    }
    return { width: width, height: height, data: data };
  }

  return {
    FORMATS: FORMATS,
    MESSAGES: MESSAGES,
    cameraConstraints: cameraConstraints,
    fallbackConstraints: fallbackConstraints,
    cameraErrorKind: cameraErrorKind,
    normalize: normalize,
    sameCode: sameCode,
    itemCodes: itemCodes,
    match: match,
    decodeImageData: decodeImageData,
    renderUpcA: renderUpcA,
  };
});
