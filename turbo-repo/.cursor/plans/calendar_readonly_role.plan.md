# Plan: Calendar read-only role (`GROUP_CALENDAR_VIEWER`)

## Status (2026-05-18)

| Phase | Status | Notes |
|---|---|---|
| 1. Permission plumbing | ✅ done | `pages.ts` updated; three-way comment block added. |
| 2. Viewer-aware grid + chip handlers | ✅ done | `inspectPlannedService` added to context; chip left-click no-ops for viewers; right-click populates sidebar. No live drag/drop existed to gate. |
| 3. Generalize `isReadOnlyView` in sidebar form | ✅ done | Viewer banner key added (en/es). Tabs allow inspection in read-only mode. |
| 4. Context menu (header-only for viewers) | ✅ done | No code change required — existing per-group gates already produce a header-only menu when neither plan nor assign is granted. Comment added. |
| 5. Persist-boundary guard | ✅ done | `confirmService` + `removeService` throw if caller lacks both groups. |
| 6. Backend enforcement | ✅ done | New `requireAnyGroup` helper. POST `/bookings`, POST `/bookings/{id}/move`, DELETE/PUT `/bookings/{id}` all 403 viewers. GET stays open. |
| 7. Alfresco group + docs | ⏳ partial | Inline docs done; **operational step pending**: create `GROUP_CALENDAR_VIEWER` per tenant in Alfresco and assign users. Cannot be done from this commit. |

## URL override for previewing read-only mode

Added after Phase 6: a `?as=viewer` query param lets a user who holds **both** `GROUP_CALENDAR_VIEWER` and one of the mutating groups force the viewer experience without giving up their permissions. The check lives in a single hook — `features/calendar/components/planning/use-calendar-view-mode.ts` — used by `use-planning-grid`, `planning-sidebar-form`, and the persist-boundary guard in `planning-selection-context`. The override collapses effective `canPlan` / `canAssign` to false, so every downstream gate flips into read-only with no further wiring.

Without `GROUP_CALENDAR_VIEWER` the param is silently ignored — it cannot be used to escape missing permissions. The backend (`requireAnyGroup`) is unchanged: it sees the user's real Alfresco groups and remains authoritative. The override is a client-side preview tool, not a security control.

Test path:
- `…/calendar/{id}/planning?as=viewer` → forces viewer UI for users with all three groups (planner + assigner + viewer) or any subset that includes viewer.
- Strip the param → returns to the user's real permissions.

## Operational hand-off (Phase 7 remainder)

1. Create the Alfresco group `GROUP_CALENDAR_VIEWER` for each tenant that needs read-only calendar access. Same scoping pattern as `GROUP_PLANNING` / `GROUP_ASSIGNMENT`.
2. Assign target users to the new group via the existing collaborator-management flow.
3. Smoke-test in browser: viewer should see the Calendar nav entry, right-click a chip to inspect, and never be able to mutate. The backend will 403 any attempted mutation regardless.



## Goal

Introduce a calendar viewer role that can:

