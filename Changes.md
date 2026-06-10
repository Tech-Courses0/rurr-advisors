# RURR Advisors website — remaining changes

A running checklist of what's still to do before (and after) launch. Items are
grouped by type; **🔴 = blocking before go-live**, 🟡 = important, ⚪ = optional.

> Most content lives in **one** place: [`src/_data/site.json`](src/_data/site.json).
> After any edit run `npm run build` and redeploy the `_site/` folder.

---

## 1. Fill remaining placeholders in `src/_data/site.json`
- 🔴 `url` — confirm the real live domain (currently `https://rurradvisors.in`). Drives canonical URLs, Open Graph tags, and the sitemap; must match where the site is actually hosted.
- 🟡 `baslNo` — BASL (BSE Administration & Supervision Ltd.) membership number, currently `[ASLXXXXX]`. Remove the line if not applicable.
- 🟡 `principalOfficer.qualifications` — currently `[CFP / CFA / MBA]`.
- 🟡 `principalOfficer.nism` — NISM certification(s), currently `[XA & XB]`.
- 🟡 `principalOfficer.experience` — years of experience, currently `[__ years]`.
- 🔴 `fees.fixedCap` — confirm the current SEBI fixed-fee cap, currently `[₹1,25,000]`. Verify against the latest SEBI (Investment Advisers) circular.

## 2. Page content to write/replace
- 🟡 [`src/about.njk`](src/about.njk) — Principal Officer biography is placeholder text (`[Brief professional biography placeholder.]` and `[15] years`). Replace with the real, factual bio.
- 🟡 [`src/index.njk`](src/index.njk) — the home "15+ yrs" trust-strip figure (`data-count="15"`) is a marketing claim. Set it to an accurate, defensible number (or change the label).
- 🔴 [`src/legal/mitc.njk`](src/legal/mitc.njk) — replace the template "Most Important Terms & Conditions" with the **exact wording prescribed in the prevailing SEBI circular** for Investment Advisers.
- 🟡 [`src/legal/terms.njk`](src/legal/terms.njk) and [`src/legal/privacy.njk`](src/legal/privacy.njk) — set the real "Last updated: [DD Month YYYY]" dates.

## 3. Legal & compliance review
- 🔴 Have **Terms, Privacy (DPDP Act, 2023), Disclaimer, and MITC** reviewed by a qualified legal/compliance professional before publishing.
- 🟡 Confirm the Investor Charter, fee structure, and complaints-data format match the latest SEBI requirements.
- 🟡 Review the 41 **Resources** articles (`src/resources/*.md`) for compliance — they're general/educational with disclaimers, but a compliance read before publishing is prudent for an RIA.

## 4. Deployment
- 🔴 Deploy the built **`_site/`** folder to a static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, etc.). Build command `npm run build`, publish directory `_site`.
- 🔴 Point the real domain's DNS at the host and serve over **HTTPS**.
- 🟡 After the domain is final, re-confirm `site.json → url` matches it, rebuild, and resubmit the sitemap (`/sitemap.xml`) in Google Search Console.

## 5. Google Sheet / Apps Script (ongoing, no code changes)
- 🟢 Live now: forms write to the sheet, emails send, grievance tracker and the public complaints tables all work.
- 🔁 Ongoing upkeep: to resolve a complaint, set its **Stage** to `3` in the `Complaints` sheet (Status, Last update, Resolved-on auto-fill).
- 🔁 Complaints received via **SEBI SCORES** (not the website form): add a row manually and set **Source** = `SEBI (SCORES)`.
- 🟡 Periodically confirm confirmation emails are arriving at rurradvisors@gmail.com (watch the Gmail ~100 emails/day limit; set `SEND_ACK_EMAILS = false` in `Code.gs` if needed).

## 6. Optional / nice-to-have
- ⚪ Replace the generated favicon / OG image (the "R" mark in `src/favicon.svg` and `src/og-image.svg`) with a real logo if you have one, then `npm run gen:assets`.
- ⚪ Make displayed phone numbers tap-to-call (`tel:` links).
- ⚪ Add privacy-friendly analytics (e.g. Plausible) if you want visitor stats.
- ⚪ The complaints tables render via JavaScript (live). If you want the figures present for no-JS crawlers too, add a build-time snapshot fallback.
- ⚪ QA pass: test both forms and the tracker on a phone and across browsers after go-live.

---

## Done recently (for reference)
- ✅ Eleventy build; shared header/footer/layout; single `site.json` data source.
- ✅ Real RURR Advisors SEBI details wired in; rebrand (logo, favicon, OG, titles).
- ✅ SEO: canonical, Open Graph, Twitter cards, JSON-LD, sitemap.xml, robots.txt.
- ✅ MITC page, fee disclosure, DPDP privacy section added.
- ✅ Contact + grievance forms → Google Apps Script → Sheet (live), with email + tickets.
- ✅ Grievance tracker + complaints tables auto-aggregated from the sheet (live).
- ✅ Nav/footer order (Grievances after Contact); strict form validation; E.164 phone format.
- ✅ Compliance card → escalation matrix; Contact aside balanced; About/footer separation.
