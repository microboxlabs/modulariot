# Plan: Wire "Uso de flota" to `fn_dx_uso_flota_detalle` via pgrest

## Goal

The "Uso de flota" section of the vehicle detail page currently renders hardcoded mock data from `vehicle-detail-accordion.tsx` (`vehicleData.usage`). This plan wires it to real data from `public.fn_dx_uso_flota_detalle` in `prod-iot-gps`, exposed through the existing pgrest layer — same short-term pattern as maintenance, telemetry, and events. Long-term the data will come from the resource client's realtime metrics path.

## Source function — confirmed

```
public.fn_dx_uso_flota_detalle(
  p_shared_client_id text    DEFAULT 'Z0XLk...',   -- RLS, skip
  p_lookback_days    integer DEFAULT 30,           -- actually used (30-day rolling)
  p_asset_id         text    DEFAULT NULL,         -- filter by patente
  p_solo_piloto      boolean DEFAULT false,
  p_tipo_uso         text    DEFAULT NULL
) RETURNS TABLE (18 columns)
LANGUAGE plpgsql STABLE SECURITY DEFINER
```

Schema `public`, pgrest-callable via `POST /rpc/fn_dx_uso_flota_detalle` with `{ p_asset_id }`. Same auth / invocation pattern as the other three helpers in `pgrest-client.ts`.

### 18-column output (verified against SWJK62, SWJL50, and SIN_DATOS plates)

| Column | Type | Semantics |
|---|---|---|
| `rent_id` | text | Contract id (already on `Vehicle`) |
| `patente` | text | Join key |
| `vehiculo` | text | Display label — unused (already on `Vehicle`) |
| `gm_use_type` | text | Use-type category ("Mixed", "Urbano", ...) |
| `proveedor_gps` | text | Duplicated by telemetry row — **dropped from DTO** |
| `km_actual` | bigint | **Current odometer (km)** — null when SIN_DATOS |
| `has_odometer` | bool | Whether the device reports odometer |
| `max_travel` | int | **Contractual total km allowance (lifetime, not monthly)** |
| `pct_contrato` | numeric | `km_actual / max_travel * 100`; null when SIN_DATOS |
| `desviacion_km` | bigint | `km_actual - max_travel`. Negative = remaining, positive = sobreuso |
| `desviacion_contrato` | text | **4-state enum** — `NORMAL` / `SOBREUSO` / `SUBUTILIZADO` / `SIN_DATOS` |
| `km_periodo` | bigint | km traveled in rolling lookback (30 days) |
| `km_por_dia` | numeric | km/day in the lookback window |
| `dias_con_dato` | int | Days with signal in the lookback window (0–30) |
| `total_senales` | int | Signal count — duplicated by telemetry — **dropped** |
| `pct_estabilidad` | numeric | Stability — duplicated by telemetry — **dropped** |
| `pulsos_por_minuto` | numeric | Pulse rate — duplicated by telemetry — **dropped** |
| `intensidad` | text | **4-state enum** — `ALTA` / `MEDIA` / `BAJA` / `SIN_DATO` |

### Enum distributions (April 2026 snapshot, 334 trucks)

| desviacion_contrato | intensidad | count |
|---|---|---|
| `SUBUTILIZADO` | `BAJA`  | 153 (46%) |
| `SUBUTILIZADO` | `MEDIA` |  98 (29%) |
| `SIN_DATOS`    | `SIN_DATO` |  32 (10%) |
| `SOBREUSO`     | `ALTA`  |  23 (7%)  |
| `NORMAL`       | `MEDIA` |  17 (5%)  |
| `NORMAL`       | `ALTA`  |  11 (3%)  |

**Same SIN-baseline problem.** ~76% of the fleet is `SUBUTILIZADO` and another ~10% is `SIN_DATOS`; rendering either as warning would paint the dashboard yellow on a fleet-wide data-maturity issue, not a per-vehicle problem. Only `SOBREUSO` (7%) is a real vehicle condition — surface that as `critical`; everything else is `ok`.

### Key semantic correction

The current mockup labels its big metric "Total kilometers" and the progress bar "Monthly contractual consumption" with subfields like "Km traveled this month" and "Km remaining this month". **The function's contract is lifetime, not monthly.** `max_travel` (76800 for SWJK62) is the full contract allowance, and `pct_contrato` is cumulative consumption over the vehicle's life. The 30-day window only applies to `km_periodo` / `km_por_dia` / `dias_con_dato`. Labels must be rewritten to avoid misleading the user.

