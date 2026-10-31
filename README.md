# QuakeWatch

A Hack for Humanity earthquake-data explorer prototype. It queries USGS records on load, filter change, or manual refresh. It is not continuously monitored, a prediction system, an emergency alert service, or a basis for safety decisions. Follow official local authorities for emergency guidance.

## What the interface shows

- Up to **100 matching valid point records**, ordered by reported magnitude, not a complete catalogue.
- A Mapbox map with clustered markers when a public token, network access, and a compatible browser are available.
- An independent event list and filters, including missing-map, request-error, retry, and empty states.
- UTC display times and actual selected UTC date bounds. Reports and magnitudes can be revised by the source.

Map and data failures are separate. Old filter requests are cancelled and cannot overwrite a newer result. Service-provided popup text is escaped, and event links are restricted to HTTPS USGS URLs. Cluster means cover the cluster's records; unavailable depth is not invented as zero.

## Local setup

Use Node **22.12 or newer** and the pinned npm version:

```sh
npm exec --yes --package=npm@11.21.1 -- npm ci --ignore-scripts --strict-peer-deps
npm test
npm run lint
npm run build
npm run dev
```

Optionally copy `.env.example` to `.env` and set `VITE_MAPBOX_TOKEN` to a scoped **public** Mapbox token beginning with `pk.`. Vite exposes `VITE_` values to browsers. Never put a secret token there. The build rejects non-public token formats. Without a token, the USGS list still works.

An embedded token was removed from the source. Review the original token's restrictions, usage, and any rotation in the owning Mapbox account. This source repair does not rotate tokens or establish account ownership or quota.

## Validation boundaries

`npm test` runs only the two explicit offline test files. They mock USGS traffic and cover date bounds, invalid records, cancellation, response limits, popup escaping, URL restrictions, and cluster arithmetic. Do not use a broad automatic test discovery command: the preserved `src/services/test.js` is a legacy **live USGS request** script, not the offline suite.

Browser QA should intercept USGS responses with clearly fictional fixtures and block Mapbox and other external requests. Such tests do not prove live Mapbox token validity, USGS availability, earthquake completeness, forecasting accuracy, or an emergency-response capability.

The reviewed source passed a strict frozen installation, 24 offline tests, lint, production build, and 30 fixture-only browser checks across five viewports. The production dependency audit reports zero findings; the full audit retains seven moderate development-toolchain findings through minimatch/ESLint, with no high or critical findings. No incompatible major override or toolchain downgrade was applied.

Stack: React 18, Vite, Mapbox GL JS, Supercluster, Tailwind CSS. Unused drag-and-drop, map-wrapper, clustering, and React Query packages are no longer application dependencies. Controls use native buttons and stack below the map on narrow screens.

## Provenance and license

Created for the [Hack for Humanity 2025 hackathon](https://hack-for-humanity-25.devpost.com/).

The historical README stated MIT, but no standalone license grant was verified in this source pass. Confirm the copyright and license before reuse; no new grant is invented here. Mapbox, data sources, and dependencies have separate terms.

- [GitHub source](https://github.com/bO-05/quakewatch)
- [Existing deployment](https://quakewatch.vercel.app/)
- [Devpost submission](https://devpost.com/software/quakewatch-real-time-global-earthquake-monitoring-platform)
- [USGS API documentation](https://earthquake.usgs.gov/fdsnws/event/1/)