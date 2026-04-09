# Plan: Wire "Eventos Operativos" to `fn_dx_eventos_detalle` via pgrest

## Goal

Wire the "Eventos Operativos" timeline section to real data from `public.fn_dx_eventos_detalle` in `prod_iot_gps`. Same temporary-pgrest pattern as maintenance and telemetry.

## Source function — confirmed

```
public.fn_dx_eventos_detalle(
  p_shared_client_id text    DEFAULT 'Z0XLk...',
  p_patente          text    DEFAULT NULL,      -- REQUIRED (raises error if null)
  p_desde            timestamptz DEFAULT now() - '30 days',
  p_hasta            timestamptz DEFAULT now(),
  p_tipo_evento      text    DEFAULT NULL,      -- category filter
  p_min_icu_code     integer DEFAULT 1          -- severity floor (1=all)
) RETURNS TABLE (16 columns)
LANGUAGE plpgsql STABLE SECURITY DEFINER
```

**Note:** `p_patente` is mandatory — the function raises `"p_patente es requerido"` if called without it. Fleet-wide queries are not supported. Good — it's always a single-vehicle drill-down.

### 16-column output (verified)

| Column | Type | Sample |
|---|---|---|
| `evento_id` | bigint | 2082826 |
| `timestamp_evento` | timestamptz | 2026-04-09 04:05:52 |
| `categoria` | text | `SEÑAL`, `VELOCIDAD`, `OTROS` |
| `symptom_name` | text | `Lost Signal`, `Speed Limit Standard` |
| `duracion_minutos` | numeric | 20.4 |
| `severidad` | text | `Bajo`, `Medio`, `Alto`, `Crítico` |
| `icu_code` | integer | 1–4 |
| `velocidad_detectada` | integer | 95 (speed events only) |
| `limite_velocidad` | integer | 80 (speed events only) |
| `signal_lag` | text | `00:12:40` (signal events, HH:MM:SS) |
| `accumulated_signals` | integer | 4 |
| `detalle` | jsonb | `{"speed": 95, "speed_limit": 80}` |
| `tiene_treatment` | boolean | false |
| `treatment_status` | text | null |
| `treatment_type` | text | null |
| `message` | text | "El vehiculo perdió señal por 00:12:40" |

### Data volume and noise

For SWJK62 (30-day window): **1,969 events** — 99.4% are `SEÑAL/Bajo` (Lost Signal, icu=1). The remaining 0.6% are meaningful (Medio/Alto/Crítico).

For VCPF29: **2,876 events** — similar pattern but with VELOCIDAD events:
- SEÑAL/Bajo: 2789
- VELOCIDAD/Alto: 39, Crítico: 27, Medio: 9, Bajo: 7

**Filtering `p_min_icu_code=2` drops the Bajo noise**, leaving a manageable count of actionable events. Combined with a LIMIT 50, this produces a tight, relevant event feed.

### Severity → EventUrgency mapping

| `severidad` | `icu_code` | `EventUrgency` |
|---|---|---|
| `Crítico` | 4 | `critical` |
| `Alto` | 3 | `critical` |
| `Medio` | 2 | `warning` |
| `Bajo` | 1 | `info` |

### Category enum (observed)

`SEÑAL` (signal loss), `VELOCIDAD` (speed violation), `OTROS` (catch-all). The current mock uses different names (`falla_tecnica`, `evento`, `mantencion`, etc.) — we'll keep the function's categories as-is and add i18n labels.

### Field mapping to current UI

| Mock field | Function source | Notes |
|---|---|---|
| `title` | `message` | Already human-readable Spanish from the function |
| `description` | `symptom_name` | Short technical name as subtitle |
| `urgency` | `severidad` → mapping above | |
| `direction` | — | Not in function. Drop from the UI. |
| `date` | `timestamp_evento` | `formatDateString` |
| `category` | `categoria` | Pass through as-is, new i18n keys |

New fields to surface:
- `duracion_minutos` — event duration, show when > 0
- `velocidad_detectada` / `limite_velocidad` — speed vs limit, for VELOCIDAD events
- `tiene_treatment` + `treatment_status` — whether someone acted on it

## Architecture decisions

