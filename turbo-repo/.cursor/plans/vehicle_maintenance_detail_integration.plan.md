# Plan: Wire "Estado de Mantención" to `fn_dx_mantenimiento_detalle` via pgrest

## Goal

The "Estado de Mantención" section of the vehicle detail page is still rendering hardcoded mock data from `vehicle-detail-accordion.tsx`. This plan wires it to real data sourced from `public.fn_dx_mantenimiento_detalle` in `prod_iot_gps`, exposed through the existing pgrest layer — same temporary-pgrest pattern already used for `/api/fleet/trucks` and `/api/fleet/special-views`.

This is the **short-term integration**. The long-term architecture (projection table `rd_truck_maintenance_state`, bulk-sync pipeline, Java derivations) is documented in `db-scripts/plans/fleet-maintenance-state.md` and is out of scope here.

## Source function — confirmed

```
public.fn_dx_mantenimiento_detalle(
  p_shared_client_id text DEFAULT 'Z0XLk...',
  p_lookback_days    integer DEFAULT 14,    -- accepted but unused
  p_asset_id         text    DEFAULT NULL,  -- filter by patente
  p_solo_piloto      boolean DEFAULT false,
  p_tipo_uso         text    DEFAULT NULL
) RETURNS TABLE (22 columns)
LANGUAGE plpgsql STABLE SECURITY DEFINER
```

Function lives in `public` schema of `prod_iot_gps`. `SECURITY DEFINER` confirmed via `pg_proc.prosecdef = t`, so pgrest can call it as `POST /rpc/fn_dx_mantenimiento_detalle` with the existing M2M JWT (same pattern as `rpc/api_modular_map_positions` already in `pgrest-client.ts`).

### Verified 22-column output

| Column | Type | Sample (SWJK62) | Notes |
|---|---|---|---|
| `rent_id` | text | `OA-0027511` | Contract external id |
| `patente` | text | `SWJK62` | Join key |
| `vehiculo` | text | `SWJK62 — Citroen BERLINGO ... · 2023` | Display label, **not** used (we have brand/model on Vehicle) |
| `description` | text | `BERLINGO M BLUEHDI VU L1 1.5D MT 4X2` | Already on truck |
| `brand_id` | text | `CITROEN` | Already on truck |
| `model_year` | integer | `2023` | Already on truck |
| `km_actual` | bigint | `88250` | **NULL → SIN_INFO** |
| `km_os` | integer | `81101` | Last service km; `0` means never serviced |
| `freq` | integer | `10000` | Contractual interval |
| `km_rest_fab` | bigint | `1750` | Remaining vs manufacturer interval |
| `km_rest_os` | bigint | `2851` | Remaining since last service |
| `km_rest_peor` | bigint | `1750` | **Effective remaining** = `LEAST(rest_fab, rest_os)` |
| `km_excedido` | bigint | `NULL` | ABS when remaining < 0 |
| `km_por_dia` | numeric | `0` | 7-day rolling avg |
| `dias_est` | numeric | `NULL` | Days until next service (needs `km_por_dia > 0`) |
| `fecha_est` | date | `NULL` | Estimated next-service date |
| `estado_os` | text | `NULL` | `EN_TALLER` / `AGENDADO` / NULL |
| `dias_en_status` | integer | `NULL` | Days in current WO status |
| `criticidad` | text | `POR_VENCER` | 7-value enum |
| `num_maintance` | integer | `1` | Distinct completed WOs |
| `last_seen_at` | timestamptz | `2026-04-06 13:23:50+00` | Most recent WO close timestamp |
| `km_next_maintance` | integer | `91101` | `freq + km_os` |

### Criticality distribution (April 2026 snapshot, 334 trucks total)

| Bucket | Count | UI treatment |
|---|---|---|
| SIN_INFO | 289 | Empty/stale state — the dominant case |
| AL_DIA | 18 | Green, "Al día" |
| POR_VENCER | 9 | Yellow, "Por vencer" (< 2000 km remaining) |
| AGENDADO | 9 | Blue, "Agendada" (work order created) |
| EN_TALLER | 8 | Orange, "En taller" (WO in progress) |
| VENCIDO | 1 | Red, "Vencida" (remaining ≤ 0) |
| CRITICO | 0 | Red, "Crítica" (< 500 km remaining) |

**~87% of trucks are SIN_INFO.** The UI must render gracefully for that case or users will see a broken card on most vehicles.

## UI field mapping — "Estado de Mantención" card

Current mock shape (`vehicle-detail-accordion.tsx` lines 25–33):