## UI field mapping — "Uso de flota" card

Current mock `VehicleDetailData.usage` shape lives in `vehicle-detail-accordion.tsx` lines 34–45. 9 fields, mostly replaced:

### Drop from the card

| Current field | Why dropped |
|---|---|
| `operationHours` (153) | Not in function. Would need engine-hours aggregation from telemetry; noisy and 89% SIN_SENAL. Drop. |
| `intensityLast30Days[]` (sparkline) | Function returns a single `intensidad` enum, not a daily array. The per-day data exists upstream in `ams.dx_vehicle_day` but calling that directly would be a second RPC — out of scope for v1. Drop the chart; we can add it later via a second helper if users ask. |
| `annualTotalKm` (standalone) | Not in function. **Keep the cell** but compute client-side as `round(km_por_dia * 365)`; relabel as "Proyección anual". Null when `km_por_dia` is null. |

### Map to real data

| UI concept | Source | Notes |
|---|---|---|
| **Header badge** | `desviacion_contrato` + `pct_contrato` | Derived label: `"{pct}% – sobreuso"` / `"{pct}% – uso normal"` / `"{pct}% – subutilizado"` / `"Sin datos"`. |
| **Big card — Kilometraje actual** | `km_actual` | Formatted `N,NNN km`; fallback `—` when null. |
| **Progress bar — Consumo del contrato** | `pct_contrato`, `max_travel` | Label: "Consumo del contrato (meta {max_travel} km)". Bar color switches on `desviacion_contrato`. |
| **Cell 1 — Km últimos 30 días** | `km_periodo` | Fallback `—`. |
| **Cell 2 — Km restantes del contrato** | `-desviacion_km` when `< 0`, else 0 | Descrition shows `desviacion_km > 0 ? "+{n} km sobreuso" : "Dentro del contrato"`. |
| **Cell 3 — Promedio diario** | `km_por_dia` | `N km/día`. Description: `intensidad` label. |
| **Cell 4 — Días con datos** | `dias_con_dato` | `N/30 días`. Description: utilization ratio `(dias / 30 * 100)%`. |
| **Cell 5 — Tipo de uso** | `gm_use_type` | Free text ("Mixed", "Urbano", ...). Small stat replacing `operationHours`. |
| **Cell 6 — Proyección anual** | computed `km_por_dia * 365` | Description: "Estimación basada en los últimos 30 días". Null when `km_por_dia` null. |

### Section header status (accordion color)

```
desviacion_contrato = 'SOBREUSO'  -> critical
desviacion_contrato = 'NORMAL'    AND pct_contrato > 90 -> warning
desviacion_contrato = 'NORMAL'    AND pct_contrato <= 90 -> ok
desviacion_contrato = 'SUBUTILIZADO' -> ok          (majority case)
desviacion_contrato = 'SIN_DATOS'    -> ok          (baseline)
```

Consistent with how maintenance / telemetry treat their SIN_ baselines.

## Architecture decisions

Mirrors the maintenance / telemetry / events integrations verbatim:

1. **Separate API route**: `GET /app/api/fleet/trucks/[id]/usage`. Accepts numeric `mbl_id` (resolved via `fetchTruckCatalogByIdOrPlate`) or plate. 404 unknown, 501 non-pgrest.
2. **DTO shape designed for long-term stability**. Future Java endpoint swaps in with zero frontend diff.
3. **UsageSection self-fetches** via a new `useFleetTruckUsage` hook. Accordion lifts the same hook into its body so HealthSection can read the section status (SWR dedup → 1 network call).
4. **Section status helper** (`getUsageSectionStatus(desviacion, pct)`) lives next to the existing helpers in `vehicle-detail-accordion.tsx`. Replaces the current `getUsageStatus` (which reads from the mock `VehicleDetailData`).
5. **DTO omits duplicated columns** — `rent_id`, `vehiculo`, `proveedor_gps`, `total_senales`, `pct_estabilidad`, `pulsos_por_minuto`. All already surfaced by other sections or on the `Vehicle` object.

### DTO shape (v1)

