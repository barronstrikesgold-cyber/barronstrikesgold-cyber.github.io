# Search by case (Hot Wheels mainline)

Catalog → **Search by case**, the Scan box, or a photo of the case box / card.

## What Hunt reads

| You type / scan | Means |
| --- | --- |
| `L2593-973N` (`-976K PN`) | US long-card mainline case; the **last letter of the mix code** is the case (N, K) |
| `C4982-99NL` | International long-card case L |
| `5785-…` | Short-card case |
| `C4982` / `L2593` alone | Mainline assortment, Hunt asks for the case letter |
| `JJK58-N9C0N` | Card code: toy # JJK58, and the suffix ends in the case letter (N) |
| `2026 N`, `N 2026`, `case N`, `N case` | Year + case letter |

Case letters: A B C D E F G H J K L M N P Q (no I or O).

## Where the data comes from

`scripts/build-hw-cases.mjs <year>` writes `data/hw/cases-<year>.json`:

- Cars per case: Orange Track Diecast "Hot Wheels Basics <year> "X" case contents checklist for mainline" posts
  (collector #, model, color, series, TH / STH, store exclusives). Each case keeps its source URL.
- Toy # and photo: Hunt's HW catalog (`data/hw/<year>.json`, from the Hot Wheels Wiki), joined by collector number.
  TH/STH rows match the wiki's TH/STH variants.
- Card codes read off real cards pin a toy # to a case (`CARD_CODES`: JJK58-N9C0N → N, JJL74-N9C0P → P). When the
  catalog has exactly two colors of that collector number, the other case gets the other toy # by elimination.
- A collector number with several colors that no source pins stays **"toy # X or Y (color not confirmed)"**, with the
  casting photo labelled "color may differ". A case with no published checklist says **unknown**.
- Quantities per case are **not published** by Mattel; Hunt says so instead of guessing.

## Fee check

Where Hunt has a verified sold comp (price list / catalog, by toy #): `sold × 0.87 − $5`, minus the cost per car you
type (saved on the phone as `hunt-case-cost`). No comp → "No verified sold comp".

## Not mapped yet

Monster Trucks (FYJ44; the scanner's "Which one is it?" picker still lists the whole assortment) and Matchbox case
mixes have no checklist source wired in yet, and earlier years are not built. Run the script for another year once
a checklist source exists for it.
