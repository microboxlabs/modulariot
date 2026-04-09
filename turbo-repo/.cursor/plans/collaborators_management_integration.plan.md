# Plan: Wire collaborators management to `v_modulariot_drivers_tmp` via pgrest

## Goal

The collaborators-management page (`/app/[locale]/gestion-colaboradores`) currently renders 256 hardcoded drivers from `colaborators-mock-data.ts`. This plan wires the grid and the header info on the detail page to real data from `public.v_modulariot_drivers_tmp` in `prod-iot-gps`, exposed through the existing pgrest layer — same short-term pattern as the fleet-management integration (`v_modulariot_trucks_tmp`, `fn_dx_uso_flota_detalle`, etc.). Long-term these drivers will come from the resource client.

KPI cards, monthly evolution, and behavior events remain on mock data in this phase — the view does not expose those dimensions. They'll be wired up when dedicated RPC helpers land (see **Non-goals**).

## Source view — confirmed

```
public.v_modulariot_drivers_tmp    -- temporary stub view
```

pgrest-callable via `GET /v_modulariot_drivers_tmp` with optional filters (`id=eq.*`, `or=(name_driver.ilike.*,cust_account.ilike.*)`, etc.) — same auth + base URL as `v_modulariot_trucks_tmp` in `pgrest-client.ts`.

### 10-column output (verified against rows 1, 2, 11, 12 on 2026-04-09; 334 total rows)

| Column | Type | Semantics |
|---|---|---|
| `id` | int | Numeric driver id (primary key on the temp view). |
| `cod_driver` | text | Driver code — today literally `{id}-{patente}` (e.g. `1-TWHS10`). |
| `name_driver` | text | Display name. Today all rows are the placeholder `Conductor Automatico {patente}`. |
| `score_driver` | numeric | Performance score. All rows are `0.0` in the current snapshot. |
| `cust_account` | text \| null | **Customer RUT** (fleet owner), e.g. `77656970-4`. 19 distinct values. Nullable (~3% null). |
| `rent_id` | text \| null | Contract id (matches `rent_id` on `v_modulariot_trucks_tmp`). Nullable when `cust_account` is null. |
| `is_active` | bool | Active flag. 100% `true` in the current snapshot. |
| `patente_actual` | text | Currently assigned vehicle plate. 1:1 with the truck catalog. |
| `created_at` | timestamptz | View stamp — meaningless (all rows are `2026-04-08T21:40:13.470682+00:00`). |
| `updated_at` | timestamptz | Same as `created_at`. |

### Snapshot distributions (2026-04-09, 334 rows)

- **Row count**: 334 (= truck catalog count — the view is fabricated 1:1 from trucks).
- **`name_driver`**: 100% match the regex `^Conductor Automatico [A-Z0-9]+$`.
- **`score_driver`**: 100% `0.0`.
- **`is_active`**: 100% `true`.
- **`cust_account`**: 19 distinct values including `77656970-4` (majority), `76547643-7`, `76143206-0`, `59090630-1`, ~10 more; ~3% null.
- **`rent_id`**: null iff `cust_account` is null.

### Critical caveats

1. **No driver RUT column.** `cust_account` is the *customer* RUT (fleet owner), not the driver. The "search by RUT" requested in the task has to use `cust_account` as a proxy — searching by driver RUT is not possible against this view.
2. **No email, rank, punctuality, safety, or incidents columns.** The `Colaborator` type has these fields; they map to safe defaults until a richer view or RPC lands.
3. **Placeholder data.** Because every `name_driver` is `Conductor Automatico {patente}` and every score is `0`, the grid will look uniform in dev. This is upstream data quality, not a bug on our side.
4. **View is temporary.** The `_tmp` suffix + the frozen `created_at`/`updated_at` timestamps confirm this. The frontend should not depend on column names without a planned migration path.

## UI field mapping

### Drop from the card entirely

These columns exist on the view but have no UI use today:

- `created_at`, `updated_at` — meaningless placeholder timestamps.
- `rent_id` — not surfaced on the grid card (could appear on the detail header if needed later).

### Map to real data

| UI concept (Colaborator field) | Source | Notes |
|---|---|---|
| `id` (string) | `String(row.id)` | pgrest returns int; stringify to match type. |
| `name` | `row.name_driver` | Placeholder today. |
| `score` (0–100) | `row.score_driver` | Currently 0; passed through unchanged. |
| `employmentStatus` | `row.is_active ? "activo" : "suspendido"` | No `vacaciones` mapping (not available). |
| `assignedVehiclePlate` | `row.patente_actual` | Drives the existing "plate" chip in the card. |
| `department` | `row.cust_account ?? ""` | Surfaces the customer RUT until a fleet/company name field exists. |
| `rank` | `"conductor"` (default) | No rank column in the view. |
| `email` | `""` (default) | No email column in the view. |
| `punctuality` / `safety` / `incidentsCount` | `0` (default) | No metrics in the view. |
| `avatar` / `achievements` / `alerts` | `undefined` | Not available. |

### KPI row, monthly evolution, behavior events