```ts
maintenance: {
  status: "up_to_date" | "due_soon" | "overdue";
  totalKm: number;                  // hardcoded 12450
  nextMaintenanceKm: number;        // hardcoded 55000
  lastManteinanceDate: string;      // hardcoded "2026-01-25"
  contractualFrecuency: number;     // hardcoded 10000
  manteinancesCount: number;        // hardcoded 5
  kmSinceManteinance: number;       // hardcoded 2400
}
```

The current `status` enum (3 values) does not cover the 7 source criticality buckets. It must be extended.

### Mapping

| UI field | Source | Notes |
|---|---|---|
| **Total Mileage** (KPI 1) | `km_actual` | SIN_INFO → render "—" / "Sin datos" |
| **Next Maintenance (km)** (KPI 2) | `km_next_maintance` | Always computable (`freq + km_os`) even without odometer |
| **km remaining (proj X days)** (KPI 2 description) | `km_rest_peor`, `dias_est` | SIN_INFO → hide; days only when `km_por_dia > 0` |
| **Last Maintenance** (KPI 3) | `last_seen_at` | `km_os = 0` → render "Nunca" |
| **at X km** (KPI 3 description) | `km_os` | Suppressed when `km_os = 0` |
| **Contractual Frequency** (KPI 4) | `freq` | Always present |
| **Maintenances Performed** (KPI 5) | `num_maintance` | Always present |
| **Km Since Maintenance** (KPI 6) | `km_actual - km_os` when both > 0; else NULL | SIN_INFO or never-serviced → "—" |
| **% of interval** (KPI 6 description) | `((km_actual - km_os) / freq) * 100` | Only when computable |
| **Badge** | `criticidad` | 7-state mapping (see below) |
| **Banner** | `criticidad` + copy map | One banner variant per bucket |

### Criticality → UI state mapping

Replace the 3-state `status` enum with the source's 7-value enum. The component ships with a single `criticidad → {color, label, bannerVariant, bannerCopy}` map. i18n key structure:

```
fleetManagement.vehicleDetail.sections.maintenance.criticality = {
  AL_DIA:     { label: "Al día",     bannerTitle, bannerDesc }
  POR_VENCER: { label: "Por vencer", ... }
  CRITICO:    { label: "Crítica",    ... }
  VENCIDO:    { label: "Vencida",    ... }
  EN_TALLER:  { label: "En taller",  ... }
  AGENDADO:   { label: "Agendada",   ... }
  SIN_INFO:   { label: "Sin datos",  ... }
}
```

The existing `upToDateBadge`, `dueSoon`, `overdue`, `upToDate`, `upToDateDesc` keys are kept only if still referenced after the refactor; otherwise removed in the same commit.

### Section status (accordion header color)

`getMaintenanceStatus` in `vehicle-detail-accordion.tsx:87` currently returns `ok / warning / critical`. New mapping:

```
VENCIDO, CRITICO           -> critical
POR_VENCER, EN_TALLER      -> warning
AGENDADO, AL_DIA, SIN_INFO -> ok
```

## Architecture decisions

### 1. Separate API route, not inlined into `/api/fleet/trucks/[id]`

**Decision:** New route `GET /app/api/fleet/trucks/[id]/maintenance/route.ts`.

**Why:** Maintenance data is independently loadable, the vehicle detail page can stream it in while the rest renders, and the long-term plan already lands on a separate endpoint (`GET .../trucks/{id}/maintenance` in §8.1 of the architecture doc). Same shape on day 1 means zero frontend churn when the Java endpoint lands later.

### 2. Accept both `mbl_id` and `plate` for the `[id]` segment

**Why:** Mirrors the single-truck endpoint we just shipped. The function only takes `p_asset_id` (= plate), so when called with a numeric `mbl_id`, the route first resolves it to a plate via `fetchTruckCatalogByIdOrPlate` (same helper we already have).

### 3. Progressive loading: MaintenanceSection fetches its own data

**Why:** Scope-constrains the change to the single section. The accordion's other sections still use mock data, and the parent `VehicleDetailPage` stays ignorant of maintenance concerns. When `TechnicalHealth` / `Telemetry` / `Events` / `Usage` get their own backends later, they follow the same pattern. Avoids a big-bang refactor of the accordion's `VehicleDetailData` shape.

Trade-off accepted: the maintenance card will have its own loading spinner, independent of the rest of the page. This is the design doc's intent.

### 4. DTO shape matches the long-term contract (§8.1)

**Why:** The short-term pgrest route and the long-term Java endpoint should emit **identical JSON**. Hook, types, and UI component are written against the long-term shape today; when Java takes over, only the server-side handler swaps. No frontend diff.

**Scoped-down DTO for v1** (we don't ship fields the UI doesn't consume yet):

