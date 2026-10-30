# Dashboards docs: plan

Not published. `content/` is the only published folder.

## Goal

A reader with a design in hand ("KPI per state plus a 100% stacked bar") finds the widget, the
query shape, the settings and the limits without asking anyone.

Gaps found in the current pages:

| Question | Today |
| --- | --- |
| Which widget fits a design | Not answered. The widget catalog lists `componentId`s only. |
| Scalar widgets read only the first row | One sentence in the catalog. No query example. |
| How to pivot rows into columns for a scalar widget | Not documented. |
| How to color each bar or slice | Not documented. |
| Can a chart click filter a table | Not documented (it cannot). |
| How to write the SQL behind a widget | Not documented. BigQuery query editor shipped 2026-10-27. |
| How to embed in Phoenix LiveView | Not documented. |

## Audiences

Each page starts with one line: `**Para:** Implementadores` (ES) / `**For:** Implementers` (EN).

| Audience | Needs |
| --- | --- |
| Stakeholders | What the product does, use cases, what it does not do yet |
| Implementers | Build dashboards in the UI: data, queries, widgets, filters, permissions |
| Developers | Embed: React, web component, Phoenix LiveView; tickets, server, API |

## Style

Model: react.dev Learn and Reference.

| react.dev | Here |
| --- | --- |
| "You will learn" list | `<Callout type="info">` with a short list, at the top of every Learn page |
| Small example first, explanation after | SQL + config block, then a table that explains it |
| Pitfall box | `<Callout type="warning">` with a bold first word: **Cuidado** / **Pitfall** |
| Deep dive box | `<details><summary>` (rendered by Nextra) |
| Reference page per API item | One page per widget: data shape, settings, example, limits |

Components available: Nextra `Callout`, `Steps`, `Tabs`, `Cards`, `FileTree`, `<details>`.
No new components unless one of these cannot do the job.

Writing: `plain-writing` rules. ES and EN in the same PR. ES first.

## Generic product vs a setup

| Kind | Wording | Where |
| --- | --- | --- |
| Generic product | "the dashboard server", "the UI library", "your host" | Learn, Reference, Concepts |
| ModularIoT's own app | "the ModularIoT setup" | Pages that click through the ModularIoT UI say so in the first line |
| Phoenix LiveView host | "a Phoenix LiveView setup" | The LiveView page; no client names, domains or datasets |

## Target sidebar

URLs stay. New pages are added inside existing folders. Folder labels change only in `_meta.ts`.
`reference/widgets.mdx` becomes `reference/widgets/index.mdx`, so its URL does not change.

```
Dashboards
├─ Resumen                                   index                       Stakeholders   (a, rewrite)
├─ Primeros pasos                            getting-started/
│  ├─ Elegir su camino                       choose-a-setup              All            (a, rewrite)
│  ├─ Inicio rápido                          quickstart                  Developers     (keep)
│  └─ Instalación                            installation                Developers     (keep)
├─ Aprender                                  tutorials/   (label change)
│  ├─ Su primer dashboard                    first-dashboard             Implementers   (b, rewrite)
│  ├─ Elegir un widget                       choose-a-widget             Implementers   (c, new)
│  ├─ Consultas para widgets                 queries-for-widgets         Implementers   (c, new)
│  ├─ Incrustar en una página web            embed-in-a-web-page         Developers     (keep; React + web component)
│  └─ Incrustar en Phoenix LiveView          embed-in-phoenix-liveview   Developers     (e, new)
├─ Guías prácticas y recetas                 how-to/      (label change)
│  ├─ (existing how-to pages)                                            mixed          (keep)
│  ├─ Desglose por estado: KPI + barra       recipe-status-breakdown     Implementers   (f, new)
│  ├─ Filtrar una tabla por estado           recipe-filter-table         Implementers   (f, new)
│  ├─ Top N en barra horizontal              recipe-top-n                Implementers   (f, new)
│  └─ Un color por estado                    recipe-colors-per-state     Implementers   (f, new)
├─ Conceptos                                 concepts/                   mixed          (keep)
├─ Despliegue                                deployment/                 Developers     (keep)
├─ Referencia                                reference/
│  ├─ Widgets                                widgets/index               Implementers   (d, catalog + "which page")
│  │  ├─ Stacked Stat                        widgets/stacked-stat                       (d)
│  │  ├─ Chart v2                            widgets/chart-v2                           (d)
│  │  ├─ Data Table                          widgets/data-table                         (d)
│  │  ├─ Stat (scalar family)                widgets/stat                               (d)
│  │  └─ (later) Text, Info card, Data list, Chart v1                                   (after d)
│  ├─ Plantillas                             templates                   Implementers   (d, new: helpers, `row`, `filter`)
│  └─ (existing reference pages)                                         Developers     (keep)
├─ Solución de problemas                     troubleshooting                            (keep, add widget rows in c/d)
└─ Versiones y compatibilidad                releases                                   (keep)
```

