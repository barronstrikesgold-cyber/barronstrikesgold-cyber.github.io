/**
 * Sneaker and designer calendars.
 * Dates and retail come from a public calendar page or an official shop.
 * A resale number is never filled in here. Callers label it as an ask.
 */

const MONTHS = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

export const AUTH_DISCLAIMER = "Authentication: sneakers and designer pieces are widely counterfeited. A listing price is an ask, not proof the item is real or that it sold. Check the pair or the piece with a trusted authenticator before you pay or resell.";

export const ASK_SOURCE = "Ask only. No verified sale. The RealReal, Fashionphile, Rebag, Vestiaire, and Grailed listings were not stored as a sold.";

export const WATCHED_WITHOUT_DATES = [
  "Louis Vuitton", "Gucci", "Chanel", "Hermès", "Dior", "Prada", "Balenciaga",
  "Bottega Veneta", "Goyard", "Rolex", "Fear of God", "Bape", "Stüssy",
];

const BRAND_FROM_PATH = {
  nike: "Nike",
  jordan: "Jordan",
  adidas: "adidas",
  "new-balance": "New Balance",
  asics: "ASICS",
  puma: "Puma",
};

function decodeHtml(text) {
  return String(text || "")
    .replace(/&#8217;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function addDays(iso, days) {
  const parts = String(iso).split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  date.setUTCDate(date.getUTCDate() + days);
  return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
}

export function labelDate(iso) {
  const parts = String(iso || "").split("-").map(Number);
  if (parts.length < 3 || !parts[0]) return "";
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function weekdayIso(iso) {
  const parts = String(iso).split("-").map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
}

function eachDate(start, end, weekday) {
  const rows = [];
  let cursor = start;
  while (cursor <= end) {
    if (weekdayIso(cursor) === weekday) rows.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return rows;
}

function headingDate(text, year) {
  const match = String(text || "").match(/([A-Za-z]+)\s+(\d{1,2})\s*$/);
  if (!match || !MONTHS[match[1].toLowerCase()]) return "";
  return year + "-" + MONTHS[match[1].toLowerCase()] + "-" + pad(match[2]);
}

export function brandOf(pathBrand, name) {
  const label = String(name || "");
  const lower = label.toLowerCase();
  if (/travis scott|cactus jack/.test(lower)) return "Travis Scott";
  if (/off[-\s]?white/.test(lower)) return "Off-White";
  if (/\bjordan\b/.test(lower) || pathBrand === "jordan") return "Jordan";
  if (BRAND_FROM_PATH[pathBrand]) return BRAND_FROM_PATH[pathBrand];
  if (/^nike\b/i.test(label)) return "Nike";
  if (/\badidas\b|\byeezy\b/i.test(label)) return "adidas";
  if (/\bnew balance\b|\bnb\b/i.test(label)) return "New Balance";
  if (/\basics\b|\bgel-/i.test(label)) return "ASICS";
  if (/\bpuma\b/i.test(label)) return "Puma";
  return "";
}

export function isKidsSize(name) {
  return /\b(GS|PS|TD)\b|\bgrade school\b|\bpreschool\b|\btoddler\b|\binfant\b|\b(kids'|kid's|big kids|little kids)\b/i.test(String(name || ""));
}

function dropLinks(brand, code, snkrs) {
  const q = encodeURIComponent(code || "");
  if (brand === "Nike" || brand === "Jordan" || brand === "Travis Scott" || brand === "Off-White") {
    return {
      dropUrl: "https://www.nike.com/w?q=" + q,
      raffleUrl: snkrs ? "https://www.nike.com/launch" : "",
    };
  }
  if (brand === "adidas") return { dropUrl: "https://www.adidas.com/us/search?q=" + q, raffleUrl: "" };
  if (brand === "New Balance") return { dropUrl: "https://www.newbalance.com/search?q=" + q, raffleUrl: "" };
  if (brand === "ASICS") return { dropUrl: "https://www.asics.com/us/en-us/search/?q=" + q, raffleUrl: "" };
  if (brand === "Puma") return { dropUrl: "https://us.puma.com/us/en/search?q=" + q, raffleUrl: "" };
  return { dropUrl: "", raffleUrl: "" };
}

function lineNote(brand, name) {
  const lower = String(name || "").toLowerCase();
  if (brand !== "adidas") return "";
  if (/\byeezy\b/.test(lower)) return " The name on the calendar says Yeezy.";
  return " adidas line on the public calendar. It is not labeled Yeezy.";
}

/**
 * Parse the server-rendered release list. Stops at the undated "Expected" heading.
 * pages: [{ html, year }]
 */
export function parseSneakerCalendar(pages) {
  const rows = [];
  const seen = new Set();
  (pages || []).forEach((page) => {
    const year = String(page.year || "");
    const html = String(page.html || "");
    const hub = (html.split('id="seo-hub-links"')[1] || "").split("</section>")[0];
    const confirmed = hub.split(/<h2[^>]*>[^<]*Expected/i)[0];
    let release = "";
    confirmed.split(/(?=<h3|<li)/i).forEach((chunk) => {
      if (/^<h3/i.test(chunk)) {
        const text = decodeHtml(chunk.replace(/<[^>]+>/g, " "));
        release = headingDate(text, year);
        return;
      }
      if (!release || !/^<li/i.test(chunk)) return;
      const href = (chunk.match(/href="(\/release\/([^/]+)\/[^"]+)"/) || []);
      const pathBrand = href[2] || "";
      const name = decodeHtml((chunk.match(/<a[^>]*>([^<]+)<\/a>/) || [])[1] || "");
      const rest = decodeHtml(chunk.replace(/<[^>]+>/g, " "));
      const code = (rest.match(/·\s*([A-Z0-9][A-Z0-9._-]{3,})\s*·/i) || [])[1] || "";
      const price = Number((rest.match(/\$([0-9]+(?:\.[0-9]{2})?)/) || [])[1]);
      const snkrs = /SNKRS/i.test(rest);
      const brand = brandOf(pathBrand, name);
      if (!name || !code || !brand || isKidsSize(name) || /cleat/i.test(name)) return;
      const key = code.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const links = dropLinks(brand, code, snkrs);
      const pageUrl = href[1] ? "https://justdrops.com" + href[1] : "https://justdrops.com/calendar";
      rows.push({
        id: "snk-" + key.replace(/[^a-z0-9]+/g, "-"),
        brand,
        name,
        style: code,
        release,
        retail: Number.isFinite(price) ? price : null,
        retailLabel: Number.isFinite(price) ? "$" + price.toFixed(2) : "MSRP not on the calendar",
        retailSource: "Just Drops calendar",
        retailUrl: pageUrl,
        dropUrl: links.dropUrl,
        raffleUrl: links.raffleUrl,
        spot: code + (snkrs ? " · SNKRS draw" : " · retail drop") + "." + lineNote(brand, name) + " Confirm the colorway on the drop link.",
        photo: "",
        photoAlt: name,
        photoCredit: "",
        photoPage: "",
      });
    });
  });
  return rows;
}

const OFFICIAL = {
  "io8233-500": {
    retail: 150,
    retailLabel: "$150.00",
    retailSource: "Nike.com",
    retailUrl: "https://www.nike.com/a/kobe-ad-protro-release-info",
    dropUrl: "https://www.nike.com/w?q=IO8233-500",
    raffleUrl: "",
    spot: "IO8233-500 · Nike.com says Purple Stardust releases October 23, 2026 at $150 on nike.com and at retailers. Wide release, not a draw.",
  },
};

export function applyOfficialSneakerNotes(rows) {
  return (rows || []).map((row) => {
    const extra = OFFICIAL[String(row.style || "").toLowerCase()];
    return extra ? Object.assign({}, row, extra) : row;
  });
}

export function windowRows(rows, start, end) {
  return (rows || []).filter((row) => row.release && row.release >= start && row.release <= end)
    .sort((a, b) => String(a.release).localeCompare(String(b.release)) || String(a.name).localeCompare(String(b.name)));
}

function programRow(brand, iso, shop, sourceName, sourceUrl, spot) {
  return {
    id: brand.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + iso,
    brand,
    name: brand + " drop",
    style: "",
    release: iso,
    retail: null,
    retailLabel: "Price posts with that week's list",
    retailSource: sourceName,
    retailUrl: sourceUrl,
    dropUrl: shop,
    raffleUrl: "",
    spot,
    photo: "",
    photoAlt: brand + " drop",
    photoCredit: "",
    photoPage: "",
  };
}

export function designerPrograms(start, end) {
  const supreme = eachDate(start, end, 4).map((iso) => programRow(
    "Supreme",
    iso,
    "https://www.supremenewyork.com/shop/all",
    "Supreme shop",
    "https://www.supremecommunity.com/droplists/",
    "Weekly Thursday drop. The last published Fall/Winter 2026 list was Thursday, October 8, 2026. Later Thursdays follow that shop week. Item names and prices were not guessed."
  ));
  const kith = eachDate(start, end, 1).map((iso) => programRow(
    "Kith",
    iso,
    "https://kith.com/",
    "Kith",
    "https://hypebeast.com/2026/8/kith-fall-2026-collection-featuring-needles-nfl-collaborations-release-info",
    "Kith Monday program. Hypebeast reported the Fall 2026 Monday program. The piece list for this Monday was not copied because it is posted on the shop, not ahead of the week."
  ));
  const palace = eachDate(start, end, 5).map((iso) => programRow(
    "Palace",
    iso,
    "https://shop.palaceskateboards.com/",
    "Palace shop",
    "https://www.justfresh.co/fashion/palace-winter-2026-collection",
    "Palace Winter 2026 sells in weekly Friday drops after the October 2, 2026 opening. Piece names and prices for this Friday were not guessed."
  ));
  return supreme.concat(kith, palace);
}

export function askFields() {
  return {
    sold: null,
    soldDate: "",
    soldSource: ASK_SOURCE,
    soldUrl: "",
    net: null,
    street: null,
    streetNote: "Ask, not a verified sale. No public sold was confirmed.",
    feed: true,
    photo: "",
  };
}

export function countByBrand(rows) {
  const counts = {};
  (rows || []).forEach((row) => {
    const brand = row.brand || "Unknown";
    counts[brand] = (counts[brand] || 0) + 1;
  });
  return counts;
}
