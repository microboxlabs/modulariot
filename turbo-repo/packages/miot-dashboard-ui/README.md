# @microboxlabs/miot-dashboard-ui

Embeddable, multi-tenant-ready dashboard UI for ModularIoT: a widget (dashlet)
registry, layout grid, settings UI and rendering engine, packaged as a
framework-agnostic React library.

> **Status: extraction in progress.** The dashboard UI is being extracted from
> the ModularIoT app in phases (P0 scaffold → P1 contracts/seams → P2
> persistence/datasources → P3 core engines → P4 registry → P5 dashlets →
> P6 shell + publish). Until P6 lands, this package is not yet published and
> its API is unstable.

## Design contract (locked)

- **Framework-agnostic React** — no `next` peer dependency. Routing/URL state,
  i18n, notifications, datasources, persistence and authorization are injected
  through adapter seams; a default `window.history` URL adapter makes a plain
  Vite/React host work with zero wiring.
- **Two bundle entries** — `.` (base) and `./charts` (echarts-backed dashlets),
  so consumers that don't use charts never download echarts.
- **`src/core/` is React-free** — pure-TS engines (color rules, thresholds,
  handlebars helpers, filters), enforced by an import guard in CI.
- **Tenant-unaware by design** — tenant context rides the injected persistence
  and datasource seams (and the embed token on the server side); the UI never
  constructs a tenant-scoped URL itself.
- **Tailwind v4** — consumers import `styles.css`, whose `@source "./dist"`
  makes their Tailwind build scan the package (see the file header for setup).

## Import guard

`npm run guard` (also part of `check-types`, a hard CI gate) fails the build if
package code imports app internals (`@/features/*`), Next.js, or Alfresco-shaped
code — or if anything under `src/core/` imports React.
