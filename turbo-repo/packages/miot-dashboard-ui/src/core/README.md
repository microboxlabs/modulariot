# core/

Pure-TS engine layer, exported as the React-free `@microboxlabs/miot-dashboard-ui/core`
entry (and re-exported from the root entry):

- **Color rules** — `color-rule-types/engine/evaluation/helpers`: operator
  vocabulary and rule evaluation for cell/value coloring.
- **Thresholds** — `threshold-types/engine/helpers`: threshold configs built on
  the color-rule engine.
- **Handlebars** — `handlebars-format-helpers` (the dashboard formatting
  helpers plus `createDashboardHandlebars()` / `getDashboardHandlebars()`, an
  isolated `Handlebars.create()` environment: the ambient `handlebars` module
  is never mutated, so host pages and multiple dashboards cannot collide),
  `handlebars-templates` (compile/resolve utilities), `handlebars-validation`
  (expression syntax checking). Helper reference: `../../docs/HANDLEBARS_HELPERS.md`.
- **Columns / filters** — `column-types/helpers`, `column-filter-types`,
  `filter-types/helpers`, `resolve-filter-params`.
- **PgREST** — `pgrest-types/utils/settings-helpers`: request building,
  param handling, row parsing, settings-state builders.
- **Grid math** — `grid-sizing`, `get-next-position`.

**This directory must stay React-free** — enforced by `scripts/guard-imports.mjs`
(runs as part of `check-types`). Keeping the engines free of React is what keeps
a future non-React renderer possible.
