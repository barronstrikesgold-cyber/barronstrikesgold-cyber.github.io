/**
 * Mattel Creations launch calendar.
 * The page publishes a JSON-LD list and a matching grid. Dollar prices are
 * stored only when the card or product JSON prints one. $$ is a tier.
 * Brand marks are not product photos.
 */

const EXTRA_CRONS = {
  "0 15 * * *": 10,
  "0 16 * * *": 10,
  "0 18 * * *": 13,
  "0 19 * * *": 13,
};

export function chicagoParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = {};
  fmt.formatToParts(date).forEach((part) => {
    if (part.type !== "literal") parts[part.type] = part.value;
  });
  return {
    date: parts.year + "-" + parts.month + "-" + parts.day,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function centralLabel(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return day + " · " + time + " CT";
}

export function brandLine(vendor, badge, title) {
  const blob = [vendor, badge, title].filter(Boolean).join(" ");
  if (/elite\s*64/i.test(blob)) return "Elite 64";
  if (/hot wheels/i.test(blob)) return "Hot Wheels RLC";
  if (/matchbox/i.test(blob)) return "Matchbox";
  if (/barbie/i.test(blob)) return "Barbie";
  if (/monster high/i.test(blob)) return "Monster High";
  if (/masters of the universe|\bmotu\b/i.test(blob)) return "Masters of the Universe";
  if (/\bwwe\b/i.test(blob)) return "WWE";
  if (/\bdc\b/i.test(blob)) return "DC";
  if (/\buno\b/i.test(blob)) return "UNO";
  if (/mattel creations/i.test(blob)) return "Mattel Creations";
  return String(vendor || "Mattel Creations").trim() || "Mattel Creations";
}

export function isMattelLogo(src) {
  const value = String(src || "");
  return /calendar-logos|(?:^|[^\w])logo(?:[^\w]|$)|[-_/]logo[-_.]|_logo|logo[-_]/i.test(value);
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&#8217;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteMattel(href) {
  if (!href) return "";
  if (/^https?:\/\//i.test(href)) return href;
  if (href.indexOf("//") === 0) return "https:" + href;
  return "https://creations.mattel.com" + (href.charAt(0) === "/" ? href : "/" + href);
}

function productPhoto(src) {
  const url = absoluteMattel(src);
  if (!url || isMattelLogo(url)) return "";
  if (!/creations\.mattel\.com\/cdn\/shop\/|cdn\.shopify\.com/i.test(url)) return "";
  return url;
}

function priceFromToken(token) {
  const text = decodeHtml(token);
  if (!text) return { retail: null, retailLabel: "Price not on the launch calendar" };
  if (/^\$+$/.test(text)) {
    return { retail: null, retailLabel: "Price tier " + text + " (not a dollar price)" };
  }
  const num = Number(text.replace(/[^0-9.]/g, ""));
  if (/^\$?\d/.test(text) && Number.isFinite(num) && num > 0) {
    return { retail: num, retailLabel: "$" + num.toFixed(2) };
  }
  return { retail: null, retailLabel: text };
}

function slug(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function jsonLdEvents(html) {
  const match = String(html || "").match(/SDG\.Data\.launchCalendarJsonld\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!match) return [];
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch (err) {
    return [];
  }
  return (data.itemListElement || []).map((row) => (row && row.item) || null).filter((item) => item && item.startDate);
}

function gridCards(html) {
  const section = (String(html || "").split("calendar-section--metaobject")[1] || "").split("</section>")[0];
  return section.split(/calendar-grid-item(?=[\s"'])/).slice(1).map((chunk) => {
    const month = ((chunk.match(/month-field">([^<]+)/) || [])[1] || "").trim();
    const day = ((chunk.match(/day-field">([^<]+)/) || [])[1] || "").trim();
    const vendor = decodeHtml((chunk.match(/citem-vendor[^>]*>([^<]+)/) || [])[1] || "");
    const badge = decodeHtml((chunk.match(/merch-badge">([^<]+)/) || [])[1] || "");
    const title = decodeHtml((chunk.match(/citem-title">([^<]+)/) || [])[1] || "");
    const price = decodeHtml((chunk.match(/citem-price">([^<]+)/) || [])[1] || "");
    const href = (chunk.match(/href="(\/products\/[^"]+)"/) || [])[1] || "";
    const image = (chunk.match(/class="calendar-image"[^>]*src="([^"]+)"/) || [])[1] || "";
    return { month, day, vendor, badge, title, price, href, image };
  });
}

function sameDay(startDate, card) {
  if (!card || !card.month || !card.day) return false;
  const date = new Date(startDate);
  const parts = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
  }).formatToParts(date).forEach((part) => {
    if (part.type !== "literal") parts[part.type] = part.value;
  });
  return String(parts.month || "").toLowerCase() === String(card.month).slice(0, 3).toLowerCase()
    && String(Number(parts.day)) === String(Number(card.day));
}

export function parseLaunchCalendar(html, now) {
  const clock = now instanceof Date ? now : new Date(now || Date.now());
  const today = chicagoParts(clock).date;
  const events = jsonLdEvents(html);
  const cards = gridCards(html);
  const used = new Set();
  return events.map((event, index) => {
    let card = cards[index] && sameDay(event.startDate, cards[index]) ? cards[index] : null;
    if (!card) {
      card = cards.find((row, cardIndex) => !used.has(cardIndex) && sameDay(event.startDate, row)) || null;
    }
    if (card) used.add(cards.indexOf(card));
    const vendor = (card && card.vendor) || String(event.name || "").split(" - ")[0].trim();
    const badge = (card && card.badge) || "";
    const rawTitle = (card && card.title) || event.description || "";
    const revealed = rawTitle && !/^coming soon$/i.test(rawTitle);
    const brand = brandLine(vendor, badge, event.name);
    const name = revealed
      ? rawTitle
      : brand + (badge ? " · " + badge : "");
    const when = chicagoParts(new Date(event.startDate));
    const priced = priceFromToken(card && card.price);
    const productUrl = card && card.href ? absoluteMattel(card.href) : "";
    const photo = productPhoto(card && card.image);
    const id = "mattel-launch-" + when.date + "-" + slug(badge ? brand + "-" + badge : brand);
    return {
      id,
      name,
      brand,
      vendor,
      badge,
      release: when.date,
      releaseLabel: centralLabel(event.startDate),
      launchAt: new Date(event.startDate).toISOString(),
      retail: priced.retail,
      retailLabel: priced.retailLabel,
      retailUrl: productUrl || "https://creations.mattel.com/pages/launch-calendar",
      photo,
      photoAlt: revealed ? name : "",
      launchUnrevealed: !revealed,
      upcoming: when.date >= today,
      spot: "Official Mattel Creations launch calendar. Brand line " + brand + ". "
        + (revealed ? "Product name is on the calendar." : "The product name is still Coming Soon.")
        + " Time is Central. " + (priced.retail == null && /^Price tier/.test(priced.retailLabel) ? "The calendar prints a price tier, not a dollar MSRP." : ""),
    };
  }).filter((row) => row.upcoming && row.release);
}

export function toMarketLaunch(row) {
  return {
    feed: true,
    retail: row.retail,
    retailLabel: row.retailLabel,
    retailSource: "Mattel Creations launch calendar",
    retailUrl: row.retailUrl,
    release: row.release,
    releaseLabel: row.releaseLabel,
    launchAt: row.launchAt,
    launchCalendar: true,
    launchUnrevealed: Boolean(row.launchUnrevealed),
    spot: row.spot,
    photo: row.photo || "",
    photoAlt: row.photoAlt || row.name,
    photoCredit: row.photo ? "Mattel Creations" : "",
    photoPage: row.photo ? row.retailUrl : "",
    streetNote: "Mattel's calendar price is the shop tier or the product page price, not a secondary sold.",
    sold: null,
    soldDate: "",
    soldSource: row.launchUnrevealed ? "No product name yet, so no sold comp was searched." : "No settled sale fetched.",
    soldUrl: "",
    net: null,
    street: null,
    sheetVerdict: "",
    id: row.id,
    section: "mattel",
    name: row.name,
    brand: row.brand,
    liquid: false,
  };
}

export function productHandle(url) {
  const match = String(url || "").match(/\/products\/([^/?#]+)/i);
  return match ? match[1].toLowerCase() : "";
}

function sameName(a, b) {
  const left = String(a || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const right = String(b || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return left.length > 8 && left === right;
}

export function findLaunchMatch(items, launch) {
  const handle = productHandle(launch.retailUrl);
  return (items || []).findIndex((item) => {
    if (!item) return false;
    if (item.id && item.id === launch.id) return true;
    const itemHandle = productHandle(item.retailUrl);
    if (handle && itemHandle && handle === itemHandle) return true;
    if (sameName(item.name, launch.name) && item.release === launch.release) return true;
    return false;
  });
}

export function mergeLaunches(items, launches) {
  const next = (items || []).map((item) => Object.assign({}, item));
  let added = 0;
  (launches || []).forEach((launch) => {
    const index = findLaunchMatch(next, launch);
    if (index >= 0) {
      const current = next[index];
      next[index] = Object.assign({}, current, {
        launchAt: launch.launchAt,
        release: launch.release || current.release,
        releaseLabel: launch.releaseLabel || current.releaseLabel,
        brand: launch.brand || current.brand,
        feed: true,
        launchCalendar: true,
      });
      if (!current.photo && launch.photo) {
        next[index].photo = launch.photo;
        next[index].photoAlt = launch.photoAlt || current.photoAlt;
        next[index].photoCredit = "Mattel Creations";
        next[index].photoPage = launch.retailUrl;
      }
      if ((current.retail == null || current.retail === "") && launch.retail != null) {
        next[index].retail = launch.retail;
        next[index].retailLabel = launch.retailLabel;
      }
      return;
    }
    next.push(launch);
    added += 1;
  });
  return { items: next, added };
}

export function extraRefreshShouldRun({ schedule, now, launches }) {
  const expected = EXTRA_CRONS[schedule];
  if (!expected) return { run: true, reason: "daily" };
  const parts = chicagoParts(now instanceof Date ? now : new Date(now));
  if (parts.hour !== expected) return { run: false, reason: "other daylight offset" };
  const launchDay = (launches || []).some((item) => item && item.launchAt && item.release === parts.date);
  if (!launchDay) return { run: false, reason: "not a launch day" };
  return { run: true, reason: "launch day" };
}