```ts
interface TruckMaintenanceDetail {
  plate: string;
  contract_external_id: string | null;      // rent_id
  odometer: {
    current_km: number | null;              // km_actual
    km_per_day_7d: number | null;           // km_por_dia
  };
  plan: {
    interval_km: number;                    // freq
    last_service_km: number | null;         // km_os (null when 0)
    last_service_at: string | null;         // last_seen_at (ISO)
    next_service_target_km: number;         // km_next_maintance
    completed_services: number;             // num_maintance
    km_since_last_service: number | null;   // km_actual - km_os, when computable
    pct_of_interval: number | null;         // (km_since_last_service / interval_km) * 100
  };
  remaining: {
    km_effective: number | null;            // km_rest_peor
    km_overdue: number | null;              // km_excedido
  };
  forecast: {
    estimated_days_remaining: number | null;// dias_est
    estimated_service_date: string | null;  // fecha_est (ISO date)
  };
  work_order: {
    status: "EN_TALLER" | "AGENDADO" | null;// estado_os
    days_in_status: number | null;          // dias_en_status
  };
  status: {
    criticality:
      | "AL_DIA" | "POR_VENCER" | "CRITICO" | "VENCIDO"
      | "EN_TALLER" | "AGENDADO" | "SIN_INFO";
  };
}
```

Fields from §8.1 that are **intentionally omitted** for v1: `truck_id`, `entity_id`, `status.label`, `status.description`, `source.system`, `source.snapshot_at`, `source.freshness`, `remaining.km_manufacturer`, `remaining.km_since_service`, `work_order.external_id`, `work_order.since`. None drive the current card. Easy to add later without breaking clients (additive fields).

The `status.label` / `status.description` strings come from frontend i18n instead of server-side copy. When the Java endpoint lands, the frontend i18n can stay (saves a round trip to the server for copy).

## Implementation phases

Work one phase at a time. Verify (typecheck + manual API probe) before advancing.

### Phase 1 — pgrest helper

Add `fetchTruckMaintenanceDetailByPlate(plate)` to `app/api/utils/pgrest-client.ts`:

- `POST ${pgrestBaseUrl()}/rpc/fn_dx_mantenimiento_detalle` with body `{ p_asset_id: plate }`.
- Auth: `Bearer ${await bearerToken()}` (reuses shared AuthToken).
- Returns the first row or `null`.
- Declare a `PgrestMaintenanceRow` interface mirroring the 22 columns.

### Phase 2 — Backend route

Create `app/api/fleet/trucks/[id]/maintenance/route.ts`:

1. `requireAuth()` gate, same as siblings.
2. Read `[id]` param. If numeric, resolve to plate via `fetchTruckCatalogByIdOrPlate(numericId)` → `row.patente`. If non-numeric, treat as plate directly.
3. Call `fetchTruckMaintenanceDetailByPlate(plate)`.
4. If `null` → `404 { error: "Maintenance detail not found" }`. Frontend renders empty state.
5. Otherwise, transform via a new helper `maintenanceRowToDto(row)` (lives in pgrest-client.ts alongside the row type) and return `200 <TruckMaintenanceDetail>`.

Non-pgrest fallback: for v1 return `501 Not implemented` when `MIOT_FLEET_SOURCE !== "pgrest"`. The Java endpoint will replace this entirely; no point writing a second code path.

Null handling in the adapter:
- `km_actual IS NULL` → `odometer.current_km = null`, `plan.km_since_last_service = null`, `plan.pct_of_interval = null`.
- `km_os = 0` → `plan.last_service_km = null`, `plan.last_service_at = null` even if the source has a value (never-serviced case).
- `km_por_dia = 0 OR NULL` → `forecast.estimated_*` both null.
- `km_rest_peor` passes through; `km_excedido` passes through (already null when not overdue).

### Phase 3 — Types + SWR hook

Create `features/fleet-management/types/truck-maintenance.types.ts` with the `TruckMaintenanceDetail` interface and the `MaintenanceCriticality` union.

Create `features/fleet-management/hooks/use-fleet-truck-maintenance.ts`:

- `useFleetTruckMaintenance(idOrPlate: string | null | undefined)`.
- SWR against `/app/api/fleet/trucks/${encodeURIComponent(idOrPlate)}/maintenance`.
- Returns `{ maintenance, notFound, isLoading, error, mutate }`.
- Same `notFound` 404-aware fetcher pattern as `useFleetTruck`.
- `dedupingInterval: 60_000` (maintenance data changes slowly; longer than the 30s truck dedup is fine).

### Phase 4 — Refactor MaintenanceSection to fetch real data