1. **Default `p_min_icu_code=2`** server-side — drops the Bajo/SEÑAL noise that dominates 99%+ of events. The user can override via query param if they want the full firehose.
2. **LIMIT 50 most recent** — keeps the payload small. The section has `max-h-150 overflow-y-auto`, so 50 events fill it generously. No server pagination for v1.
3. **`message` is the primary display text** — the function already formats a localized Spanish description. We render it as the timeline item title and avoid duplicating the copy logic.
4. **Category pass-through** — `SEÑAL | VELOCIDAD | OTROS` go into the DTO as-is. The UI maps them to i18n labels via a lookup table, and adds a catch-all for unknown future categories.
5. **Section status from the first few events** — if any event in the list is critical → "critical", any warning → "warning", else "ok". Same logic as the current mock-based `getEventsStatus`, just driven by real data.

### DTO shape

```ts
interface TruckEventItem {
  id: number;
  timestamp: string;           // ISO
  category: string;            // SEÑAL, VELOCIDAD, OTROS, ...
  symptom_name: string;
  duration_minutes: number | null;
  severity: "Bajo" | "Medio" | "Alto" | "Crítico";
  icu_code: number;
  speed_detected: number | null;
  speed_limit: number | null;
  message: string;
  has_treatment: boolean;
  treatment_status: string | null;
}

interface TruckEventsDetail {
  plate: string;
  events: TruckEventItem[];
}
```

Omitted from DTO (too low-level for the overview card): `signal_lag`, `accumulated_signals`, `detalle` (jsonb raw), `treatment_type`. Easy to add later.

## Implementation phases

### Phase 1 — pgrest helper
- `PgrestEventRow` interface (16 columns)
- `fetchTruckEventsDetailByPlate(plate, opts?)` — `POST /rpc/fn_dx_eventos_detalle` with `{ p_patente, p_min_icu_code: 2 }`. Returns array (not single row — this is a list).
- `eventsRowsToDto(plate, rows)` adapter — maps severity → urgency, formats timestamps, strips null fields.

### Phase 2 — Backend route
`GET /app/api/fleet/trucks/[id]/events` — same id-or-plate pattern. Returns the DTO. Query params: `minIcu` (default 2), `limit` (default 50). Orders by `timestamp_evento DESC`.

### Phase 3 — Types + hook
- `truck-events.types.ts` with `TruckEventItem`, `TruckEventsDetail`, `EventSeverity`.
- `useFleetTruckEvents(plate)` — 404-aware SWR hook, 60s dedup.

### Phase 4 — Refactor EventsSection
- Drop `data` + `status` props, take `vehicle` + `dict`.
- Call `useFleetTruckEvents(vehicle.plate)`.
- Badge: count of critical + warning events.
- Timeline: render events from the DTO. Each event's title = `message`, subtitle = `symptom_name` + formatted date + duration when present.
- Speed events: show `velocidad_detectada / limite_velocidad` inline.
- Treatment badge: small chip when `tiene_treatment=true`.
- Loading (skeleton), error (retry), empty (no events banner), loaded states.

### Phase 5 — Accordion cleanup
- Remove `events` from `VehicleDetailData` and `vehicleData` mock.
- Remove `getEventsStatus`.
- Add `getEventsSectionStatus(events)` helper.
- Lift `useFleetTruckEvents` in the accordion for the health overview.
- `getMockSectionStatuses` shrinks to 2 sections (`technicalHealth`, `usage`).

### Phase 6 — i18n
- Add `events.category.SEÑAL`, `events.category.VELOCIDAD`, `events.category.OTROS` labels.
- Add `events.severity.{Bajo,Medio,Alto,Crítico}` labels.
- Add `events.speedExceeded` template: "{speed} km/h en zona de {limit} km/h".
- Add `events.durationMinutes` template: "{minutes} min".
- Add loading/error/empty keys.
- Remove dead mock-era keys (`hardBraking`, `routeCompleted`, `incidentsThisMonth`, `hoursAgo`).

### Phase 7 — Verification

## Resolved decisions

1. **Default `min_icu_code=2`** — confirmed. Drops Bajo noise.
2. **Limit 50** — confirmed.
3. **Language-aware title**: `message` for es, `symptom_name` for en. The adapter includes both in the DTO; the component picks based on the current locale.
