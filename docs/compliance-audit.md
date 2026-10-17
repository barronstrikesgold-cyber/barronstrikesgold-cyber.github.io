# Hunt compliance audit (October 17, 2026)

This is an engineering audit, not legal advice. Items marked **Owner/lawyer** need a decision or a fact only the owner or counsel can supply. Nothing here invents a legal fact, address, or email.

## Account system: what actually exists

There is no account system. No sign-up, login, password, email verification, password reset, session, Supabase project, Stripe customer, or Pro checkout exists in the code or on the network (verified by `test/personas.mjs`: no account controls and no supabase/stripe/auth hosts contacted). All data is local to the browser: localStorage keys (`hunt-*`, `reseller-*`) and IndexedDB `hunt-stock` and `hunt-upc`. Settings offers **Export my data** (now includes both IndexedDB databases) and **Delete my data on this device** (confirm, clears keys and both databases). The privacy notice describes Supabase sign-in only as a plan.

## Data flows (measured on the live site)

| Destination | When | What is sent |
|---|---|---|
| GitHub Pages (host) | every visit | normal web request: IP, user agent, time |
| tcgplayer-cdn, www.lego.com, svgs.scryfall.io, store.storeimages.cdn-apple.com, cdn.shopify.com, static.wikia.nocookie.net | when a screen shows their product photos | image request, no referrer; lego.com sets Cloudflare `__cf_bm` on its own domain |
| barcode.report, Open Products Facts, Open Food Facts | only for an unknown barcode | the barcode number |
| api.pokemontcg.io, api.tcgdex.net | only for a photo with a card number | card number and name words |
| cdn.jsdelivr.net | first Identify from photo | library download, no photo |
| Owner proxies (UPC, vision) | only if the owner sets them | barcode / reduced photo |

Hunt runs no analytics, ads, pixels, or cookies of its own, and has no newsletter.

## Findings ranked by risk

### Fixed in this PR
1. **High: paid-link disclosure only in the footer.** The FTC Endorsement Guides want a clear disclosure near the link. Any screen with a tagged Amazon link now shows "Paid links: as an Amazon Associate I earn from qualifying purchases…" next to the content. Tagged links keep `rel="sponsored"`. The required Amazon statement stays in the footer.
2. **High: "Pro checkout uses Stripe on the web" in Settings while no checkout exists.** Replaced with "Hunt is free… takes no payment," plus a commitment to show price, auto-renewal, and an online cancel as easy as sign-up before any future payment (FTC negative-option rule and state automatic-renewal laws). Terms gained a **Paid plans** section with the same promise.
3. **Medium: Export my data missed IndexedDB.** The tracker, Show Mode sales, photos, and learned catalog were not in the export, which matters for a right-to-know or portability request. The export now includes `hunt-stock` and `hunt-upc`.
4. **Medium: CSV/formula injection.** A tracker or inventory name starting with `=`, `+`, `-`, or `@` was exported raw and would run as a formula in Excel or Sheets. Text cells are now prefixed with `'`, and the import strips the guard. Covered by unit and browser tests.
5. **Medium: the privacy notice did not list hosting or photo hosts, or third-party cookies.** Added "Who your browser talks to" (GitHub Pages, the photo hosts, `__cf_bm`), "What Hunt does not collect", and IndexedDB in the export, delete, and retention text.
6. **Medium: the terms said "Photos stay on licensed hosts"**, which is not accurate because some photos are copies hosted with the site. The text now says what actually happens, and a trademark/photo takedown section was added.
7. **Low–medium: accessibility (WCAG 2.2 AA).** axe-core found contrast failures on light-theme kickers, the active tab, the profit label, the store monograms, the status chips, and the verdict chip, plus an unnamed home link on sub-pages. All are fixed. axe now reports 0 serious or critical issues on every route on three devices. Keyboard focus is visible at every Tab stop, the sheet traps focus, and Escape closes it.
8. **Low: age notice.** The footer of every screen now says "Hunt is for people 13 and older", alongside a trademark non-affiliation line.

### Already in place (verified)
- GPC is honored and shown in Settings. The notice says personal information is not sold or shared. CCPA/CPRA wording is present.
- The COPPA 13+ statement is in the privacy notice and terms.
- A public delete-account page exists and is linked from the footer.
- No cookies or analytics, so no consent banner is needed under US law today.

### Needs the owner or a lawyer
1. **Contact email and postal address**: `CONTACT_EMAIL` and `POSTAL_ADDRESS` are still placeholders in the privacy, terms, and delete pages. CCPA requires a working way to submit requests; CAN-SPAM requires a postal address in any future email; the Amazon Associates agreement and Apple also expect contact details. **Owner** must supply them.
2. **Governing law, venue, arbitration, limitation of liability, and warranty disclaimer**: still `GOVERNING_LAW`. **Lawyer.**
3. **Legal entity name**: the pages say "Broken Beaker Labs LC". Confirm the exact registered name and state ("LC" versus "LLC"). **Owner.**
4. **Product photos and trademarks**: about 85 MB of Hot Wheels Wiki and Mattel product thumbnails, plus calendar photos, are re-hosted in `assets/hw` and `photos/`, and other photos are hotlinked from retailers and the wiki. Wiki images are usually Mattel's copyrighted product shots, not covered by the wiki's CC-BY-SA text license. REQUIREMENTS.md says "licensed photos only", which this does not meet. Options: get permission, switch to affiliate or retailer APIs that license images, use your own photos, or rely on a fair-use opinion. **Lawyer/owner.** A takedown contact is now in the terms but needs the email from item 1.
5. **"Hunt" name and the Mattel/Pokémon marks**: nominative use with a non-affiliation notice is in place. A trademark clearance search for the "Hunt" name and logo is a **lawyer** item.
6. **Amazon Associates**: the statement and tag are in place. Amazon also restricts showing Amazon prices that are not from its API, and using its links in offline or email contexts. Confirm compliance with the current Operating Agreement. **Owner.**
7. **TCGplayer attribution line in the footer**: keep it only if Hunt uses TCGplayer data under their terms. **Owner.**
8. **Before accounts ship (future)**:
   - In-app account deletion (Apple 5.1.1(v)).
   - A 13+ age gate at sign-up with no data stored for under-13s.
   - Sign in with Apple when other social logins exist (4.8).
   - Email verification and magic-link security.
   - A data processing agreement with Supabase.
   - Breach-notice plan.
   - Opt-in email with unsubscribe and postal address (CAN-SPAM).
   - Click-to-cancel for Pro.
   - Re-run this audit.
9. **Accessibility statement and feedback contact** (ADA risk reduction): optional page; needs the contact email. **Owner.**
