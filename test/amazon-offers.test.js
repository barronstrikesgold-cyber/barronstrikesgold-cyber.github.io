"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");

function decode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function element(tag) {
  return {
    tagName: String(tag || "div").toUpperCase(),
    children: [],
    attrs: {},
    classList: {
      toggle: function () {},
      contains: function () { return false; },
      add: function () {},
      remove: function () {},
    },
    style: {},
    hidden: false,
    textContent: "",
    value: "",
    id: "",
    open: false,
    parentNode: null,
    listeners: {},
    src: "",
    setAttribute: function (key, value) {
      this.attrs[key] = String(value);
      if (key === "id") this.id = String(value);
    },
    getAttribute: function (key) {
      return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null;
    },
    removeAttribute: function (key) { delete this.attrs[key]; },
    appendChild: function (child) {
      child.parentNode = this;
      this.children.push(child);
      if (child.tagName === "SCRIPT" && child.src) runScript(child.src.replace(/^\.\//, ""));
      if (child.onload) child.onload();
      return child;
    },
    remove: function () {},
    replaceWith: function () {},
    addEventListener: function (type, fn) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(fn);
    },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    focus: function () {},
    setSelectionRange: function () {},
    closest: function () { return null; },
    innerHTML: "",
  };
}

const scripts = {};
const byId = {};
const tabs = ["home", "calendar", "catalog", "tracked", "account"].map(function (name) {
  const btn = element("button");
  btn.setAttribute("data-tab", name);
  return btn;
});
const meta = element("meta");
meta.setAttribute("name", "theme-color");
const body = element("body");
body.innerText = fs.readFileSync(path.join(root, "index.html"), "utf8");
const head = element("head");
const documentElement = element("html");

function getElementById(id) {
  if (!byId[id]) byId[id] = element("div");
  byId[id].id = id;
  return byId[id];
}

["screen", "sheet", "zoom", "status-live", "checked-line", "global-q", "header-back", "topbar", "update-banner", "apply-update"].forEach(getElementById);

const document = {
  documentElement: documentElement,
  body: body,
  head: head,
  visibilityState: "visible",
  readyState: "complete",
  activeElement: body,
  getElementById: getElementById,
  createElement: element,
  querySelector: function (sel) {
    const script = /^script\[src="([^"]+)"\]$/.exec(sel);
    if (script) return scripts[script[1]] || null;
    if (sel === 'meta[name="theme-color"]') return meta;
    return null;
  },
  querySelectorAll: function (sel) {
    if (sel === ".tabbar [data-tab]") return tabs;
    return [];
  },
  addEventListener: function () {},
};

const context = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  URL: URL,
  URLSearchParams: URLSearchParams,
  Date: Date,
  JSON: JSON,
  Math: Math,
  Object: Object,
  Array: Array,
  String: String,
  Number: Number,
  Boolean: Boolean,
  RegExp: RegExp,
  Error: Error,
  TypeError: TypeError,
  Promise: Promise,
  Map: Map,
  Set: Set,
  Intl: Intl,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  isFinite: isFinite,
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent,
  encodeURI: encodeURI,
  decodeURI: decodeURI,
  document: document,
  navigator: { onLine: true, userAgent: "node", standalone: false },
  location: { hash: "#/home", href: "http://127.0.0.1/#/home", reload: function () {} },
  history: {
    state: null,
    replaceState: function (state, title, url) { this.state = state; if (url) context.location.hash = url; },
    pushState: function (state, title, url) { this.state = state; if (url) context.location.hash = url; },
    back: function () {},
  },
  localStorage: {
    store: {},
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; },
    setItem: function (key, value) { this.store[key] = String(value); },
    removeItem: function (key) { delete this.store[key]; },
  },
  scrollY: 0,
  scrollTo: function () {},
  matchMedia: function () { return { matches: false, addEventListener: function () {} }; },
  fetch: function (url) {
    const rel = String(url).replace(/^\//, "").split("?")[0];
    const file = path.join(root, rel);
    const text = fs.readFileSync(file, "utf8");
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: function () { return null; } },
      json: function () { return Promise.resolve(JSON.parse(text)); },
      text: function () { return Promise.resolve(text); },
    });
  },
  DOMParser: function DOMParser() {},
  addEventListener: function () {},
  removeEventListener: function () {},
};
context.DOMParser.prototype.parseFromString = function (html) {
  const anchors = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(String(html || "")))) {
    const attrs = match[1];
    const href = /href="([^"]*)"/.exec(attrs);
    const rel = /rel="([^"]*)"/.exec(attrs);
    const text = match[2].replace(/<[^>]+>/g, "");
    anchors.push({
      getAttribute: function (name) {
        if (name === "href") return href ? decode(href[1]) : "";
        if (name === "rel") return rel ? rel[1] : "";
        return "";
      },
      textContent: decode(text),
    });
  }
  return {
    querySelectorAll: function (sel) { return sel === "a" ? anchors : []; },
  };
};
context.window = context;
context.globalThis = context;
context.self = context;
vm.createContext(context);

function runScript(rel) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), context, { filename: rel });
}

const savedAppend = head.appendChild;
head.appendChild = function (child) {
  if (child && child.tagName === "SCRIPT" && child.src) scripts[child.src] = child;
  return savedAppend.call(head, child);
};

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
        return { url: url, status: 0, kind: "inconclusive" };
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

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function main() {
  [
    "lib/dates.js",
    "lib/resale-cards.js",
    "lib/rules.js",
    "lib/hunt-drops.js",
    "lib/flow.js",
    "lib/amazon.js",
    "lib/market.js",
    "app.js",
  ].forEach(runScript);

  let report = null;
  for (let i = 0; i < 80; i++) {
    if (context.HuntAmazonRender && context.HuntAmazonRender.ready()) {
      report = context.HuntAmazonRender.audit();
      break;
    }
    await sleep(25);
  }
  assert(report, "the app did not finish rendering its product data");

  if (report.problems.length) console.error(report.problems.slice(0, 30).join("\n"));
  const counts = expectedProducts();
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
