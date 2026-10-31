# Geocoding docs: plan

Not published. `content/` is the only published folder.

## Goal

A reader who has a place written as a geofence code, a Plus Code, coordinates or an address knows
which source will locate it, what it costs, where to configure each part and what to do when it
needs review, without reading the code.

## Audiences

Each page starts with one line: `**Para:** ...` (ES) / `**For:** ...` (EN).

| Audience | Needs |
| --- | --- |
| Developers | API contracts, payloads, errors, idempotency, curl and TypeScript examples |
| Implementers | Set up the connection, the quota and the feed; prepare the spreadsheet; review pending locations |
| Stakeholders | What it solves, cost per trip, risks per country, how it is monitored |

## Style

Model: react.dev Learn and Reference, as in `dashboards-docs-plan.md`.

| react.dev | Here |
| --- | --- |
| "You will learn" list | `<Callout type="info">` at the top of every Learn page |
| Small example first, explanation after | Request + response, then a table that explains it |
| Pitfall box | `<Callout type="warning">` with **Cuidado** / **Pitfall** |
| Deep dive box | `<details><summary>` |
| Reference page per API item | One page per endpoint group, with every field and error |

Writing: `plain-writing` rules. ES and EN in the same PR. ES first, `usted` form.
Examples use the `DOC-GEO-` code prefix, public places and no client names.

## Generic part vs a setup

| Generic (every setup) | Specific to a country or customer |
| --- | --- |
| Resolution order, the district check, the 500 m border | Internal address sources (today: Chile) |
| Cache, quota, usage records, the API contract | Administrative boundaries (today: Chile and Peru) |
| The provider as a connection | The country of each feed |
| Review flow | Location types and their radius |
| | How the customer writes places in the spreadsheet |

Pages in Learn and Reference describe the generic part. Pages about a setup say so in the first line.

## Sidebar

```
Geocodificación                                  products/geocoding/
├─ Resumen                                       index                         Stakeholders
├─ Aprender                                      tutorials/
│  ├─ Su primera ubicación                       first-location                Developers
│  ├─ Cómo se elige la fuente                    resolution-order              All technical
│  ├─ Del punto a la geocerca                    point-to-geofence             Developers, implementers
│  └─ Ubicaciones por revisar                    needs-review                  Implementers
├─ Guías prácticas                               how-to/
│  ├─ Configurar el proveedor                    set-up-provider               Platform owner
│  ├─ Asignar la cuota de una organización       assign-quota                  Platform owner
│  ├─ Revisar ubicaciones pendientes             review-locations              Implementers
│  ├─ Enviar sitios desde un feed                feed-sites                    Implementers, developers
│  └─ Certificar un país nuevo                   certify-a-country             Implementers, stakeholders
├─ Conceptos                                     concepts/
│  ├─ Genérico y específico de cada puesta a punto  generic-and-setup          All
│  ├─ El proveedor como conexión                 provider-connection           Implementers, developers
│  └─ Uso, costo y monitoreo                     usage-and-cost                Stakeholders, platform owner
└─ Referencia                                    reference/
   ├─ API de ubicaciones                         locations-api                 Developers
   ├─ Motivos de revisión                        review-notes                  Developers, implementers
   ├─ API de plan y uso                          plan-api                      Developers
   └─ Datos y métricas                           data-and-metrics              Developers, platform owner
```

## Stacked PRs

| PR | Content |
| --- | --- |
| 1 | This plan, overview, navigation (sidebar, Products menu, home card) |
| 2 | Learn |
| 3 | Reference |
| 4 | How-to guides, with screenshots from the demo organization |
| 5 | Concepts: generic vs setup, provider connection, usage and cost |
| 6 | The Origen/Destino cell written as an address or Plus Code, when its code change is up for review |

## Review

Each PR gets two review agents before it is opened:

| Review | Checks |
| --- | --- |
| Code | Every behavior, field, error message and number against `quarkus-srv/miot-trips` and `miot-integrations` |
| Reader | One pass per audience: can they do their task from the page alone |
