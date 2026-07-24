# core/

Pure-TS engine layer: color-rule engine, threshold engine, handlebars helpers,
filter/column/pgrest helpers, layout math (populated in phase P3).

**This directory must stay React-free** — enforced by `scripts/guard-imports.mjs`
(runs as part of `check-types`). Keeping the engines free of React is what keeps
a future non-React renderer possible.
