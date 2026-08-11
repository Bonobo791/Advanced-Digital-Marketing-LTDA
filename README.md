# Advanced Digital Marketing LTDA

Cyberpunk-themed marketing agency website. SvelteKit 2 + Svelte 5 (runes) + Tailwind CSS 3.4, deployed to Netlify with prerendered public pages.

**Owner / operator:** Andrew Philip Weilbacher
**Services:** SEO & GEO, Paid Search, Paid Social, Web Design
**Registered office:** SAO PAULO, SP
**Contact:** contact@AdvancedDigitalMarketingLTDA.com

## Develop

```bash
npm install
npm run check
npm run dev
```

No environment variables are required for the public site.

## Build

```bash
npm run build
```

The public pages remain prerendered.

## Test and quality checks

```bash
npm run test
npm run mutate
```

Vitest covers unit/property tests and endpoint integration tests. fast-check is available to tests only; Stryker runs mutation testing through its Vitest runner.

## Image assets

The supplied Andrew portrait (`src/lib/assets/andrew.png`) is committed with the rest of the first-party visual assets. The sync hook only checks the optional generated `data-city.jpg` fallback when it is absent, so production builds do not depend on its remote URL.

## Structure

- `src/routes/` — Home (`+page.svelte`), `about/`, `contact/` (+ `pt-br/` variants)
- `src/lib/components/pages/` — Home, About, Contact page components
- `src/lib/components/cyber/` — boot blinds, CRT overlay, terminal typing, hover scramble, glitch word, scroll reveals
- `src/lib/components/chrome/` — nav and footer
- `src/app.css` — design tokens, chamfer clips, glitch/CRT/ledger styles, reduced-motion rules

## License

This website is under the PolyForm Shield 1.0.0 license.