```ts
export type ContractDeviation = "NORMAL" | "SOBREUSO" | "SUBUTILIZADO" | "SIN_DATOS";
export type UsageIntensity = "ALTA" | "MEDIA" | "BAJA" | "SIN_DATO";

export interface TruckUsageDetail {
  plate: string;

  /** Use-type classification from the upstream catalog (e.g. "Mixed", "Urbano"). */
  use_type: string | null;

  odometer: {
    /** Current odometer (km). Null when SIN_DATOS. */
    current_km: number | null;
    /** Whether the device reports odometer natively. */
    has_odometer: boolean;
  };

  contract: {
    /** Contractual lifetime allowance (km). */
    max_travel_km: number;
    /** Cumulative consumption 0–100+. Null when SIN_DATOS. */
    pct_consumed: number | null;
    /** Signed: positive = sobreuso, negative = within contract. Null when SIN_DATOS. */
    deviation_km: number | null;
    /** Km remaining before hitting contract (0 when already over). Null when SIN_DATOS. */
    remaining_km: number | null;
    status: ContractDeviation;
  };

  period: {
    /** Rolling lookback window in days. */
    lookback_days: number;
    /** Km traveled in the window. Null when no data. */
    km_traveled: number | null;
    /** Average km / day across the window. Null when no data. */
    km_per_day: number | null;
    /** Days with signal in the window (0 — lookback_days). */
    active_days: number;
    intensity: UsageIntensity;
  };
}
```

Intentionally omitted from v1 (additive, land later): per-day km series, monthly breakdown, fuel cost projections. None drive the current card.

## Implementation phases

**Work one phase at a time. Verify before advancing.** Merge commits per-phase.

### Phase 1 — pgrest helper

Append to `app/api/utils/pgrest-client.ts`:
- `PgrestUsageRow` interface — all 18 columns typed verbatim.
- `fetchTruckUsageDetailByPlate(plate)` — `POST /rpc/fn_dx_uso_flota_detalle` with `{ p_asset_id: plate }`, returns first row or null.
- `usageRowToDto(row)` adapter:
  - Passes through `km_actual`, `pct_contrato`, `desviacion_km`, `km_periodo`, `km_por_dia` as nullable numbers.
  - Computes `remaining_km` from `desviacion_km`: `desviacion_km < 0 ? Math.abs(desviacion_km) : 0`.
  - Collapses empty `gm_use_type` string to null.

### Phase 2 — Backend route

Create `app/api/fleet/trucks/[id]/usage/route.ts`. Shape identical to the telemetry route:
1. `requireAuth`
2. 501 when `MIOT_FLEET_SOURCE !== "pgrest"`
3. Numeric `id` → resolve to plate via `fetchTruckCatalogByIdOrPlate`; else treat as plate
4. Call `fetchTruckUsageDetailByPlate`; 404 when null
5. Return `usageRowToDto(row)`

### Phase 3 — Frontend types + hook

- `features/fleet-management/types/truck-usage.types.ts` — `TruckUsageDetail` interface + `ContractDeviation` / `UsageIntensity` unions. Mirrors `truck-telemetry.types.ts` style.
- `features/fleet-management/hooks/use-fleet-truck-usage.ts` — 404-aware SWR hook, 60s dedup. Mirrors `use-fleet-truck-telemetry.ts`.

### Phase 4 — Refactor UsageSection

`features/fleet-management/components/vehicle-detail/sections/usage-section.tsx`:
1. Drop `data` and `status` props. Take only `vehicle` + `dict`.
2. Call `useFleetTruckUsage(vehicle.plate)`.
3. Compute the section status locally via the new shared helper `getUsageSectionStatus` (added next to `getTelemetrySectionStatus` in the accordion file).
4. Four render states: loading (skeleton), error (retry banner), 404/empty (SIN_DATOS shell with banner), loaded.
5. Loaded layout (matches the mapping table above):
   - **Row 1 (big card)**: `Kilometraje actual` from `odometer.current_km`
   - **Row 2 (progress bar)**: `Consumo del contrato` from `contract.pct_consumed`, label includes `contract.max_travel_km`, bar color gated by `contract.status`
   - **Row 3 (6-cell grid)**: 6 KPIs listed above. Cells that can't be computed (null inputs) render with `—` instead of being hidden — unlike telemetry, the 6-cell layout is fixed here because every cell has meaning.
6. **Drop the 30-day sparkline chart and its `echarts-for-react` import.**

### Phase 5 — Accordion cleanup

`vehicle-detail-accordion.tsx`:
1. Remove `usage` from `VehicleDetailData` and the `vehicleData` mock (which should then become `{ general: { health: 50 } }` — consider deleting entirely since `general.health` is also unused; verify).
2. Replace `getUsageStatus(data)` with `getUsageSectionStatus(status, pct)`.
3. `getMockSectionStatuses` now only returns `{ technicalHealth }` — everything else (maintenance, telemetry, events, usage) is merged at the component level.
4. Accordion body calls `useFleetTruckUsage(vehicle.plate)` and merges the computed status into `statuses` alongside the other three.
5. `<UsageSection vehicle={vehicle} dict={dict} />` — two props only.

