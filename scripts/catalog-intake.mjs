/* Shared-catalog intake. The app's "Suggest for the shared Hunt catalog" link opens a prefilled GitHub issue
 * (label catalog-add) with a JSON block: { name, upc, codes, brand, lane, line, year, imageUrl, sourceUrl, source }.
 * The owner submits it. .github/workflows/catalog-intake.yml runs this script (daily + when an issue is opened):
 * it re-runs the web lookup and adds an entry to data/catalog-learned.json ONLY when it verifies:
 *   - a photo URL (https) that answers with an image, and a source URL (https), always;
 *   - a UPC: the keyless web lookup (barcode.report and friends) must know it and name the same product;
 *     shared assortment UPCs (one UPC per case) are refused, they cannot name one item;
 *   - a card number like 158/128: the Pokémon TCG API must list a card with that number and name;
 *   - otherwise: the source page must answer and mention the code or the name.
 * Only issues opened by the repository owner are read. No secrets beyond the workflow's own GITHUB_TOKEN. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const U = require(path.join(root, "lib/upc-lookup.js"));
export const LEARNED = path.join(root, "data/catalog-learned.json");
export const ASSORT = JSON.parse(fs.readFileSync(path.join(root, "data/upc/assortments.json"), "utf8"));
const STOP = new Set(["THE", "AND", "FOR", "WITH", "NEW", "HOT", "WHEELS", "POKEMON", "POKÉMON", "CARD", "TOY", "SET", "PACK", "EDITION"]);

export function parseIssue(issue, owner) {
  if (!issue || issue.pull_request) return { ok: false, why: "not an issue" };
  const login = issue.user && issue.user.login;
  if (!owner || String(login).toLowerCase() !== String(owner).toLowerCase()) return { ok: false, why: "only the repository owner can add to the catalog" };
  const m = /```json\s*([\s\S]*?)```/.exec(issue.body || "");
  if (!m) return { ok: false, why: "no JSON block" };
  let e;
  try { e = JSON.parse(m[1]); } catch (err) { return { ok: false, why: "the JSON block does not parse" }; }
  const clean = {
    name: String(e.name || "").trim().slice(0, 140),
    upc: String(e.upc || "").replace(/\D/g, ""),
    codes: (Array.isArray(e.codes) ? e.codes : []).map((c) => String(c).trim().toUpperCase()).filter(Boolean).slice(0, 4),
    brand: String(e.brand || "").slice(0, 60),
    lane: /^[a-z-]{2,20}$/.test(e.lane || "") ? e.lane : "other",
    line: String(e.line || "").slice(0, 80),
    year: /^\d{4}$/.test(String(e.year || "")) ? String(e.year) : "",
    imageUrl: String(e.imageUrl || ""),
    sourceUrl: String(e.sourceUrl || ""),
    source: String(e.source || "").slice(0, 60),
  };
  if (!clean.name) return { ok: false, why: "no name" };
  return { ok: true, entry: clean };
}

function words(s) {
  return String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^A-Z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
}

export function sameProduct(a, b) {
  const wa = words(a);
  const wb = new Set(words(b));
  if (!wa.length) return false;
  const hit = wa.filter((w) => wb.has(w)).length;
  return hit >= Math.min(2, wa.length) || hit / wa.length >= 0.5;
}

async function get(fetchFn, url, accept) {
  try {
    const res = await fetchFn(url, { headers: { Accept: accept || "*/*", "User-Agent": "HuntCatalogIntake/1.0 (+github.com/barronstrikesgold-cyber)" }, redirect: "follow" });
    return res;
  } catch (err) {
    return null;
  }
}