`features/fleet-management/components/vehicle-detail/sections/maintenance-section.tsx`:

1. Drop the `data: VehicleDetailData` and `status: SectionStatus` props. Replace with a single `vehicle: Vehicle` prop (already present) plus `dict`.
2. Call `useFleetTruckMaintenance(vehicle.plate)` inside the component.
3. Compute the accordion section status from `maintenance.status.criticality` locally (small helper alongside the component).
4. Render four states:
   - **Loading:** section in its collapsed form with a subtle skeleton in the body.
   - **SIN_INFO / 404:** badge = "Sin datos", body = informative banner explaining the odometer isn't reporting, still shows `plan.interval_km` and `plan.completed_services` if available.
   - **Error:** inline error banner with retry button (calls `mutate()`).
   - **Loaded:** full 6-KPI grid + criticality banner + work-order chip when applicable.
5. New helper `formatKm(n: number | null): string` → `n?.toLocaleString() + " km" ?? "—"`.
6. New helper `getCriticalityBadge(criticality, dict)` with 7-way switch.

### Phase 5 — Accordion cleanup

`features/fleet-management/components/vehicle-detail/vehicle-detail-accordion.tsx`:

1. Remove the `maintenance` field from the `VehicleDetailData` interface and from the `vehicleData` mock constant.
2. Remove `getMaintenanceStatus` and the `maintenance` entry from `SectionStatuses` / `getAllSectionStatuses`.
3. `getOverallHealthScore` loses the maintenance input; temporarily dropped from the score. Add a `// TODO: re-include maintenance status once all sections are live` comment.
4. `<MaintenanceSection vehicle={vehicle} dict={dict} />` — only two props now.

### Phase 6 — i18n additions

Add under `fleetManagement.vehicleDetail.sections.maintenance.criticality`:
- Seven `{label, bannerTitle, bannerDesc}` triples for `AL_DIA`, `POR_VENCER`, `CRITICO`, `VENCIDO`, `EN_TALLER`, `AGENDADO`, `SIN_INFO`.

Add:
- `maintenance.loading` — skeleton label
- `maintenance.errorTitle` / `maintenance.errorDesc` / `maintenance.retry` — error state
- `maintenance.neverServiced` — "Nunca" shown for `km_os = 0`

Remove if now unused after the refactor: `upToDate`, `upToDateDesc`, `upToDateBadge`, `dueSoon`, `overdue` (replaced by the criticality map).

Both `en.json` and `es.json`. Copy drafted from the sample row + source distribution; user can tweak before merge.

### Phase 7 — Verification

- [ ] `tsc --noEmit` clean on all touched files.
- [ ] `curl /app/api/fleet/trucks/SWJK62/maintenance` from the dev server → returns the DTO with `criticality: "POR_VENCER"`.
- [ ] Same for a SIN_INFO plate (pick one from the distribution query) → `criticality: "SIN_INFO"`, KPIs gracefully show `—`.
- [ ] 404 for a bogus plate → frontend renders empty state, not a crash.
- [ ] Navigate to `/fleet-management/SWJK62` in the browser → maintenance card loads with real data, other sections still show mock data unchanged.
- [ ] Accordion header color for the maintenance section matches the criticality mapping.
- [ ] No regressions to the fleet list or the recently-shipped `[plate]` route split.

## Non-goals

- **No projection table.** No `rd_truck_maintenance_state`, no bulk-sync endpoint, no Java `MaintenanceStateCalculator`. The long-term plan still stands; this is the pgrest short-term only.
- **No changes to the other sections** (TechnicalHealth / Telemetry / Events / Usage). They stay on mock data.
- **No event emission.** `MAINTENANCE_CRITICALITY_CHANGED` etc. are a projection-table concern.
- **No fleet-wide list or summary endpoints** (§8.2, §8.3). Only the single-truck detail.
- **No freshness / source metadata in the DTO.** Can be added when the Java endpoint lands.
- **No server-side i18n for status labels.** Frontend i18n owns the copy.

## Open questions

1. **Copy for the 7 criticality banners.** I can draft Spanish + English from the plan doc's phrasing, but the user may have stronger wording in mind — especially for the SIN_INFO case, which is the most user-visible.
2. **Should `p_solo_piloto` be true?** The current list page shows all trucks (~334), so passing the full fleet through the function (`p_solo_piloto = false`, the default) is correct — we'd hit the card for any plate the user clicks. Confirm.
3. **Caching at the API layer.** The list route has a server-side `fleetTrucksCache` with 30s TTL. Should the maintenance route get the same treatment? Leaning **no** for v1 — per-plate cardinality is low per user session, SWR dedup on the client is sufficient, and the pgrest function is fast.
