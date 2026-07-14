# Calendar Search — Highlight planned services across calendars

## Goal

Give the calendar a search comparable to the Kanban's, using params the calendar
actually has. Searching does **not** filter the grid — it **highlights** the
matching service where it is already planned, so the planner can find it and
assign its resources.

Search is **multicalendar**: a match planned in another calendar is still found,
and picking it navigates to that calendar + date and highlights it there. The
grid still renders one calendar at a time.

## Locked decisions (2026-07-14)

| Decision | Choice |
|---|---|
| Search UI | Global filter bar (`SectionFilterBar`), same badges as Kanban, params in the URL → deep-linkable |
| Scope | **Multicalendar**: search across all calendars, view one at a time |
| Off-screen matches | Auto-jump to first match + `n of m` prev/next navigator (Cmd+F feel) |
| Non-matches | **Dimmed** (low opacity); matches get a ring |
| Coverage | Planned chips on the grid only. Sidebar keeps its own existing search for unplanned services |

## Key facts established

**Data**
- `plannedServices` (context) holds only the **current** calendar's bookings,
  ±30 days around `?date=` (`planning-selection-wrapper.tsx:386-394`).
  A purely local predicate therefore **cannot** satisfy multicalendar.
- `GET /bookings` — `calendarId` is **optional**; omit it and the backend returns
  bookings across every calendar (`BookingService.getBookings` →
  `Booking.findByDateRange`, "all calendars"). The BFF
  (`app/api/calendar/bookings/route.ts:92`) and TS client
  (`packages/miot-calendar-client/src/resources/bookings.ts:14-20`) already pass it
  through as optional. **No backend change needed for the MVP.**
- `BookingResponse` carries `calendarId` + `slot {date,hour,minutes}` → results are
  self-describing (they know which calendar and when).
- The whole `SelectedService` is round-tripped in `booking.resource.data`
  (Postgres **jsonb**, GIN-indexed).

**Backend lives in a different repo:** `~/sources/microboxlabs/miot-calendar`
(standalone Quarkus, port 8083). Not in this worktree. Any backend change = separate PR.
Per `feedback_issue_in_code_repo`, issues for it go in *that* repo.

**Existing seams we reuse**
- `selectedChipServiceId` / `isChipSelected(serviceId)` — a *visual-only* chip channel,
  deliberately decoupled from sidebar selection
  (`planning-selection-context.tsx:210,741`), already threaded into
  `ShiftOverlayLayer` (`shift-overlay-layer.tsx:46,182`) → every chip.
  Highlight is the same shape, but a **set** instead of a single id.
- `PlanningTitle` already does an in-group calendar route swap
  (`planning-title.tsx:37-47`) — prior art for the cross-calendar jump.
- `use-calendar-url-sync.ts` bridges `?date=` / `?view=` ↔ package `CalendarProvider`.

## Bugs found on the way

1. **The calendar already renders a dead Kanban filter bar.** `SectionFilterBar`
   keys off the *last* path segment (`section-filter-bar-controller.tsx:13,25`).
   For `/calendar/<id>/planning` that segment is `planning` — a registered **Kanban**
   key. So the calendar shows Kanban badges (service, licensePlate, driverId…)
   writing URL params nothing in the calendar reads. P0 fixes this.
2. Stale, zero-importer leftovers from the package extraction (superseded, never
   deleted): `features/calendar/components/planning/planning-week-view.tsx`,
   `planning-month-view.tsx`, `day/day-grid.tsx`, `day/day-event-panel.tsx`.
   Not in scope; delete opportunistically.

## Searchable params (vs Kanban)

**Full parity is not reachable.** The kanban searches an ECM task; the calendar searches
the service blob stored on a booking. They hold different fields.

The blow: `assignedDriver` / `assignedCarrier` / `assignedTruck` store resource **UUIDs**,
not names or RUTs (`task-driven-assign.test.ts`: `assignedCarrier: "carrier-uuid"`). The
`*ExternalId` siblings hold upstream codes — and of those only `assignedTruckExternalId`
(`cami_matricula`) is a genuinely human-typeable **plate**. `assignedDriverExternalId` is
`cond_codigo` and `assignedCarrierExternalId` is `prve_codigo`, not the RUTs the kanban's
`driverId`/`carrierId` badges search.

| Kanban param | Calendar |
|---|---|
| `service` | ✅ `mintral_serviceCode` (stable) / `id` (display) |
| `customer` | ✅ `cliente` |
| `origin` / `destination` | ✅ `origen` / `destino` |
| `licensePlate` | ✅ `assignedTruckExternalId` / `assignedTrailerExternalId` |
| `driverId` (RUT) | ❌ blob has a UUID + `cond_codigo`, no RUT |
| `carrierId` (RUT) | ❌ blob has a UUID + `prve_codigo`, no RUT |
| `originType` | ❌ no equivalent field |
| `date_range` | ❌ redundant — the calendar's date axis *is* the date filter |

Calendar-only additions:
- **`assignment`** (`unassigned` / `partial` / `assigned`) — planned but not yet crewed.
  The headline filter: the whole point of searching the calendar is to find a planned
  service *in order to* assign its resources, so those services have no crew by definition.
- `tipoViaje` (`Sider` / `Doble Sider` / `Rampla`).

