---
name: miot-capabilities
description: >
  What ModularIoT is, its modules, where its documentation and code live, and
  how to read the product's own source to answer how a feature works.
when_to_use: >
  The user asks what ModularIoT (MIOT) can do, how a feature or module works,
  where a value is computed or stored, or which part of the product handles
  something. Also when you would otherwise answer "I have no access to the
  source code".
---

# ModularIoT capabilities

ModularIoT is an operations platform for fleets and assets. It takes
telemetry from devices and systems, turns it into canonical metrics, detects
operational conditions (symptoms), and gives operators screens and workflows
to act on them. It is multi-tenant: each organization's data is kept apart.

You can read the product's source code and documentation with
`source_list`, `source_search` and `source_read` (repository `modulariot`,
branch `trunk`). Use them; do not say you have no access to the code.

## Modules

| Module | What it does | Where to look |
|---|---|---|
| Telemetry and metrics | Ingestion from GPS, CAN/OBD, gateways and OEM APIs; drivers normalize data into canonical metrics | `quarkus-srv/miot-driver`, `quarkus-srv/miot-gateway`, `quarkus-srv/miot-tracking`; docs `integration/` |
| Symptoms | Stateful detection of operational conditions with severity, lifecycle and escalation | `quarkus-srv/miot-symptoms`; docs `concepts/symptoms/`, `platform/symptoms-engine/` |
| Control tower | Fleet map, active symptoms, asset list, operator worklists and actions | `turbo-repo/apps/app/src/features/symptoms`, `geographic-view`; docs `operations/mission-control/` |
| Fleet and shipping board | Vehicles, trailers, drivers, trips and shipping tasks on a board | `quarkus-srv/miot-fleet`, `turbo-repo/apps/app/src/features/fleet-management`, `shipping`, `ext-tasks` |
| Calendar | Calendars, time windows, slots and bookings | `turbo-repo/packages/miot-calendar-client`, `miot-calendar-ui`, `apps/app/src/features/calendar`; docs `reference/sdks/miot-calendar-client.mdx` |
| Dashboards | Dashboards over datasources; UI, server and contract packages | `turbo-repo/packages/miot-dashboard-*`, `apps/app/src/features/dashboard`; docs `operations/dashboard-server/` |
| Integrations and connections | External API and database connections, credentials, jobs | `quarkus-srv/miot-integrations`, `turbo-repo/packages/miot-connection-client`, `apps/app/src/features/integration-config` |
| Option lists (selectables) | The choices behind form fields, static or read from a connection | `quarkus-srv/miot-core` (search `selectable`); skill `selectables` |
| Conversations | WhatsApp gateway and inbox | `quarkus-srv/miot-conversational`, `apps/app/src/features/whatsapp*` |
| Chat (ASK MIOT harness) | This assistant: model loop, typed tools, skills, memory | `miot-harness/`, `apps/app/src/features/harness-chat`; docs `platform/ask-miot-harness/` |
| Storytelling | Narrative reports built from dashboard data | `apps/app/src/features/storytelling` |

Paths under `turbo-repo/apps/docs/content/` exist in `en/` and `es/`, for
example `turbo-repo/apps/docs/content/es/introduction/core-capabilities.mdx`.
The sections are `introduction`, `concepts`, `platform`, `integration`,
`operations` and `reference` (glossary: `reference/glossary.mdx`).

## Answering "how does X work" or "where is X computed"

1. Docs first: `source_search` the term in `turbo-repo/apps/docs/content/<lang>`
   and `source_read` the page.
2. Then code: `source_search` names the code would use (English identifiers,
   e.g. `eta`, `estimatedArrival`, `arrival`), narrowed with `path` or `glob`
   (`**/*.java`, `**/*.ts`, `**/*.sql`). Try two or three spellings before
   concluding.
3. `source_read` the lines that matter and explain them in plain words.
4. Cite each file as a url block with the `url` that `source_read` returned,
   or as `path:line` when it returned none.
5. If the search finds nothing, say that this repository does not contain it:
   some processes run in other systems (a workflow engine, a data warehouse
   job, a database function). For a database function, try the connection's
   `<connection>_functions` and `<connection>_definition`.

Keep the answer about behavior; quote code only when a line is the answer.