/* -> { ok, why, transient, entry } */
export async function verifyEntry(entry, fetchFn) {
  const f = fetchFn || fetch;
  const e = Object.assign({}, entry);
  if (!/^https:\/\//.test(e.imageUrl)) return { ok: false, why: "no https photo URL" };
  if (!/^https:\/\//.test(e.sourceUrl)) return { ok: false, why: "no https source URL" };
  const img = await get(f, e.imageUrl, "image/*");
  if (!img) return { ok: false, transient: true, why: "the photo did not answer" };
  if (!img.ok || !/^image\//i.test(img.headers.get("content-type") || "")) return { ok: false, why: "the photo URL is not an image (" + img.status + ")" };
  if (e.upc) {
    if (!U.gtin14(e.upc)) return { ok: false, why: "the UPC check digit is wrong" };
    if (U.assortKeyOf && U.assortKeyOf(ASSORT, e.upc)) return { ok: false, why: "this UPC covers a whole assortment case, so it cannot name one item" };
    const out = await U.lookup(e.upc, { fetch: f, timeoutMs: 10000 });
    if (!out.result) {
      const offline = out.tried.length && out.tried.every((t) => t.status === "offline" || t.status === "timeout");
      return { ok: false, transient: !!offline, why: "no public product database knows UPC " + e.upc };
    }
    if (!sameProduct(e.name, out.result.title)) return { ok: false, why: "the web names UPC " + e.upc + " \"" + out.result.title + "\", not \"" + e.name + "\"" };
    e.upc = U.shortForm(e.upc) || e.upc;
    e.verifiedBy = out.result.sourceName || "web lookup";
    return { ok: true, entry: e };
  }
  const card = e.codes.map((c) => /^(\d{1,3})\/(\d{2,3})$/.exec(c)).filter(Boolean)[0];
  if (card) {
    const q = "number:" + Number(card[1]) + " set.printedTotal:" + Number(card[2]);
    const res = await get(f, "https://api.pokemontcg.io/v2/cards?q=" + encodeURIComponent(q) + "&select=id,name,number,set", "application/json");
    if (res && res.ok) {
      const json = await res.json().catch(() => ({}));
      const hit = (json.data || []).find((c) => sameProduct(c.name, e.name));
      if (!hit) return { ok: false, why: "no card " + card[0] + " named like \"" + e.name + "\"" };
      e.verifiedBy = "Pokémon TCG API (" + hit.id + ")";
      return { ok: true, entry: e };
    }
    /* the Pokémon TCG API is busy: TCGdex, matching number, name, and the set's printed total */
    const list = await get(f, "https://api.tcgdex.net/v2/en/cards?localId=" + Number(card[1]), "application/json");
    if (!list || !list.ok) return { ok: false, transient: true, why: "the card databases did not answer" };
    const cards = ((await list.json().catch(() => [])) || []).filter((c) => sameProduct(c.name, e.name)).slice(0, 4);
    for (const c of cards) {
      const d = await get(f, "https://api.tcgdex.net/v2/en/cards/" + encodeURIComponent(c.id), "application/json");
      const dj = d && d.ok ? await d.json().catch(() => null) : null;
      if (dj && dj.set && dj.set.cardCount && Number(dj.set.cardCount.official) === Number(card[2])) {
        e.verifiedBy = "TCGdex (" + c.id + ")";
        return { ok: true, entry: e };
      }
    }
    return { ok: false, why: "no card " + card[0] + " named like \"" + e.name + "\"" };
  }
  const page = await get(f, e.sourceUrl, "text/html,application/json");
  if (!page) return { ok: false, transient: true, why: "the source page did not answer" };
  if (!page.ok) return { ok: false, why: "the source page answered " + page.status };
  const text = (await page.text().catch(() => "")).toUpperCase();
  const mentionsCode = e.codes.some((c) => c.length >= 4 && text.includes(c));
  if (!mentionsCode && !sameProduct(e.name, text.slice(0, 400000))) return { ok: false, why: "the source page does not mention the code or the name" };
  e.verifiedBy = "source page";
  return { ok: true, entry: e };
}

function slug(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

/* add or refresh by UPC / code / name; returns { json, added } */
export function mergeLearned(json, entry, at) {
  const out = { note: json.note || "", items: (json.items || []).slice() };
  const same = (x) => (entry.upc && x.upc === entry.upc) || (entry.codes.length && (x.codes || []).some((c) => entry.codes.includes(c))) || slug(x.name) === slug(entry.name);
  const i = out.items.findIndex(same);
  const row = Object.assign({ id: slug(entry.name) + (entry.upc ? "-" + entry.upc.slice(-6) : "") }, entry, { added: at || new Date().toISOString().slice(0, 10) });
  if (i >= 0) { row.id = out.items[i].id; out.items[i] = row; } else out.items.push(row);
  out.items.sort((a, b) => a.id.localeCompare(b.id));
  return { json: out, added: i < 0 };
}

async function gh(method, url, body) {
  const res = await fetch("https://api.github.com" + url, {
    method,
    headers: { Authorization: "Bearer " + process.env.GITHUB_TOKEN, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(method + " " + url + " -> " + res.status);
  return res.status === 204 ? null : res.json();
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo || !process.env.GITHUB_TOKEN) { console.log("catalog-intake: GITHUB_REPOSITORY and GITHUB_TOKEN are needed (the workflow provides them)."); return; }
  const owner = repo.split("/")[0];
  /* the app's prefilled link applies label catalog-add only if it exists */
  await gh("POST", "/repos/" + repo + "/labels", { name: "catalog-add", color: "0e8a16", description: "Hunt: owner-confirmed find for the shared catalog" }).catch(() => {});
  const issues = await gh("GET", "/repos/" + repo + "/issues?state=open&labels=catalog-add&per_page=50");
  let json = fs.existsSync(LEARNED) ? JSON.parse(fs.readFileSync(LEARNED, "utf8")) : { items: [] };
  let changed = 0;
  for (const issue of issues) {
    const p = parseIssue(issue, owner);
    if (!p.ok) {
      if (/owner/.test(p.why)) continue;
      await gh("POST", "/repos/" + repo + "/issues/" + issue.number + "/comments", { body: "Catalog intake: " + p.why + ". Fix the JSON block and reopen." });
      await gh("PATCH", "/repos/" + repo + "/issues/" + issue.number, { state: "closed", state_reason: "not_planned" });
      continue;
    }
    const v = await verifyEntry(p.entry);
    if (!v.ok && v.transient) { console.log("#" + issue.number + " retry later: " + v.why); continue; }
    if (!v.ok) {
      await gh("POST", "/repos/" + repo + "/issues/" + issue.number + "/comments", { body: "Catalog intake could not verify this, so nothing was added: " + v.why + ". Hunt only adds entries whose source and photo check out." });
      await gh("PATCH", "/repos/" + repo + "/issues/" + issue.number, { state: "closed", state_reason: "not_planned" });
      continue;
    }
    const m = mergeLearned(json, v.entry);
    json = m.json;
    changed += 1;
    await gh("POST", "/repos/" + repo + "/issues/" + issue.number + "/comments", { body: "Verified by " + v.entry.verifiedBy + " and " + (m.added ? "added to" : "updated in") + " data/catalog-learned.json. It ships with the next commit from this workflow." });
    await gh("PATCH", "/repos/" + repo + "/issues/" + issue.number, { state: "closed", state_reason: "completed" });
  }
  if (changed) fs.writeFileSync(LEARNED, JSON.stringify(json, null, 2) + "\n");
  console.log("catalog-intake: " + issues.length + " open, " + changed + " verified");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
