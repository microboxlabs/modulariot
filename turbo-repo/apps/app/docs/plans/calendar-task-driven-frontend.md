# Plan — Task-driven calendar planner (frontend repoint)

## 1. Background

The ECM refactor (`ecm-coordinator` #257) inverted control of calendar
plan/assign: ECM **task listeners** now reconcile the calendar binding
automatically on every workflow task move. But the **frontend planner
still drives binding manually** — the bookings BFF calls
`/mintral/calendar/binding` and the planner moves the workflow task
separately, keeping the two in sync by hand.

Until the frontend is repointed, #257's value is not realized: the
binding happens **twice** (once by the front's webscript call, once by
the ECM listener — idempotent, but redundant), and the front still owns
the fragile sync the refactor set out to remove. This plan completes the
inversion: the planner only writes the calendar booking and moves the
workflow task; ECM does the binding.

## 2. Decisions (from product review)

1. **Per-origin feature-flag rollout.** Task-driven mode is enabled per
   origin, mirroring #257's per-origin calendar config
   (`mintral.calendar.<origin>.defaultId`). The old binding-call path
   stays for un-migrated origins and is removed only after all origins
   migrate (a follow-up, out of this plan).
2. **The companion ECM change is a separate issue.** Carrying the assign
   resources into the workflow (so `OnCreatePresentDriverBinding` can
   read them) is tracked as its own `ecm-coordinator` issue with its own
   goal-loop ladder. **Phase 3 of this plan depends on it.**

## 3. Current architecture (verified)

- **Bookings BFF** `src/app/api/calendar/bookings/route.ts` — on a
  booking write: `resolveBooking` → `runCalendarBinding` (→ ECM
  `/mintral/calendar/binding`) → `runTaskAdvance` (→ ECM task end). On
  `stage="assigned"` binding failure it compensates by cancelling the
  just-created booking.
- **Binding payload** — built in `binding-helpers.ts`
  (`extractCalendarBindingPayload`) from the booking's `resource.data`:
  `stage="assigned"` iff `assignedCarrier` + `assignedDriver` +
  `assignedTruck` are all set, else `"planned"`; assigned adds
  `tipo_servicio` / `driver2_id` / `trailer_id`.
- **Planner context** `features/calendar/components/planning/planning-selection-context.tsx`
  — `confirmService` → `persistPlannedBooking` (`createBooking` /
  `moveBooking`, bundling `taskAdvance`); `removeService` →
  `advanceWorkflowTask` (backward transition) → `cancelBooking` →
  `notifyCalendarBinding(stage="none")`.
- **Task moves** — `/app/api/task/end` → ECM `EndTaskWebscript`. The
  webscript reads **only** `taskId` + `transition` request params; the
  BFF route does a *separate* `updateTask` for form fields. Transitions
  are configured in `features/calendar/services/task-stage-transitions.ts`
  (`NEXT_TRANSITION`, `UNPLAN_TRANSITIONS`).
- **Assign resources** (carrier/driver/truck/trailer) ride the booking
  `resource.data` straight into the binding payload — they **never
  become workflow variables**.
- **Permissions** — `useCalendarViewMode()` → `canPlan` / `canAssign` /
  viewer-only.

## 4. Design

### 4.1 Target

When an origin is **task-driven** (flag on): the planner writes the
calendar booking (the slot reservation — unchanged) and moves the
workflow task; it does **not** call `/mintral/calendar/binding`. ECM
listeners reconcile the binding. When the flag is **off**: today's
behavior, unchanged — this is the retro-compat path during rollout.

### 4.2 Per-origin feature flag

The frontend needs a readable signal of "is origin X task-driven?".
The mechanism is settled in Phase 0 — likely a config endpoint or an
env-driven origin list mirroring the ECM
`mintral.calendar.<origin>.defaultId` set. The flag gates every
binding-call removal; default off.

### 4.3 Operation by operation (flag on)

| Operation | Frontend does | ECM listener does |
|-----------|---------------|-------------------|
| Plan      | write booking + move `planService → assignDriver` | `OnCreateAssignDriverBinding` → `markUnassigned` |
| Unplan    | move task back + cancel booking | `OnCreateUnplannedBinding` → `markNone` |
| Assign    | write booking + move `assignDriver → presentDriver` **carrying** carrier/driver/truck/trailer/`tipo_servicio` | `OnCreatePresentDriverBinding` → `markAssigned` (+ Alerce push) |
| Unassign  | move `presentDriver → assignDriver` | `OnCreateAssignDriverBinding` → `markUnassigned` |

No `runCalendarBinding` / `notifyCalendarBinding` call on any of them.

### 4.4 The resource-variable gap (→ ECM companion issue)

`EndTaskWebscript` reads only `taskId` + `transition`. The **assign**
move must convey carrier/driver/truck/trailer/`tipo_servicio` to the
workflow as **process** variables so `OnCreatePresentDriverBinding`
(which fires on `presentDriver` create) can read them — task-local
variables on `assignDriver` would not survive into the next task. The
Phase 0 spike pins the mechanism; the **ECM companion issue** implements
the ECM side. The frontend side: the task-end call carries the resource
tuple. **Phase 3 is gated on the ECM companion landing.**

## 5. Phases (one rung each)

### P0 — Spike (no production code)
- Determine the resource-variable propagation mechanism (extend
  `EndTaskWebscript` to accept variables vs. the BFF's separate
  `updateTask` vs. an `OnCompleteAssignDriverTask` promotion).
- Decide the per-origin feature-flag source.
- **Output:** the ECM companion issue's spec, and a short decision note
  committed to this plan's directory.

### P1 — Per-origin task-driven feature flag
- Implement the flag (frontend can ask "is origin X task-driven?"),
  default off. No behavior change yet.

### P2 — Plan / unplan task-driven
- When the flag is on for the service's origin: skip `runCalendarBinding`
  and `notifyCalendarBinding("none")`; rely on the task move. When off:
  unchanged. Remove the now-dead compensation branch cleanly for the
  flag-on path.

### P3 — Assign / unassign task-driven  *(depends on the ECM companion issue)*
- When the flag is on: carry the resource tuple on the
  `assignDriver → presentDriver` move; skip the binding call.
- Cannot complete/verify until the ECM companion issue has landed.

### P4 — Dev end-to-end verification + docs
- Exercise plan/assign/unplan/unassign in dev against the new ECM, both
  flag-on and flag-off origins. Update the calendar feature docs.

### Follow-up (out of this plan)
- Remove the `/mintral/calendar/binding` path from the front entirely,
  once every origin is migrated.

## 6. Risks & edge cases

- **No half-states.** A flag-on origin must FULLY skip binding; a
  flag-off origin must FULLY keep it. A mix double-binds or zero-binds.
- **Booking ≠ binding.** The miot-calendar *booking* (slot reservation)
  is separate from the ECM *binding* (the service↔calendar workflow
  link). The front still writes the booking — only the ECM binding call
  is removed.
- **Compensation branch.** `bookings/route.ts` cancels the booking when
  `stage="assigned"` binding fails. On the flag-on path that branch is
  dead and must be removed cleanly, not left dangling.
- **P3 hard dependency.** Without the ECM companion, an assign on a
  flag-on origin would move the task but the listener would find no
  resources to push — P3 must not ship before the companion.
- **Permissions unchanged** — `canPlan`/`canAssign` gating stays as is.

## 7. Out of scope

- The companion ECM change itself (separate `ecm-coordinator` issue).
- Removing the deprecated `/mintral/calendar/binding` endpoint.
- miot-calendar booking mechanics.
