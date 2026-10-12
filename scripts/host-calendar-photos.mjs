// Audit calendar and drop photos with a github.io referer.
// Self-host a WebP copy only when that host's robots.txt allows the fetch.
// Hotlink-only licenses (TCGplayer, Scryfall) stay remote. Logos are cleared
// so the app can show a category placeholder instead of a blank box.
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const REFERER = "https://barronstrikesgold-cyber.github.io/";
const UA = "HuntCalendar/1.0 (+https://barronstrikesgold-cyber.github.io/; photo audit)";
const OUT_DIR = path.join(root, "images", "hosted");

// Written licenses forbid rehosting these. A passing referer check keeps the hotlink.
const HOTLINK_ONLY = new Set([
  "tcgplayer-cdn.tcgplayer.com",
  "svgs.scryfall.io",
  "cards.scryfall.io",
  "c1.scryfall.io",
  "images.scrydex.com",
]);

function isLogo(src) {
  return /\/logo(?:\/|\?|$)/i.test(src) ||
    /(?:^|\/)logo\.(?:svg|png|jpe?g|webp)(?:\?|$)/i.test(src) ||
    /calendar-logos|_logo|logo[-_]|[-_/]logo[-_.]/i.test(src) ||
    /(?:^|\/)og\.(?:svg|png|jpe?g|webp)(?:\?|$)/i.test(src);
}

function request(url, redirects) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); } catch (err) { resolve({ status: 0, error: "bad-url" }); return; }
    const lib = parsed.protocol === "http:" ? http : https;
    const headers = {
      "User-Agent": UA,
      Accept: "image/webp,image/png,image/jpeg,image/gif,*/*",
      Referer: REFERER,
      "Sec-Fetch-Dest": "image",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "cross-site",
    };
    const req = lib.request({
      method: "GET",
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers,
      timeout: 20000,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const status = res.statusCode || 0;
        const loc = res.headers.location || "";
        if ([301, 302, 303, 307, 308].includes(status) && loc && redirects < 4) {
          const next = new URL(loc, url).toString();
          resolve(request(next, redirects + 1));
          return;
        }
        resolve({
          status,
          type: String(res.headers["content-type"] || ""),
          finalUrl: url,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on("error", (err) => resolve({ status: 0, error: err.message, body: Buffer.alloc(0), type: "" }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, error: "timeout", body: Buffer.alloc(0), type: "" }); });
    req.end();
  });
}

function textRequest(url) {
  return request(url, 0).then((res) => ({
    status: res.status,
    text: res.body ? res.body.toString("utf8") : "",
  }));
}

