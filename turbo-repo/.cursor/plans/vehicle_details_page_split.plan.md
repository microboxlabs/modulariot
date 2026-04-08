# Plan: Split Vehicle Details into its own page

## Goal
Today, vehicle details is a conditional render inside the fleet-management page, driven by `?vehicle=<plate>` query param. The goal is to make vehicle details a **separate route / page** that can be navigated to (and deep-linked to) independently of the fleet list.

Components can stay under `features/fleet-management/` (keep module ownership — fleet-management owns vehicles), but the **page/route layer** must split.

## Current state (reference)

- Route: `app/[lang]/(secured)/fleet-management/page.tsx` → renders `FleetManagementPage`
- `features/fleet-management/components/fleet-management-page.tsx` holds *all* the logic:
  - Reads `?vehicle` from search params (line 88)
  - Fetches full fleet via `useFleetTrucks({ size: 9999 })` (line 35)
  - Finds `selectedVehicle` in the in-memory list (line 90)
  - If found → renders `<VehicleDetailView>`, else → renders list (lines 111–145)
- `vehicle-detail/*` components live at `features/fleet-management/components/vehicle-detail/`
- Detail header breadcrumb already hard-codes `/fleet-management` as the root (`vehicle-detail-header.tsx:38`)
- Sidebar entry: `features/layout/models/pages.ts:36` — single entry `/fleet-management`
- Vehicle detail backend data is still mock (`vehicle-detail-accordion.tsx` hardcoded) — not part of this split, but flagged below.

## Target state

Two routes, both sharing the same component tree under `features/fleet-management/`:

```
/[lang]/fleet-management              → fleet list only
/[lang]/fleet-management/[plate]      → vehicle detail only
```

Rationale for nested `/fleet-management/[plate]` over a sibling `/vehicles/[plate]`:
- Fleet-management continues to own vehicles as a domain (honors module-ownership rule).
- Breadcrumb `Fleet Management > ABC123` maps naturally to the URL.
- No new sidebar entry needed; deep links back into the list stay trivial.
- Still fully independent page-wise: can be loaded directly without mounting the list.

If a future "vehicles" top-level domain emerges, the route can be moved then.

---

## Phases

Work one phase at a time. Do **not** start phase N+1 until the previous phase is verified (build + manual nav check).

### Phase 1 — Extract list-only page component

**Why first:** the current `FleetManagementPage` mixes list + detail. Splitting it here is a pure refactor with no routing change, so we can verify the list still renders before touching URLs.

1. In `features/fleet-management/components/fleet-management-page.tsx`:
   - Remove the `selectedVehiclePlate` / `selectedVehicle` / `handleBack` logic.
   - Remove the `if (selectedVehicle) return <VehicleDetailView …>` branch.
   - Change `handleSelectVehicle` to `router.push` the new nested route: `${pathname}/${plate}` (use `useParams` to get `lang` if needed, or compute from pathname).
   - Drop the `VehicleDetailView` import.
2. Verify: `/fleet-management` still shows list, clicking a card navigates (will 404 until phase 2).

### Phase 2 — Add the `[plate]` route and page component

1. Create `app/[lang]/(secured)/fleet-management/[plate]/page.tsx`:
   - Mirror the parent route's shape: `RouteGuard` with the same path `/fleet-management` (or decide if we want a different guard path — likely same group is enough; revisit if permissions diverge).
   - `getDictionary(lang)` + read `plate` from params.
   - Render a new client component `<VehicleDetailPage dict={dict} plate={plate} />`.
2. Create `features/fleet-management/components/vehicle-detail-page.tsx` (client):
   - Fetch **only the one vehicle** it needs. Preferred: add a `useFleetTruck(plate)` hook that hits `/api/fleet/trucks/[id]` (endpoint already exists per explore). Fall back to `useFleetTrucks` filtered client-side only if the single-truck hook is blocked.
   - Handle loading / not-found states (render a small "vehicle not found" with a link back to `/fleet-management`).
   - Adapt truck → `Vehicle` via existing `truckToVehicle`.
   - Render `<VehicleDetailView vehicle={vehicle} dict={fleetDict} onBack={…} />`.
   - `onBack` should call `router.push('/<lang>/fleet-management')` — or accept a `useRouter().back()` if we want browser-history behavior. Prefer an explicit push so deep links work.
3. Verify: loading `/fleet-management/ABC123` directly (new tab, no prior list fetch) renders the detail view.

### Phase 3 — Clean up coupling points

1. `vehicle-detail-header.tsx:38` — breadcrumb already points at `/fleet-management`, which is still correct. No change unless we want the plate segment clickable (skip).
2. `VehicleStatusBadge` currently lives at `components/vehicle-grid/vehicle-status-badge.tsx` and is imported by the detail header. This is fine — both routes share the module. **Do not move it** (would violate "don't restructure unrelated code").
3. Remove `onPrevious` / `onNext` props from `vehicle-detail-header.tsx` **only if** they are unused after the split. If they are still wired to TODO prev/next-vehicle UX, leave them — out of scope.
4. Delete any now-dead imports in `fleet-management-page.tsx` (VehicleDetailView, useCallback if unused, etc.).

### Phase 4 — Nav & i18n polish

1. Sidebar (`layout/models/pages.ts:36`) stays unchanged — one entry `/fleet-management` still matches both routes.
2. Confirm active-route highlighting in the sidebar still works for `/fleet-management/[plate]` (most sidebar matchers do `startsWith`, but verify).
3. No new i18n keys needed — `vehicleDetail.*` keys already exist.

### Phase 5 — Verification

- [ ] `/fleet-management` renders list, no vehicle-detail code loaded.
- [ ] Clicking a card navigates to `/fleet-management/ABC123`.
- [ ] Direct load of `/fleet-management/ABC123` works (no prior list fetch).
- [ ] Back button on detail header returns to `/fleet-management`.
- [ ] Browser back button works across the navigation.
- [ ] Unknown plate shows a graceful "not found" state, not a crash.
- [ ] Sidebar entry stays highlighted on both routes.
- [ ] No console errors; build + typecheck clean.

---

## Explicit non-goals

- **Not** moving `vehicle-detail/*` out of `features/fleet-management/` into its own feature module. Keep module ownership; the split is at the **page/route layer only**.
- **Not** replacing the mock data inside `vehicle-detail-accordion.tsx`. Separate backend wiring task.
- **Not** adding a new sidebar entry or permission group for vehicle details.
- **Not** refactoring `VehicleStatusBadge` or any shared component location.
- **Not** implementing prev/next vehicle navigation from the detail view.

## Resolved decisions

1. **Single-vehicle fetch:** Use the existing `/api/fleet/trucks/[id]` endpoint. Phase 2 introduces a new `useFleetTruck(plate)` hook; do **not** fall back to filtering the bulk list.
2. **RouteGuard:** `path="/fleet-management"` covers both the list and `[plate]` nested route. The new `[plate]/page.tsx` reuses the same guard config as the parent.
