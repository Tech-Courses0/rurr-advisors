# RURR Advisors — website

Website for **RURR Advisors** (proprietor: Rishu Goyal), a SEBI Registered
Investment Adviser. Built with [Eleventy (11ty)](https://www.11ty.dev/) so the
header, footer, navigation, and `<head>` live in **one** place and every firm
detail comes from **one** data file.

## Structure

```
sebi-ria-website/
├── src/
│   ├── _data/site.json        # SINGLE source of truth — firm name, reg no, address, emails, fees, nav…
│   ├── _includes/base.njk     # Shared layout: <head> (SEO/OG/JSON-LD/favicon), header, mobile menu, footer
│   ├── index.njk              # Home
│   ├── about.njk              # About
│   ├── services.njk           # Services
│   ├── grievances.njk         # Grievances (raise/track + SEBI-format complaints tables)
│   ├── disclosures.njk        # Registration, Investor Charter, conflict + fee disclosure
│   ├── contact.njk            # Contact / enquiry form
│   ├── legal/
│   │   ├── mitc.njk           # Most Important Terms & Conditions (SEBI)
│   │   ├── terms.njk
│   │   ├── privacy.njk        # Privacy Policy (DPDP Act, 2023)
│   │   └── disclaimer.njk
│   ├── 404.njk
│   ├── sitemap.njk            # → /sitemap.xml (auto-generated from pages)
│   ├── robots.njk             # → /robots.txt
│   ├── favicon.svg / og-image.svg   # brand source art
│   ├── css/styles.css
│   └── js/main.js             # reveal animations, mobile menu, form → API wiring
├── scripts/gen-assets.mjs     # rasterises the SVGs → favicon.png / apple-touch-icon.png / og-image.png
├── .eleventy.js               # Eleventy config (input src/, output _site/)
└── _site/                     # BUILD OUTPUT — this is what you deploy (git-ignored)
```

## Develop

```bash
npm install            # once
npm start              # live-reloading dev server at http://localhost:8080
```

## Build & deploy

```bash
npm run build          # generates _site/
```

Deploy the **`_site/`** folder to any static host (Netlify, Vercel, Cloudflare
Pages, GitHub Pages, S3 + CloudFront, nginx). On Netlify/Vercel, set
build command `npm run build` and publish directory `_site`.

## Editing content

- **Firm details (most edits):** `src/_data/site.json`. Change it once and the
  reg number, address, emails, phone, fees, copyright, JSON-LD, etc. update
  across every page.
- **Look & feel:** `src/css/styles.css` (design tokens in the `:root` block).
- **Per-page copy:** the matching `src/*.njk` / `src/legal/*.njk` file.
- **Navigation:** the `nav` array in `site.json` (drives header + mobile menu;
  the active link is highlighted automatically).
- **Brand art:** edit `src/favicon.svg` / `src/og-image.svg`, then run
  `npm run gen:assets` to regenerate the PNGs.

## Forms → Google Sheet via Apps Script (action required)

The contact and grievance forms send data to a **Google Apps Script web app**
that writes to a Google Sheet, emails confirmations, generates grievance ticket
numbers, and answers the status tracker — no separate server needed.

**Setup (~10 min): follow [`apps-script/README.md`](apps-script/README.md).**
In short: create a blank Google Sheet → Extensions → Apps Script → paste
[`apps-script/Code.gs`](apps-script/Code.gs) → Deploy as Web app ("Anyone")
→ paste the `/exec` URL into `site.json → forms.endpoint` → `npm run build`.

Message contract (handled for you by `Code.gs`):

| Action | Request | Response |
| --- | --- | --- |
| Contact | `POST {type:'contact', name, email, phone, interest, message}` | `{ ok: true }` |
| Raise complaint | `POST {type:'complaint', name, email, phone, category, details}` | `{ ok: true, ticket: "RA-2026-12345" }` |
| Track complaint | `GET ?ticket=RA-2026-12345` | `{ found: true, num, status, opened, updated, eta, stage }` or `{ found: false }` |

Until you paste the real endpoint URL, the forms show a friendly error instead
of failing silently. The UI handles loading, success, error, and not-found states.

## Before going live — checklist

- [ ] **Set the real domain** in `site.json → url` (currently `https://rurradvisors.in`) — drives canonical URLs, OG tags, and the sitemap.
- [ ] Deploy the Apps Script and paste its URL into `site.json → forms.endpoint` (see [`apps-script/README.md`](apps-script/README.md)).
- [ ] Fill the remaining `[...]` placeholders in `site.json`: BASL membership no., principal officer qualifications/NISM/experience, and confirm the SEBI fee caps (`fees.fixedCap`).
- [ ] Replace the principal-officer biography in `src/about.njk` and the "15+ yrs" figure on the home page / About page with accurate, defensible values.
- [ ] Complaints figures now generate automatically from the `Complaints` sheet (no manual table edits) — just keep the sheet's **Stage** column current. Replace the MITC wording in `src/legal/mitc.njk` with the exact text from the prevailing SEBI circular.
- [ ] Have **Terms, Privacy (DPDP), Disclaimer, and MITC** reviewed by a qualified legal/compliance professional.