function robotsAllows(text, status, targetPath) {
  if (status === 404) return true;
  if (status !== 200) return false;
  const lines = String(text || "").split(/\r?\n/);
  let group = false;
  let star = false;
  const rules = [];
  function flush() {
    if (star) rules.push(...groupRules);
    groupRules = [];
  }
  let groupRules = [];
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const match = line.match(/^([^:]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (key === "user-agent") {
      if (group) flush();
      group = true;
      star = value === "*";
      continue;
    }
    if (!group || !star) continue;
    if (key === "allow" || key === "disallow") groupRules.push({ allow: key === "allow", path: value });
  }
  flush();
  let winner = null;
  for (const rule of rules) {
    if (!rule.path) continue;
    if (targetPath.startsWith(rule.path) || rule.path === "/") {
      if (!winner || rule.path.length > winner.path.length) winner = rule;
    }
  }
  if (!winner) return true;
  return winner.allow || winner.path === "";
}

const robotsCache = new Map();
async function hostAllowed(hostname, targetPath) {
  if (robotsCache.has(hostname)) {
    const cached = robotsCache.get(hostname);
    return robotsAllows(cached.text, cached.status, targetPath);
  }
  const res = await textRequest("https://" + hostname + "/robots.txt");
  robotsCache.set(hostname, res);
  return robotsAllows(res.text, res.status, targetPath);
}

function toWebp(buf, dest) {
  const py = [
    "import sys",
    "from PIL import Image",
    "import io",
    "data = sys.stdin.buffer.read()",
    "im = Image.open(io.BytesIO(data))",
    "im = im.convert('RGBA')",
    "im.thumbnail((720, 720))",
    "im.save(sys.argv[1], 'WEBP', quality=74, method=6)",
  ].join("\n");
  const run = spawnSync("python3", ["-c", py, dest], { input: buf, maxBuffer: 20 * 1024 * 1024 });
  return run.status === 0 && fs.existsSync(dest) && fs.statSync(dest).size > 800;
}

function collect(market, drops) {
  const rows = [];
  for (const section of market.sections || []) {
    for (const item of section.items || []) {
      rows.push({ item, where: "market", section: section.id });
    }
  }
  for (const item of drops) rows.push({ item, where: "drop", section: item.category || "drop" });
  return rows;
}

async function main() {
  const market = JSON.parse(fs.readFileSync(path.join(root, "data", "market.json"), "utf8"));
  const drops = JSON.parse(fs.readFileSync(path.join(root, "data", "drops.json"), "utf8"));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rows = collect(market, drops);
  const counts = {
    checkedAt: new Date().toISOString(),
    referer: REFERER,
    total: rows.length,
    localWebp: 0,
    localOther: 0,
    hosted: 0,
    hotlinkOk: 0,
    placeholder: 0,
    failed: 0,
    logoCleared: 0,
    skippedRobots: 0,
  };
  const failures = [];
  const hosted = [];

  for (const row of rows) {
    const src = String(row.item.photo || "").trim();
    if (!src) {
      counts.placeholder += 1;
      continue;
    }
    if (isLogo(src)) {
      row.item.photo = "";
      counts.logoCleared += 1;
      counts.placeholder += 1;
      continue;
    }
    if (!/^https?:\/\//i.test(src)) {
      const file = path.join(root, src);
      if (!fs.existsSync(file)) {
        counts.failed += 1;
        failures.push({ id: row.item.id, src, reason: "missing-local" });
        row.item.photo = "";
        counts.placeholder += 1;
        continue;
      }
      if (/\.webp$/i.test(src)) counts.localWebp += 1;
      else counts.localOther += 1;
      continue;
    }
    let host = "";
    let targetPath = "/";
    try {
      const parsed = new URL(src);
      host = parsed.hostname;
      targetPath = parsed.pathname;
    } catch (err) {
      row.item.photo = "";
      counts.placeholder += 1;
      counts.failed += 1;
      continue;
    }
    const probe = await request(src, 0);
    const imageOk = probe.status === 200 && /^image\//i.test(probe.type) && probe.body.length > 800;
    if (HOTLINK_ONLY.has(host)) {
      if (imageOk) counts.hotlinkOk += 1;
      else {
        row.item.photo = "";
        counts.placeholder += 1;
        counts.failed += 1;
        failures.push({ id: row.item.id, src, reason: "hotlink-" + (probe.status || probe.error || "bad") });
      }
      continue;
    }
    const finalHost = (() => { try { return new URL(probe.finalUrl || src).hostname; } catch (err) { return host; } })();
    const finalPath = (() => { try { return new URL(probe.finalUrl || src).pathname; } catch (err) { return targetPath; } })();
    const allowed = imageOk && await hostAllowed(finalHost, finalPath);
    if (imageOk && allowed) {
      const destRel = "images/hosted/" + row.item.id + ".webp";
      const dest = path.join(root, destRel);
      if (toWebp(probe.body, dest)) {
        row.item.photo = destRel;
        if (row.item.photoCredit) row.item.photoCredit = String(row.item.photoCredit).replace(/ · WebP copy of the official product image$/, "") + " · WebP copy of the official product image";
        counts.hosted += 1;
        hosted.push({ file: destRel, alt: row.item.photoAlt || row.item.name || "", source: probe.finalUrl || src, page: row.item.photoPage || "" });
        continue;
      }
    }
    if (!allowed && imageOk) counts.skippedRobots += 1;
    if (imageOk) {
      counts.hotlinkOk += 1;
      if (probe.finalUrl && probe.finalUrl !== src) row.item.photo = probe.finalUrl;
    } else {
      row.item.photo = "";
      counts.placeholder += 1;
      counts.failed += 1;
      failures.push({ id: row.item.id, src, reason: "fetch-" + (probe.status || probe.error || "bad") });
    }
  }

  fs.writeFileSync(path.join(root, "data", "market.json"), JSON.stringify(market, null, 2) + "\n");
  fs.writeFileSync(path.join(root, "data", "drops.json"), JSON.stringify(drops, null, 2) + "\n");

  const sourcesPath = path.join(root, "images", "SOURCES.json");
  const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
  const seen = new Set((sources.hosted || []).map((row) => row.file));
  for (const row of hosted) {
    if (seen.has(row.file)) continue;
    sources.hosted.push({
      file: row.file,
      alt: row.alt,
      source: "Official product image fetched with a github.io referer and saved as WebP because the host robots.txt allowed the image path.",
      page: row.page || row.source,
    });
  }
  fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2) + "\n");

  const summary = { ...counts, failures };
  fs.writeFileSync(path.join(root, "data", "calendar-image-audit.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(counts, null, 2));
  if (failures.length) console.log(failures.slice(0, 20));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
