#!/usr/bin/env node
/**
 * Check every Hot Wheels catalog image with a GitHub Pages referrer.
 * Fandom answers that referrer with a 404 placeholder. Those files are
 * downloaded without a referrer, resized, and stored as small WebP thumbs.
 * Shopify CDN images that already return 200 stay hotlinked over https.
 *
 *   node scripts/host-hw-thumbs.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const hwDir = path.join(root, "data", "hw");
const thumbRoot = path.join(root, "assets", "hw", "thumbs");
const progressFile = "/tmp/hw-thumb-progress.json";
const REFERER = "https://barronstrikesgold-cyber.github.io/";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const CONCURRENCY = 10;

function loadProgress() {
  if (!fs.existsSync(progressFile)) return {};
  return JSON.parse(fs.readFileSync(progressFile, "utf8"));
}

function saveProgress(progress) {
  fs.writeFileSync(progressFile, JSON.stringify(progress));
}

function yearFiles() {
  return fs.readdirSync(hwDir).filter((name) => /^\d{4}\.json$/.test(name)).sort();
}

function collect() {
  const urls = new Map();
  const files = [];
  for (const name of yearFiles()) {
    const file = path.join(hwDir, name);
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    files.push({ file, data });
    for (const item of data.items || []) {
      if (!item.image || !/^https:\/\//.test(item.image)) continue;
      if (!urls.has(item.image)) urls.set(item.image, 0);
      urls.set(item.image, urls.get(item.image) + 1);
    }
  }
  return { urls, files };
}

async function fetchImage(url, referer) {
  const headers = {
    "User-Agent": SAFARI,
    Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
  };
  if (referer) headers.Referer = referer;
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(25000) });
      if (res.status === 429 || res.status >= 500) {
        last = new Error(res.status + " " + url);
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const type = res.headers.get("content-type") || "";
      const ok = res.status === 200 && type.startsWith("image/");
      return { status: res.status, type, size: buf.length, ok, buf: ok ? buf : null };
    } catch (err) {
      last = err;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  throw last;
}

function startConverter() {
  const py = spawn("python3", [path.join(root, "scripts", "webp-thumb.py")], { stdio: ["pipe", "pipe", "inherit"] });
  let buffer = "";
  const pending = new Map();
  py.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      const job = pending.get(msg.id);
      if (!job) continue;
      pending.delete(msg.id);
      if (msg.ok) job.resolve(Buffer.from(msg.b64, "base64"));
      else job.reject(new Error(msg.error || "webp failed"));
    }
  });
  let seq = 0;
  return {
    convert(buf) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("webp timeout"));
        }, 20000);
        pending.set(id, {
          resolve(value) {
            clearTimeout(timer);
            resolve(value);
          },
          reject(err) {
            clearTimeout(timer);
            reject(err);
          },
        });
        py.stdin.write(JSON.stringify({ id, b64: buf.toString("base64") }) + "\n");
      });
    },
    close() {
      py.stdin.end();
    },
  };
}

function thumbPath(url) {
  const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 20);
  return path.join("assets", "hw", "thumbs", hash.slice(0, 2), hash + ".webp");
}

async function pool(items, limit, worker) {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

async function main() {
  const { urls, files } = collect();
  const progress = loadProgress();
  const converter = startConverter();
  const list = [...urls.keys()];
  let done = 0;
  fs.mkdirSync(thumbRoot, { recursive: true });
  process.stdout.write("unique https images " + list.length + "\n");

  await pool(list, CONCURRENCY, async (url) => {
    if (!progress[url]) {
      let before;
      try {
        before = await fetchImage(url, REFERER);
      } catch (err) {
        before = { status: 0, type: "", size: 0, ok: false, buf: null };
      }
      const host = new URL(url).host;
      const blocked = host.includes("wikia") || host.includes("fandom") || !before.ok;
      if (!blocked && before.ok) {
        progress[url] = { before: true, status: before.status, action: "remote" };
      } else {
        let fresh = null;
        try {
          fresh = await fetchImage(url, "");
        } catch (err) {
          fresh = null;
        }
        if (fresh && fresh.ok && fresh.buf) {
          try {
            const webp = await converter.convert(fresh.buf);
            const rel = thumbPath(url);
            const abs = path.join(root, rel);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, webp);
            progress[url] = { before: Boolean(before.ok), status: before.status, action: "hosted", path: rel, bytes: webp.length };
          } catch (err) {
            progress[url] = { before: Boolean(before.ok), status: before.status, action: "cleared", error: String(err.message || err).slice(0, 120) };
          }
        } else {
          progress[url] = { before: Boolean(before.ok), status: before.status, action: "cleared", fetched: fresh ? fresh.status : 0 };
        }
      }
    }
    done += 1;
    if (done % 200 === 0) {
      saveProgress(progress);
      process.stdout.write("checked " + done + "/" + list.length + "\n");
    }
  });
  converter.close();
  saveProgress(progress);

  let itemBefore = 0;
  let itemAfter = 0;
  let itemImages = 0;
  const actions = { remote: 0, hosted: 0, cleared: 0 };
  for (const row of Object.values(progress)) actions[row.action] = (actions[row.action] || 0) + 1;

  for (const entry of files) {
    let photos = 0;
    for (const item of entry.data.items || []) {
      if (!item.image) continue;
      if (!/^https:\/\//.test(item.image)) {
        itemImages += 1;
        if (fs.existsSync(path.join(root, item.image))) {
          itemAfter += 1;
          photos += 1;
        }
        continue;
      }
      itemImages += 1;
      const row = progress[item.image];
      if (row && row.before) itemBefore += 1;
      if (!row || row.action === "cleared") {
        item.image = "";
        continue;
      }
      if (row.action === "hosted") item.image = row.path;
      if (row.action === "remote" && !/^https:\/\//.test(item.image)) item.image = "";
      if (item.image && (row.action === "remote" || fs.existsSync(path.join(root, item.image)))) {
        itemAfter += 1;
        photos += 1;
      }
    }
    entry.data.photos = photos;
    fs.writeFileSync(entry.file, JSON.stringify(entry.data));
  }

  const manifestPath = path.join(hwDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let photos = 0;
  let count = 0;
  manifest.years.forEach((row) => {
    const file = files.find((entry) => entry.file.endsWith("/" + row.year + ".json") || entry.file.endsWith(row.file));
    const data = file ? file.data : JSON.parse(fs.readFileSync(path.join(root, row.file), "utf8"));
    const yearPhotos = (data.items || []).filter((item) => item.image).length;
    row.photos = yearPhotos;
    photos += yearPhotos;
    count += (data.items || []).length;
  });
  manifest.totals.photos = photos;
  manifest.totals.photoPct = Math.round((photos / count) * 1000) / 10;
  manifest.phase = "1968–2026 Hot Wheels Wiki year lists. Wiki photos that Fandom blocks from GitHub Pages are stored as small WebP thumbs. Mattel Creations photos stay on the Shopify CDN over https.";
  manifest.attribution = "Release tables: Hot Wheels Wiki (Fandom), CC BY-SA. Official photos: Mattel Creations CDN, hotlinked over https. Wiki photos: small WebP thumbs hosted with this site, with a link to the wiki file page.";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  const summary = {
    unique: list.length,
    itemImages,
    itemBefore,
    itemAfter,
    actions,
    photos: manifest.totals.photos,
    photoPct: manifest.totals.photoPct,
  };
  fs.writeFileSync(path.join(hwDir, "thumb-report.json"), JSON.stringify(summary, null, 2) + "\n");
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