## Pages

| Page | Purpose |
| --- | --- |
| Resumen | What the product does, three use cases, what it does not do yet, links per audience |
| Elegir su camino | Three paths (stakeholder, implementer, developer) and three setups (ModularIoT, standalone server, library in your backend) |
| Su primer dashboard | In the ModularIoT setup: SQL query → saved query → Stacked Stat + Data Table + select filter. Screenshots per step |
| Elegir un widget | Design → widget table ("KPI per state + 100% bar" → Stacked Stat). What each widget reads (first row vs all rows) |
| Consultas para widgets | Query shape per widget family: table = many rows; scalar = first row, pivot with `SUM(CASE …)`; chart = x column + one column per series; percentages; filters as parameters (BigQuery `@param` and PostgREST) |
| Incrustar en Phoenix LiveView | Server, ticket auth, mount, JS hook, events, theming; table "LiveView setup vs ModularIoT setup" |
| Recetas | Four recipes from the client design, each with SQL, config and screenshot |
| Widget pages | What it shows, data shape, every setting, full example (SQL + config + screenshot), limits |
| Plantillas | `{{column}}`, `{{row.column}}`, `{{filter.key}}`, helpers (`formatNumber`, `toFixed`, `formatDate`, …) |

## Screenshots (widget pages and recipes)

Every widget page has a table, then the screenshots:

| Variant | Settings | Query shape | Screenshot |
| --- | --- | --- | --- |

One screenshot per meaningful combination of settings. Each variant lists the settings used and the
query that feeds it. Taken in modulariot.com/app with demo data (no client data), light theme,
cropped to the widget.

Path: `apps/docs/public/dashboards/<widget>/<variant>.png`. Examples:

| Widget | Variants |
| --- | --- |
| `stat_stacked` | `bar`, `donut`, `no-header`, `templated-labels` |
| `chart_v2` | `bar`, `bar-horizontal`, `bar-stacked`, `line`, `mixed-bar-line`, `dual-axis`, `pie`, `gauge`, `palette`, `custom-colors`, `color-rules`, `legend-off`, `bar-labels` |
| `data_table_v2` | `basic`, `column-filters`, `color-rules`, `row-actions`, `csv-export` |
| `stat_*` | one per widget, plus `thresholds` |

Existing pages get a screenshot where it helps (first dashboard, add filters, saved queries).
Tutorial screenshots: `public/dashboards/tutorial/<step>.png`.

Browser access: the sign-in at modulariot.com/app uses social login. Screenshots wait for a
signed-in session. Pages ship with the screenshot table and the image paths listed; a
missing image is a TODO in the PR body, never a broken `<img>`.

## Product gaps filed

| Issue | Gap |
| --- | --- |
| #2240 | Chart v2 per-category colors; in the ModularIoT setup a pie color paints every slice |
| #2234 | Chart click sets a dashboard filter (drill-down to a table) |
| #2235 | Cards layout for the Stacked Stat legend |
| #2236 | Scalar widgets read only the first row |
| #2237 | BigQuery optional filters: `omitWhenEmpty` fails, empty test value is `NULL` |
| #2238 | ModularIoT widget settings: "Planner" label, hard-coded English, demo defaults |
| #2239 | Editing UI for non-React hosts (LiveView) |

Screenshot variants that the ModularIoT UI cannot produce (Chart v2 palettes: the UI always saves
`colorPalette: "custom"`) are built by importing a JSON document, and the page says so.

## PR order

Each PR is stacked on the previous branch. Draft until the user asks otherwise.

| # | Branch | Content | Base |
| --- | --- | --- | --- |
| 0 | `task/dashboards-docs` | This plan | `trunk` |
| a | `docs/dashboards-a-overview` | Resumen + Elegir su camino; sidebar labels | `task/dashboards-docs` |
| b | `docs/dashboards-b-first-dashboard` | Su primer dashboard (ModularIoT setup) | a |
| c | `docs/dashboards-c-queries` | Elegir un widget + Consultas para widgets | b |
| d | `docs/dashboards-d-widget-reference` | Widget pages + Plantillas + screenshots | c |
| e | `docs/dashboards-e-liveview` | Incrustar en Phoenix LiveView | d |
| f | `docs/dashboards-f-recipes` | Four recipes | e |

Per PR: three review subagents (accuracy vs source, newcomer as implementer, plain-writing and
ES/EN parity), then `npm run build` in `apps/docs` and a render check.
