#!/usr/bin/env python3
"""Build data/hw/monster-trucks.json: Hot Wheels Monster Trucks 1:64 basic
(assortment FYJ44) releases with Mattel item codes and photos.

Source: the "Monster Trucks" table on the Hot Wheels Wiki year pages
(hotwheels.fandom.com, CC BY-SA). Only toy numbers printed in that table
are kept; a row without one is stored with code null ("unknown"), never a
guessed code. Photos are the wiki's own 320px thumbnails on
static.wikia.nocookie.net. Fandom refuses a GitHub Pages referrer, but Hunt
sends no referrer (meta referrer + referrerpolicy), and the CDN answers
200 with Access-Control-Allow-Origin: *, so they load and can be copied.

    python3 scripts/build-monster-trucks.py [years...]   # default 2026 2025 2024
then: npm run upc-index
"""
import json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
API = "https://hotwheels.fandom.com/api.php"
UA = {"User-Agent": "HuntCatalog/1.0 (+https://barronstrikesgold-cyber.github.io/)"}
YEARS = [int(y) for y in sys.argv[1:]] or [2026, 2025, 2024]
CODE = re.compile(r"\b[A-Z]{3}\d{2}\b")


def api(params):
    data = urllib.parse.urlencode(dict(params, format="json")).encode()
    req = urllib.request.Request(API, data=data, headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=40))


def table_rows(wikitext):
    """Rows of the first section ("Monster Trucks" = the 1:64 basic line)."""
    sec = re.split(r"\n==[^=]", wikitext)[0]
    for raw in sec.split("\n|-")[1:]:
        cells = [c.strip() for c in re.split(r"\n\|", "\n" + raw.strip())][1:]
        if len(cells) >= 7:
            yield cells


def plain(cell):
    if cell.strip().strip("'").upper() in ("N/A", "NA", "?", "??", "-", "—"):
        return ""
    cell = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]", r"\1", cell)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", cell).replace("''", "")).strip()


def parse(years):
    out = {}
    for year in sorted(years, reverse=True):
        page = f"{year} Hot Wheels Monster Trucks"
        text = api({"action": "parse", "page": page, "prop": "wikitext", "redirects": 1})["parse"]["wikitext"]["*"]
        for cells in table_rows(text):
            link = re.search(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", cells[1])
            if not link:
                continue
            name = re.sub(r"\s*\((?:Monster Truck|\d{4})\)$", "", (link.group(2) or link.group(1)).strip())
            files = [m.group(1).strip() for m in (re.search(r"File:([^|\]]+)", c) for c in (cells[6], cells[5])) if m and "Image Not Available" not in m.group(1)]
            codes = CODE.findall(cells[0]) or [None]
            for code in codes:
                key = code or "?" + name.lower()
                row = out.get(key)
                if row:
                    if year not in row["years"]:
                        row["years"].append(year)
                    if not row["files"] and files:
                        row["files"] = files
                    continue
                out[key] = {
                    "code": code,
                    "name": name,
                    "series": plain(cells[2]),
                    "mix": plain(cells[4]),
                    "year": year,
                    "years": [year],
                    "wiki": "https://hotwheels.fandom.com/wiki/" + urllib.parse.quote(link.group(1).strip().replace(" ", "_")),
                    "files": files,
                }
        time.sleep(0.5)
    return list(out.values())


def resolve(files):
    info = {}
    files = sorted(set(files))
    for k in range(0, len(files), 20):
        batch = files[k:k + 20]
        d = api({"action": "query", "titles": "|".join("File:" + f for f in batch), "prop": "imageinfo", "iiprop": "url", "iiurlwidth": 320})
        norm = {n["to"]: n["from"] for n in d["query"].get("normalized", [])}
        for p in d["query"]["pages"].values():
            ii = p.get("imageinfo")
            if ii:
                info[norm.get(p["title"], p["title"])[5:]] = {"url": ii[0].get("thumburl") or ii[0]["url"], "page": ii[0].get("descriptionurl", "")}
    return info


def main():
    items = parse(YEARS)
    print("parsed", len(items), flush=True)
    info = resolve([f for it in items for f in it["files"]])
    print("resolved", len(info), flush=True)
    rows = []
    for n, it in enumerate(items):
        thumb = photo_page = ""
        for f in it["files"]:
            if f in info and info[f]["url"].startswith("https://static.wikia.nocookie.net/"):
                thumb = info[f]["url"]
                photo_page = info[f]["page"]
                break
        rows.append({
            "code": it["code"],
            "name": it["name"],
            "year": it["year"],
            "years": sorted(it["years"], reverse=True),
            "series": it["series"],
            "mix": it["mix"],
            "i": thumb,
            "photoPage": photo_page,
            "wiki": it["wiki"],
        })
    rows.sort(key=lambda r: (-r["year"], r["series"].lower(), r["name"].lower()))
    out = {
        "assortment": "FYJ44",
        "name": "Hot Wheels Monster Trucks 1:64",
        "years": sorted(YEARS, reverse=True),
        "note": "Monster Trucks 1:64 basic trucks share one assortment UPC per case (FYJ44), so the barcode cannot name the truck. Item codes (toy numbers) come from the card back. A null code means the wiki table lists no toy number for that row; it is not guessed.",
        "attribution": "Release tables and photos: Hot Wheels Wiki (Fandom), CC BY-SA. Photos are the wiki's own thumbnails, loaded with no referrer, with a link to each file page.",
        "built": time.strftime("%Y-%m-%d"),
        "items": rows,
    }
    with open(os.path.join(ROOT, "data/hw/monster-trucks.json"), "w") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    print(len(rows), "trucks,", sum(1 for r in rows if r["code"]), "with codes,", sum(1 for r in rows if r["i"]), "with photos", flush=True)


if __name__ == "__main__":
    main()