- See the calendar nav entry and open the planning view.
- Right-click any planned chip to inspect its details (sidebar opens with the chip's data; minimal context menu).
- Inspect existing assignment + planning fields in the sidebar (rendered as **disabled inputs**, same layout as today).

…and cannot:

- Open the sidebar on an empty slot (left-click on grid does nothing for viewers — there is nothing to inspect).
- Left-click a chip to select it (only right-click works, mirroring the "inspection-first" mental model).
- Trigger any mutation: drag/drop, Asignar, Replanificar, Eliminar, Eliminar asignación, tab Submit buttons, or any underlying create/move/delete booking call.

## Why this design

- The calendar feature already splits permissions into `GROUP_PLANNING` (slot/click + Planificación tab + reassign/delete) and `GROUP_ASSIGNMENT` (Asignación tab + assign actions). A third orthogonal viewer role drops in cleanly.
- The "past day" `isReadOnlyView` flag (`planning-sidebar-form.tsx:320-323`) already proves the visual pattern: existing form layout with mutation surfaces suppressed. We generalize that flag rather than building a parallel view.
- Adding a new Alfresco group keeps Alfresco as the source of truth and matches every other tenant gate in the codebase (no special-cased "absence of groups" logic, no opening calendar to any authenticated user).
- Backend enforcement on the Next.js API routes is the actual safety boundary — UI gating alone leaves the booking endpoints open today (they only check `requireAuth()`).

## Scope decisions (locked in)

| Decision | Choice |
|---|---|
| New Alfresco group | `GROUP_CALENDAR_VIEWER` |
| Chip UX for viewer | Left-click: no-op. Right-click: open sidebar populated with the chip + show a minimal context menu. |
| Sidebar appearance | Existing layout, all inputs `disabled`. Submit/cancel/Asignar/Replanificar/Eliminar buttons hidden. |
| Backend enforcement scope (this plan) | Next.js API routes only (`/api/calendar/bookings`, `/move`, assignment, delete). Quarkus audit deferred (separate ticket if mutations live there). |
| Role scoping | Same multi-tenancy semantics as `GROUP_PLANNING` / `GROUP_ASSIGNMENT`. No new per-calendar granularity. |

## Phases

Work one phase at a time. Do not start phase N+1 until phase N is committed and verified.

### Phase 1 — Permission plumbing

**Files**

- `turbo-repo/apps/app/src/features/layout/models/pages.ts:36` — append `"GROUP_CALENDAR_VIEWER"` to the calendar entry's `requiredGroups` so viewers see the nav item.
- Optionally introduce a constant export `CALENDAR_GROUPS = ["GROUP_PLANNING", "GROUP_ASSIGNMENT", "GROUP_CALENDAR_VIEWER"]` in a small auth-constants module if/when reused. Skip if only two call sites need it.

**Acceptance**

- A user whose Alfresco groups are exactly `["GROUP_CALENDAR_VIEWER"]` sees the Calendar entry in the sidebar.
- Existing users with `GROUP_PLANNING` or `GROUP_ASSIGNMENT` see the entry as before.

### Phase 2 — Grid: viewer-aware slot + chip handlers

**File**: `turbo-repo/apps/app/src/features/calendar/components/planning/use-planning-grid.ts`

- Add `canView = !isLoadingPermissions && hasPermission(["GROUP_CALENDAR_VIEWER"])` next to the existing `canPlan` derivation.
- `handleSelectSlot` (line 116-122): keep the `if (!canPlan) return;` guard. Empty-slot left-click stays a no-op for viewers (intentional — viewers have nothing to inspect on an empty cell).
- Export `canView` from the hook for downstream consumers.

**File**: `turbo-repo/apps/app/src/features/calendar/components/planning/service-event.tsx` (chip component — search for the click/contextmenu handlers)

- Left-click handler: short-circuit if `!canPlan` (so viewers can't `selectChipSlot`). Today this routes through `selectChipSlot` from the grid hook.
- Right-click handler: when `!canPlan && canView`, in addition to `selectChipResource` (visual highlight) and the existing context-menu open, also populate the sidebar with the chip's data. The cleanest path is to introduce a `inspectPlannedService(plannedService)` action on `planning-selection-context` that sets both `selectedSlot` (from the chip's slot) and a "viewing only" service reference — without entering reassign or assign mode.

**File**: `turbo-repo/apps/app/src/features/calendar/components/planning/planning-selection-context.tsx`

- Add `inspectPlannedService(plannedService)` to the context that sets the slot + populates the sidebar's displayed service tuple. Does NOT touch booking state, does NOT call any persist function. Pure read.

**Drag/drop**: identify the drag handlers on chips and grid cells (look for `onDragStart`, `onDrop`, `dnd-kit` usage). Guard with `canPlan` — viewers should not be able to initiate or accept drag.

**Acceptance**

- As `GROUP_CALENDAR_VIEWER` only: left-click on empty cell does nothing. Left-click on a chip does nothing. Right-click on a chip opens the right sidebar populated with that chip + opens the context menu.
- As `GROUP_PLANNING` user: behavior unchanged from today.
- Drag/drop is disabled for viewers (chips not draggable, cells not drop targets).

### Phase 3 — Sidebar: generalize `isReadOnlyView` and disable inputs

**File**: `turbo-repo/apps/app/src/features/calendar/components/planning/planning-sidebar-form.tsx`

- Extend the existing `isReadOnlyView` (line 320-323) to also evaluate true when `canView && !canPlan && !canAssign`. Keep the past-day branch unchanged.
- For every `<input>`, `<select>`, dropdown / picker control inside the Planificación and Asignación tab content, add `disabled={isReadOnlyView}` (or pass through a prop on child components). Disabled styling is already wired via Flowbite.
- Tab triggers (lines 875, 881): for viewers, render both tabs as enabled-but-non-mutating. The current `disabled={!canPlan}` / `disabled={!canAssign}` logic should be widened: if the user is in viewer mode, show tab content read-only instead of disabling the tab outright. Concretely: render tab content gated by `canPlan || isReadOnlyView` / `canAssign || isReadOnlyView`.
- Submit / Asignar / Cancelar action buttons (lines 920-939 and the planning tab's equivalent): hide when `isReadOnlyView` is true. Past-day path already does this — confirm the same hides apply for the viewer path.

**Acceptance**

- As viewer, opening the sidebar via right-click renders both tabs with all fields populated and disabled. No submit / cancel / mutation buttons visible.
- As viewer, switching tabs works and shows the inspectable data on each tab.
- As `GROUP_PLANNING` user clicking a past-day slot: unchanged from today (already read-only).
- As `GROUP_PLANNING` user clicking a future slot: tabs editable, mutation buttons visible.

### Phase 4 — Context menu for viewer

**File**: `turbo-repo/apps/app/src/features/calendar/components/planning/service-context-menu.tsx`

- Add `canView` to the permission set computed at the top.
- Today the menu renders only buttons gated by `canPlan` / `canAssign`. For a pure viewer the menu would render with only the header. Options:
  - **(a)** Skip the menu entirely for viewers — but the user explicitly asked for "right click shows context menu". So:
  - **(b)** Keep the menu open with only the header (service ID) visible and no action buttons. This is consistent and minimal.
  - **(c)** Add a single "Cerrar" (Close) item for clarity.
- Pick **(b)** by default; revisit only if QA finds it confusing.

**Acceptance**

- Viewer right-click renders the menu with the service ID header and no action buttons.
- All existing button visibility (Asignar / Replanificar / Eliminar / Eliminar asignación) behaves identically for users who have the underlying groups.

### Phase 5 — Defense at the persist boundary (frontend)

**File**: `turbo-repo/apps/app/src/features/calendar/components/planning/planning-selection-context.tsx`

- In `persistPlannedBooking` (line 800) and at every entry point that calls into it (look for `createBooking`, `moveBooking` invocations around lines 826-828), add an early guard: if the current user lacks both `GROUP_PLANNING` and `GROUP_ASSIGNMENT`, throw with a clear "Permission denied — viewer role" error and roll back local state. This catches any UI-bypass bug (a stale handler, a future contributor wiring a button without checking) before the network call leaves the browser.

**Acceptance**

- Hand-test: monkey-patch `canPlan` to true in devtools as a viewer, try to submit — the persist call throws and the local state rolls back.

### Phase 6 — Backend enforcement (Next.js API)

**Files** (verify exact paths during implementation):

- `turbo-repo/apps/app/src/app/api/calendar/bookings/route.ts`
- `turbo-repo/apps/app/src/app/api/calendar/bookings/[id]/move/route.ts` (if separate file)
- Any assignment / delete-assignment endpoints alongside.

**Changes**

- Augment `requireAuth()` calls with a `requireAnyGroup(["GROUP_PLANNING"])` for plan mutations (create, move that changes slot/time) and `requireAnyGroup(["GROUP_ASSIGNMENT"])` for assignment-only mutations. Reject with 403 otherwise.
- If a generic helper does not exist, add `requireAnyGroup(groups: string[])` next to `requireAuth` (look in `features/auth/server` or similar). One small helper that fetches the caller's groups (already available via `getGroupsForPerson` per the explore report) and checks intersection.
- A pure `GROUP_CALENDAR_VIEWER` user calling these endpoints directly receives 403.

**Acceptance**

- Curl test as viewer (or a Vitest with mocked session): POST /api/calendar/bookings returns 403.
- Curl test as `GROUP_PLANNING` user: succeeds as today.
- Existing happy-path e2e (if any) still passes.

### Phase 7 — Alfresco group + docs

- Create `GROUP_CALENDAR_VIEWER` in Alfresco for each tenant that needs it (manual step or via the org admin tooling — confirm the operational process before commit).
- Update `CLAUDE.md` (or the equivalent group reference) with the new role and its semantics.
- Add a short note to `pages.ts` near the calendar entry explaining the three-way split: `GROUP_PLANNING` (full), `GROUP_ASSIGNMENT` (assignment-only), `GROUP_CALENDAR_VIEWER` (read-only inspection).

**Acceptance**

- A QA tenant has the group created and a test user assigned. End-to-end flow validated in browser.

## Non-goals

- Quarkus-side authorization audit — separate ticket. Confirm whether `quarkus-srv` mutates bookings; if yes, repeat the Phase 6 pattern there.
- Per-calendar granularity (viewer of calendar A but not calendar B). Same scoping as the other two groups; not in scope.
- New visual styling for the viewer mode (banner, tinted background). Existing disabled-field styling is sufficient. Add later if QA pushes back.
- Read-only access to other modules (kanban, fleet, etc.). Out of scope.

## Risks & open questions

- **Drag/drop discovery**: I have not yet pinpointed every drag-and-drop entry point. Phase 2 implementation needs to grep for `onDrag`, `onDrop`, `useDraggable`, `useDroppable`, `dnd-kit` and confirm each is gated.
- **`requireAnyGroup` helper**: confirm it doesn't already exist before adding. Search `features/auth/server` and adjacent.
- **Context menu UX (b vs c)**: a header-only menu may feel "broken". If QA flags it, switch to option (c) — single "Cerrar" item — without re-planning.
- **`canView` ⇒ `canPlan || canAssign || GROUP_CALENDAR_VIEWER`?** Decide during Phase 2 whether `canView` is "any of the three" (more reusable) or strictly "viewer-only". The plan currently treats it as viewer-only; widen if a downstream consumer needs the union.
