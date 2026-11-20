# Rodriguez Lawn & Landscape — Houston, TX

A single-page luxury architectural landscaping site for **Rodriguez Lawn & Landscape**
(Houston, TX · phone / text / WhatsApp **+1 832-574-7414**), built as a static site
ready to deploy on **Cloudflare Pages**.

No build step, no framework, no dependencies to install. Upload the folder and it runs.

---

## Structure

```
.
├── index.html          All sections (hero → services → reviews → area/hours → estimate)
├── _headers            Cloudflare Pages security + cache headers (CSP, XFO, nosniff…)
├── assets/
│   ├── css/styles.css  Design system: forest-obsidian, limestone cream, brass, sage
│   └── js/main.js      Curtain, sticky header, 3D showcase tilt, AOS, quote form
└── README.md
```

## Design & motion

| Element | Implementation |
| --- | --- |
| Startup curtain | `#0F1713` forest panel, brass `RL` crest, `RODRIGUEZ LAWN & LANDSCAPE` wordmark, gold hairline loader. Auto-dismisses at **1.3 s**, and a CSS-only `animation` fallback hides it even if JS fails. `pointer-events: none` on exit, so it can never trap touch scrolling. |
| Scroll reveals | AOS 2.3.4 (`aos.css` + `aos.js` from jsDelivr, allowlisted in `_headers`), `fade-up` on every section, `once: true`, disabled under `prefers-reduced-motion`. |
| Hero showcase stage | Layered 2.5D card: base photograph, foreground lawn strip, cream `Study No. 04` plaque and a floating 5.0★ badge moving at different depths. Mouse pointer perspective tilt (`rotateX/rotateY` + rAF lerp), touch-drag on mobile with `touch-action: pan-y` so vertical scrolling stays native. Decorative overlays are `pointer-events: none`. |
| Type | Cormorant Garamond / Playfair Display (display serif) + Plus Jakarta Sans (UI). |
| Palette | `#0F1713` canvas · `#F5F2EB` cream cards · `#C5A059` brass · `#2E5A44` sage. |

## Estimate flow

The form has no backend — by design, so it deploys to Pages with zero infrastructure:

1. Visitor submits the form (name, phone, address/zip, service, notes).
2. The script validates, then builds a fully pre-filled message.
3. A confirmation panel offers **Send by Text** (`sms:+18325747414`) and
   **Send on WhatsApp** (`https://wa.me/18325747414`), returning the visitor to a
   real conversation with the business.

Service cards' **Request Quote** buttons pre-select the matching service in the form and
scroll to it.

### Turnstile before launch

The verification block in `index.html` is a **visual placeholder** (see the
`.turnstile` markup inside the form). To activate it:

1. Create a Turnstile widget in the Cloudflare dashboard and copy the site key.
2. Replace the placeholder block with the `<div class="cf-turnstile" data-sitekey="…">`
   element and load `https://challenges.cloudflare.com/turnstile/v0/api.js`.
3. In `_headers`, add `https://challenges.cloudflare.com` to `script-src` **and**
   `frame-src` (a ready-made comment is included in the file).
4. Verify the token server-side in a Pages Function before acting on a submission if you
   later add one; the current flow hands off to SMS/WhatsApp, so no server token check is needed.

## Deploy to Cloudflare Pages

**Option A — Dashboard (drag & drop / Git):**

1. Pages → *Create a project* → connect this repository (or upload the folder directly).
2. Framework preset: **None**. Build command: *(leave empty)*. Output directory: `/`.
3. Deploy. The `_headers` file is applied automatically.

**Option B — Wrangler CLI:**

```bash
npx wrangler pages deploy . --project-name=rodriguez-lawn-landscape
```

Then add the custom domain in Pages → *Custom domains*. Update the placeholder
`og:url` / canonical values in `index.html` if you use a different domain.

## Content to replace before launch

- **Reviews** — the four testimonials and the “42 five-star Google reviews” figure are
  written from the brief's themes (reliability, stripes, pricing, communication, makeovers).
  Swap in the verbatim Google reviews and real reviewer names before publishing.
- **Photography** — six verified Unsplash landscaping images (all returning HTTP 200) with
  `object-fit: cover`, lazy loading and a styled brass/forest fallback applied by JS if an
  image fails. Replace with your own project photos for authenticity and local SEO.
- **Turnstile site key** — see above.
- **Legal line** — “Licensed & insured” in the footer should reflect the actual licence details.

## Local preview

Any static server works:

```bash
python3 -m http.server 3001 --bind 0.0.0.0
# open http://localhost:3001
```
