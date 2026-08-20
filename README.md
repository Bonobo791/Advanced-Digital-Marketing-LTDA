[![Codacy Badge](https://app.codacy.com/project/badge/Grade/40e388c6a5724be0867d621ad4a10fac)](https://app.codacy.com/gh/Bonobo791/Advanced-Digital-Marketing-LTDA/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![Quality gate status](https://sonarcloud.io/api/project_badges/measure?project=Bonobo791_Advanced-Digital-Marketing-LTDA&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Bonobo791_Advanced-Digital-Marketing-LTDA)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=Bonobo791_Advanced-Digital-Marketing-LTDA&metric=bugs)](https://sonarcloud.io/summary/new_code?id=Bonobo791_Advanced-Digital-Marketing-LTDA)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=Bonobo791_Advanced-Digital-Marketing-LTDA&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=Bonobo791_Advanced-Digital-Marketing-LTDA)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=Bonobo791_Advanced-Digital-Marketing-LTDA&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=Bonobo791_Advanced-Digital-Marketing-LTDA)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=Bonobo791_Advanced-Digital-Marketing-LTDA&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=Bonobo791_Advanced-Digital-Marketing-LTDA)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=Bonobo791_Advanced-Digital-Marketing-LTDA&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=Bonobo791_Advanced-Digital-Marketing-LTDA)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Bonobo791_Advanced-Digital-Marketing-LTDA&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Bonobo791_Advanced-Digital-Marketing-LTDA)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=Bonobo791_Advanced-Digital-Marketing-LTDA&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=Bonobo791_Advanced-Digital-Marketing-LTDA)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=Bonobo791_Advanced-Digital-Marketing-LTDA&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=Bonobo791_Advanced-Digital-Marketing-LTDA)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Bonobo791_Advanced-Digital-Marketing-LTDA&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=Bonobo791_Advanced-Digital-Marketing-LTDA)

# Advanced Digital Marketing LTDA

Cyberpunk-themed marketing agency website. SvelteKit 2 + Svelte 5 (runes) + Tailwind CSS 3.4, deployed as a Docker container on Coolify (adapter-node) behind Bunny CDN; pages are server-rendered (the CDN caches at the edge).

**Owner / operator:** Andrew Philip Weilbacher
**Services:** SEO & GEO, Paid Search, Paid Social, Web Design
**Registered office:** São Paulo, SP
**Contact:** contact@AdvancedDigitalMarketingLTDA.com

## Develop

```bash
npm install
npm run check
npm run dev
```

No environment variables are required for the public site. The subscription
checkout needs Mercado Pago credentials (`MERCADO_PAGO_ACCESS_TOKEN`,
optionally `MERCADO_PAGO_SANDBOX_ACCESS_TOKEN` and `PUBLIC_SITE_URL`) — see
`docs/mercado-pago-subscriptions.md`.

## Build

```bash
npm run build
```

Pages are server-rendered; Bunny CDN caches the HTML at the edge (purged on every deploy).

## Cache purge

The site is served through Bunny CDN in front of the Coolify-hosted Node
server. A GitHub Actions workflow (`.github/workflows/purge-bunny-cache.yml`)
waits until the deployed commit finishes deploying on Coolify, then purges the
Bunny pull zone — see `docs/bunny-cdn-purge.md` for the design, setup, and
CI-less fallback, and `docs/coolify-deployment.md` for the Coolify setup.

## Test and quality checks

```bash
npm run test
npm run mutate
```

Vitest covers unit/property tests and endpoint integration tests. fast-check is available to tests only; Stryker runs mutation testing through its Vitest runner.

## Image assets

The supplied Andrew portrait (`src/lib/assets/andrew.png`) is committed with the rest of the first-party visual assets. The sync hook only checks the optional generated `data-city.jpg` fallback when it is absent, so production builds do not depend on its remote URL.

## Structure

- `src/routes/` — home, `about/`, `contact/`, `services/` + `services/[slug]/` (and `pt-br/` variants), the `pt-br/checkout/complete/` return page, and the single API route `api/checkout/subscription`
- `src/lib/components/pages/` — Home, About, Contact, ServicesIndex, Service, SubscribeSection, WebsiteBuildPricing page components
- `src/lib/components/cyber/` — boot blinds, CRT overlay, terminal typing, hover scramble, glitch word, scroll reveals
- `src/lib/components/chrome/` — nav, footer, LocalizedHead, curtain, language suggestion
- `src/app.css` — design tokens, chamfer clips, glitch/CRT/ledger styles, reduced-motion rules

## License

The PolyForm Shield 1.0.0 license applies to the first-party code, copy, and
visual assets in this repository. Bundled third-party fonts (Archivo, Noto JP)
remain under the SIL Open Font License — see `LICENSE.md` for the full terms.
