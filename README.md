# Advanced Digital Marketing LTDA

Cyberpunk-themed marketing agency website. SvelteKit 2 + Svelte 5 + Tailwind CSS 3.4, fully prerendered to static HTML via adapter-static.

**Owner / operator:** Andrew Philip Weilbacher
**Services:** SEO & GEO, Paid Search, Paid Social, Web Design
**Registered office:** AV PAULISTA 777, ANDAR 15 CONJ 15 SALA 3408, SAO PAULO, SP, 01311-914
**Contact:** contact@marketingprowess.simplelogin.com

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Outputs a fully static site to `dist/` (`index.html`, `about/index.html`, `contact/index.html`), ready for any static host. No server or database required; contact works via mailto links.

## Image assets

The two AI-generated images (`andrew-portrait.jpg`, `data-city.jpg`) are not committed as binaries. `npm run dev` and `npm run build` fetch them automatically via `scripts/sync-assets.mjs` (wired as `predev` / `prebuild`).

If those URLs ever expire, place the two `.jpg` files manually in `src/lib/assets/` with the exact filenames above. The sync script skips any file that already exists.

## Structure

- `src/routes/` — Home (`+page.svelte`), `about/`, `contact/`
- `src/lib/components/cyber/` — boot blinds, CRT overlay, terminal typing, hover scramble, glitch word, scroll reveals
- `src/lib/components/chrome/` — nav and footer
- `src/app.css` — design tokens, chamfer clips, glitch/CRT/ledger styles, reduced-motion rules
