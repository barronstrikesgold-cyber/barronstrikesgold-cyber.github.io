import assert from "node:assert";
import {
  parseSneakerCalendar,
  applyOfficialSneakerNotes,
  windowRows,
  designerPrograms,
  brandOf,
  isKidsSize,
  countByBrand,
  addDays,
  WATCHED_WITHOUT_DATES,
} from "../scripts/fashion-calendar.mjs";

const html = `
<section id="seo-hub-links">
  <h3>Tuesday, October 13</h3>
  <ul>
    <li><a href="/release/nike/nike-cryoshot/IQ8161-001">Nike Cryoshot Mercurial Vapor 1 OG — Chrome</a> · IQ8161-001 · Oct 13, 10:00 AM ET · $200 · SNKRS app</li>
    <li><a href="/release/nike/gs-ja/IM7569-900">GS Ja 4 Nightmare</a> · IM7569-900 · Oct 13, 10:00 AM ET · $115</li>
    <li><a href="/release/adidas/samba/HP8256">SAMBA OG SFTM Shoes</a> · HP8256 · Oct 13, 10:00 AM ET · $130</li>
    <li><a href="/release/puma/mb/313623_01">PUMA MB.06 Hills</a> · 313623_01 · Oct 13 · $130</li>
  </ul>
  <h3>Friday, October 23</h3>
  <ul>
    <li><a href="/release/nike/kobe/IO8233-500">Kobe A.D. Protro — Purple Stardust/Black</a> · IO8233-500 · Oct 23, 10:00 AM ET · $155</li>
    <li><a href="/release/nike/cleat/IX6988-001">Nike Ja'Marr Chase Vapor Pro Football Cleats</a> · IX6988-001 · Oct 23 · $155</li>
  </ul>
  <h2>Expected October 2026</h2>
  <ul>
    <li><a href="/release/new-balance/983/U9835HT">New Balance 983</a> · U9835HT · Expected October 2026 · $160</li>
  </ul>
</section>`;

const parsed = applyOfficialSneakerNotes(parseSneakerCalendar([{ html, year: "2026" }]));
const codes = parsed.map((row) => row.style);
assert(codes.indexOf("IQ8161-001") !== -1, "adult Nike row is kept");
assert(codes.indexOf("313623_01") !== -1, "Puma style codes with an underscore are kept");
assert(codes.indexOf("IM7569-900") === -1, "grade-school row is left off");
assert(codes.indexOf("IX6988-001") === -1, "cleats are left off");
assert(codes.indexOf("U9835HT") === -1, "undated expected rows are left off");
assert(brandOf("adidas", "SAMBA OG") === "adidas", "samba stays on the adidas calendar");
assert(isKidsSize("GS Ja 4"), "grade school is a kids size");
const kobe = parsed.find((row) => row.style === "IO8233-500");
assert(kobe && kobe.retail === 150 && kobe.retailSource === "Nike.com", "Kobe uses the Nike.com price");
assert(kobe.raffleUrl === "", "a wide Nike.com release is not marked as a raffle");
const snkrs = parsed.find((row) => row.style === "IQ8161-001");
assert(snkrs.raffleUrl === "https://www.nike.com/launch", "SNKRS row links the draw");
assert(snkrs.dropUrl.includes("nike.com/w?q="), "SNKRS row links the Nike search");
assert(!snkrs.photo, "calendar rows do not store an unlicensed photo");

const windowed = windowRows(parsed, "2026-10-12", addDays("2026-10-12", 70));
assert(windowed.some((row) => row.style === "HP8256"), "samba is inside the window");
const programs = designerPrograms("2026-10-12", "2026-10-31");
const counts = countByBrand(programs);
assert(counts.Supreme >= 2, "Supreme Thursdays are on the calendar");
assert(counts.Kith >= 2, "Kith Mondays are on the calendar");
assert(counts.Palace >= 2, "Palace Fridays are on the calendar");
assert(programs.every((row) => /not guessed|not copied/i.test(row.spot)), "program rows do not invent SKUs");
assert(WATCHED_WITHOUT_DATES.indexOf("Chanel") !== -1 && WATCHED_WITHOUT_DATES.indexOf("Rolex") !== -1, "undated houses stay on the watch list");

console.log("fashion-calendar.test.js OK");