### Phase 6 — i18n

Add under `fleetManagement.vehicleDetail.sections.usage` (both `en.json` and `es.json`):
- `currentOdometer`, `contractConsumption`, `contractMaxLabel` — labels for row 1/2
- `kmLast30Days`, `kmRemainingContract`, `avgDailyKm`, `activeDaysLabel`, `useType`, `annualProjection` — 6 cell titles
- `contractStatus.{NORMAL,SOBREUSO,SUBUTILIZADO,SIN_DATOS}.label` — badge labels
- `intensity.{ALTA,MEDIA,BAJA,SIN_DATO}.label` — description labels
- `withinContract`, `overuseAmount`, `projectionBasis`, `kmPerDayLong` — value/description copy
- `loading`, `errorTitle`, `errorDesc`, `retry`, `emptyTitle`, `emptyDesc` — state copy

Audit and remove unused keys under the existing `usage` namespace: `kmTraveledThisMonth`, `kmRemainingThisMonth`, `monthlyContractualConsumption`, `limitKmMonthly`, `deviationFromAverage`, `projectedDays`, `kmPerDay`, `intensityLastDays`, `operationHours`, `avgDailyOperationHours`, `utilization`, `estimatedProjection`, `annualTotalKm`, `nearLimit`, `exceeded`, `usageLabel`, `odometerSinceOrigin`, `totalKm`, `avgDaily`, `activeDays` — keep only the ones still referenced after the refactor.

### Phase 7 — Verification

- `tsc --noEmit` clean across all touched files.
- `eslint` clean (1 expected pre-existing `MIOT_FLEET_SOURCE` warning on the new route).
- Probe `/app/api/fleet/trucks/SWJK62/usage` → DTO with `contract.status: "SOBREUSO"`, `pct_consumed: 115.3`, `deviation_km: 11741`, `remaining_km: 0`.
- Probe `/app/api/fleet/trucks/SWJL50/usage` → DTO with `contract.status: "NORMAL"`, `pct_consumed: 90.2`, `remaining_km: 7537`.
- Probe `/app/api/fleet/trucks/SRPF11/usage` → DTO with `contract.status: "SIN_DATOS"`, nulls across `current_km`/`pct_consumed`/`deviation_km`/`remaining_km`/`km_traveled`/`km_per_day`.
- Probe `/app/api/fleet/trucks/NOPE99/usage` → 404.
- Browser: `/fleet-management/SWJK62` → section renders red badge (SOBREUSO 115.3%), cell 2 shows "+11,741 km sobreuso".
- Browser: `/fleet-management/SWJL50` → section renders green/yellow badge (NORMAL 90.2%), cell 2 shows "7,537 km".
- Browser: `/fleet-management/SRPF11` → SIN_DATOS shell with banner, all cells show `—`.
- HealthSection overview shows the new usage status; `getOverallHealthScore` reflects it.

## Non-goals

- **No per-day sparkline chart.** Function returns a single `intensidad` enum; the daily series lives in `ams.dx_vehicle_day` but calling it is a second RPC. Add later if users ask.
- **No "Operation hours" cell.** Not in the function; engine runtime is in telemetry and noisy.
- **No derivation of monthly breakdown from the 30-day lookback.** The window is rolling, not calendar-month. Don't pretend otherwise.
- **No duplication of signal stats.** `total_senales`, `pct_estabilidad`, `pulsos_por_minuto` already render in the Telemetry section.
- **No duplication of GPS provider.** Already in Telemetry.
- **No changes to other sections** (Maintenance / Telemetry / Events / TechnicalHealth untouched).
- **No server-side caching on the new route** — SWR client dedup is enough.

## Open design decisions (flag to user before Phase 4)

1. **Chart removal** — are we OK dropping the 30-day sparkline chart entirely in v1? Alternative is a second helper against `ams.dx_vehicle_day` just for the per-day series, which is a meaningful scope increase.
2. **6th cell** — current proposal is "Tipo de uso" (`gm_use_type`). Alternatives: contracted km (`max_travel` — but it's already in the progress-bar label), or "Estado" (`desviacion_contrato` — but the badge already shows it). Happy to swap if user prefers.
3. **Label copy** — "Consumo del contrato" vs "Avance del contrato" vs "Kilometraje contratado consumido". Spanish copy will be drafted; user to review.