**Driver/carrier by name — deferred, needs a join.** `AccreditedResource`
(`services/accredited-resources.service.ts`) maps `resource_id` (UUID) → `resource_name` /
`identifier` / `external_id`, served paginated from pgrest for the assignment combobox.
Searching by driver name means loading that set and joining UUID→name. Doable, but it is a
different job from the stated use case; add it deliberately, not by reflex-copying kanban.

## Architecture

The load-bearing seam is the **search engine**, so the backend swap stays optional:

```ts
searchPlannedServices(params: CalendarSearchParams): Promise<CalendarSearchMatch[]>

interface CalendarSearchMatch {
  bookingId: string;
  calendarId: string;
  calendarName: string;
  slot: { date: string; hour: number; minutes: number; anden?: number };
  service: SelectedService;
}
```

- **MVP impl:** one `listBookings({ startDate, endDate })` call with **no** `calendarId`
  → org-wide set → filter client-side over `booking.resource.data`.
- **Later impl (if payload hurts):** backend `q`/filter params + pagination in the
  `miot-calendar` repo. UI untouched.

Identity: highlight keys off **service id** within the loaded calendar; the jump target
travels as **`?focus=<bookingId>`** (stable, and survives the remount).

**Crossing calendars remounts everything.** Changing the `[calendarId]` segment remounts
`CalendarProvider` / `PlanningSelectionProvider` — `selectedService`, `selectedSlot`,
sidebar state and the bookings cache are all lost. So there is **no in-memory channel
across the jump**: the highlight target must ride in the URL and be applied *after*
`loadBookings` resolves.

## Status (branch `feat/calendar-search`)

P0–P3 are **implemented and committed**. Gates green at each step: `check-types`,
722 vitest tests, and `next build`.

**Not yet driven in a browser.** No runtime verification against a live backend —
the logic is unit-tested (37 new tests) but nobody has watched a chip light up.

Corrections made while building, worth remembering:
- The search window is anchored on **today**, not the viewed date. Anchoring it on
  `?date=` (as originally planned, mirroring the grid) is a **feedback loop**:
  jumping to a match rewrites `?date=` → moves the window → refetches → can change
  the match set → bounces the navigator. Today is stable; stepping never refetches.
- `driver`/`carrier` params were dropped — the booking blob stores resource UUIDs,
  not RUTs (see below).
- The filter-bar registry key is the synthetic `calendar-planning`, not `calendar`,
  or the bare `/calendar` landing page would grow a filter bar.

## Phases

Work one phase at a time. Each ships independently.

### P0 — Fix the filter-bar section collision, register calendar params
- `section-filter-bar-controller.tsx`: resolve the section as `calendar` when the path
  is a calendar route, instead of blindly taking the last segment (which yields `planning`).
- `navegation_params.ts`: add a `calendar` key with the param set above.
- Outcome: the calendar shows the *right* badges. They still do nothing — but the dead
  Kanban bar is gone.

### P1 — Highlight seam in `@microboxlabs/miot-calendar-ui`
- `planning-selection-context.tsx`: add `highlightedItemIds: Set<string>` +
  `focusedItemId: string | null` (+ setters). Keep **separate** from
  `selectedChipServiceId` so right-click selection and search highlight compose.
- `shift-overlay-layer.tsx`: extend `ChipRenderContext` with
  `highlighted` / `dimmed` / `focused`.
- App `planned-service-chip.tsx`: ring on highlighted, `opacity` drop on dimmed,
  stronger ring + `scrollIntoView` on focused.
- **Gotcha (from the extraction):** Tailwind classes added in package src must be
  statically written, not string-built, or the consumer's Tailwind won't scan them.

### P2 — Search engine
- `useCalendarSearch(params)` in the app: cross-calendar `listBookings` (no `calendarId`)
  + client predicate over `resource.data`; returns `CalendarSearchMatch[]`.
- Reads params from the URL (written by the P0 filter bar).
- Feeds `highlightedItemIds` for matches in the **current** calendar.
- **Decide the search window** (backend defaults to today..+30d if dates omitted).
  Bounded and explicit; do not leave it unbounded.

### P3 — Match navigator + cross-calendar jump
- Compact navigator in `planning-header.tsx`: `2 of 5`, prev/next, showing the match's
  calendar name + date.
- Jump: `router.push` to
  `/{lang}/calendar/{calId}/planning?{params}&date={slot.date}&view={view}&groupCode={g}&focus={bookingId}`
- **Gotcha:** recompute `groupCode` for the target calendar (`calendar.groups[0].code`),
  or `PlanningTitle`'s dropdown lists the wrong group and the current calendar won't
  appear in its own picker.
- View: preserve the user's view; if `month`, drill to `day` (month caps chips at 3 +
  "+N más", so a match can be hidden).

### P4 — (deferred) Backend `q` + pagination
Only if P2's payload proves too heavy. Separate PR in `miot-calendar`.
Note: the existing GIN index is `jsonb_ops` — it accelerates containment/exact match,
**not** `ILIKE` substring. Real text search needs `pg_trgm` + an expression index.

## Risks

- **Payload.** Omitting `calendarId` returns an unpaginated org-wide set, each booking
  carrying a fat jsonb blob. Measure before shipping P2; bound the window.
- **Two search UIs on one page.** The sidebar keeps its own autocomplete (unplanned
  services); the new filter bar searches planned ones. Label them clearly.
- Calendar count is small (tens — `parallelism` exists so docks don't become calendars),
  so the org-wide fetch is probably fine. Verify.