Stay on mock data (`getColaboratorsKpis`, `getColaboratorDetailData`). **Not touched by this phase** — see Non-goals.

## Architecture decisions

Mirrors the fleet pattern end-to-end:

1. **pgrest helpers** (`pgrest-client.ts`): add `PgrestDriverRow` shape + `fetchDriversFromView(query?)` + `fetchDriverByIdOrPlate(id)` + `driverRowToColaborator(row)` adapter. Adapter lives next to the row type, same as `usageRowToDto`.
2. **Backend route** (`/app/api/collaborators/route.ts`): feature-flagged on `MIOT_COLLABORATORS_SOURCE=pgrest` (parallel to `MIOT_FLEET_SOURCE`). Accepts `?q=<search>` and forwards to pgrest via `or=(name_driver.ilike.*q*,cust_account.ilike.*q*,cod_driver.ilike.*q*)`. Returns `Colaborator[]` (same shape the mock service returned).
3. **Frontend hook** (`use-collaborators.ts`): SWR-backed, 60s dedup, `errorRetryCount: 2`. Returns `{ colaborators, isLoading, error, mutate }`. Mirrors `useFleetTruckUsage` but for a list instead of a single row.
4. **Page integration**: `colaborators-management-page.tsx` switches from `getColaborators()` (sync mock call) to the hook. The existing client-side grid (filter/sort/infinite scroll) keeps working — the only change is the data source and a new search box wired to a `q` URL param (matches the fleet management search pattern).
5. **Detail page**: Single-driver lookup uses the same list (`colaborators.find(...)`) to avoid a second round trip — the list response is small enough (334 rows, one fetch). No dedicated `/app/api/collaborators/[id]` route yet. Detail content (behavior events, monthly scores) continues to load from `getColaboratorDetailData` (mock) until a dedicated RPC lands.
6. **i18n**: Existing `colaboratorsManagement` dict keys stay unchanged. Only a new `grid.searchPlaceholder` key is added (en + es).

## DTO shape — unchanged

We deliberately **do not** add a parallel `DriverDetail` type. The adapter maps the pgrest row directly into the existing `Colaborator` shape so the rest of the UI (grid, card, detail header) doesn't need to know where the data came from. This mirrors the fleet `pgrestRowToTruck` approach — the swap to pgrest is invisible to downstream components.

## Implementation phases

1. **pgrest helper** — add `PgrestDriverRow` + `fetchDriversFromView({ q? })` + `driverRowToColaborator()` to `pgrest-client.ts`. Unit-tested indirectly via the route below.
2. **Backend route** — create `/app/api/collaborators/route.ts` with `requireAuth()` gate, `MIOT_COLLABORATORS_SOURCE` feature flag, `?q` query param plumbing, and a `STALE_IF_ERROR` cache mirroring `fleet/trucks/route.ts` (60s TTL, 5min stale-if-error).
3. **Client hook** — `features/colaborators-management/hooks/use-collaborators.ts` using SWR.
4. **Page wiring** — replace `getColaborators()` call in `colaborators-management-page.tsx` with the hook. Add loading skeleton + empty state + error banner matching the fleet-detail error pattern.
5. **Search box** — add a debounced input above the grid that pushes the query into `?q=` URL param. Hook re-fetches when `q` changes. 250ms debounce.
6. **Env + docs** — add `MIOT_COLLABORATORS_SOURCE=pgrest` to `.env.storm`. Leave the default in `.env.sample` as unset (follows the "no sensitive defaults" convention).
7. **Verification** — curl the new route with and without `q`, click a driver, verify the detail header shows the real name/plate, confirm filter/sort still work on real data.

## Non-goals

- **KPI cards** (`getColaboratorsKpis`): still mocked. The view has no aggregate data. Dedicated RPC (e.g. `fn_dx_colaboradores_kpis`) will replace the mock in a follow-up.
- **Monthly evolution** (`MonthlyDataPoint[]`): still mocked. Requires a time-series RPC that doesn't exist yet.
- **Behavior events** (`BehaviorEvent[]`): still mocked. Requires joining the `symptom` event table to driver assignment history — not exposed today.
- **Dedicated detail route**: single-driver fetch piggy-backs on the list. Can be split out later if the list grows beyond a few thousand rows.
- **Driver RUT search**: not possible against `v_modulariot_drivers_tmp`. Task is reinterpreted as "search by customer RUT" (`cust_account`).
- **Sorting/filtering pushed to pgrest**: the current filters (`todos`, `activos`, `en-riesgo`, `destacados`, `con-incidentes`) all operate on fields the view doesn't expose meaningfully (everyone is active, everyone has score 0). Leave them client-side.

## Open questions

- **Should we hide the filter chips that no longer discriminate rows** (all rows are active, score 0) until the upstream data becomes real? Current plan: keep them visible so the UI doesn't break when real data lands. Mark for UX review.
- **Does `department` showing a raw RUT (e.g. `77656970-4`) look acceptable on the card?** Alternative: join with a customer-name lookup. Out of scope for phase 1; raise with design if it looks wrong in staging.
