# Calendar as an async projection of the kanban stage (Phase 2)

**Status:** IN PROGRESS — sub-step **2a (modulith `ensure` op) implemented**; 2b–2d (ECM) not started. Depends on Phase 1 (modulith execution) landing first.

## Where this sits on the roadmap

One linear roadmap for getting the calendar correct **and** off ECM:

| Phase | What | State |
|---|---|---|
| **0** | CALSYNC: async `calendar_sync` **status** pushes (PATCH), reconciler, booking `status` column. Executed on ECM. | ✅ shipped |
| **1** | Move `calendar_sync` **execution** to the modulith (executor lane `modulith` + generic `ModulithJobHandler` registry). | 🔄 **current** — modulariot #929 merged; ECM lane-flip #311 open; dev deploy/validate pending |
| **2** | **This doc.** Booking **create/move/cancel** become async `ensure` jobs too; the sync `#266` listeners collapse into enqueuers; the calendar becomes a retryable projection of the kanban stage. | 🔄 in progress — 2a (modulith `ensure` op) done; 2b–2d (ECM) pending |

> Separate **execution-scale track** (parallel, not on the correctness path): relocate other job types (`whatsapp`, later `alerce`) to modulith handlers; add broker wake (ActiveMQ/Pulsar). The Phase-1 doc's "Phase 2+" list refers to *that* axis, not this one.

**We are finishing Phase 1.** This plan is Phase 2.

## Problem (why Phase 1 isn't enough)

Today's calendar lifecycle is split across two mechanisms with a hidden coupling:

```
create/move/cancel = SYNC, soft-fail, NO retry   (assignDriver / unplanned — #266 listeners)
status pushes       = ASYNC, patch-only          (presentDriver+ — calendar_sync)
```

- The **create** — the most failure-prone step (slot availability, miot-calendar reachability) — is the one step that's **synchronous and non-recoverable**. On no-slot or a transient error it logs one warn, skips, and the workflow advances anyway. No retry, no reconcile-create.
- The async status pushes only **PATCH**; they never create. So when the sync create fails, every later push hits a missing booking → 404 → benign SKIP. The resilient layer can't recover the fragile layer's failure.

Result: the calendar sits empty and self-heals for **no** service whose create failed (observed: service 1586586, no slot in the ETD window).

## Goal

The calendar is a **retryable async projection of the kanban stage**. Every stage transition enqueues a self-contained `calendar_sync` job that **ensures** the booking (create-if-absent at the right slot, re-slot if moved, set the stage status) — executed off ECM (modulith) with backoff + reconciler backfill. The workflow just advances and enqueues; it never depends on a synchronous calendar call succeeding.

## Design

### 1. `ensure` (upsert) job semantics — modulith executor ✅ (2a, as built)
Extend the `calendar_sync` payload and `CalendarSyncExecutor`:
- **Payload** gains a self-contained slot snapshot: `calendarId`, `resourceId`, either an explicit slot (`slotDate/hour/minutes`) or an `etd` for auto-pick, plus `targetStatus` and `op`.
- **Ops:** `ensure` (new) and `cancel` (exists). `move` folds into `ensure` — it's idempotent by `(calendarId, resourceId)`, so "re-slot" is just an ensure whose slot differs.
- **Executor `ensure`:** find booking by `(calendarId, resourceId)` → absent ⇒ create (explicit slot, or `pickSlotFromEtd` at **run time**); present & an **explicit** slot differs ⇒ move; then PATCH status (forward-only, 404/409 benign).

> **As built (deviation from the first draft).** The upsert is a **new `ensure` op**, *not* a change to `patch`'s 404 behavior. A status-only `patch` payload carries no slot, so it can't create-if-absent — only the richer `ensure` payload can. So `patch`/`cancel` stay exactly as they were (legacy status pushes remain 404-skip), and ECM opts a stage into upsert semantics by enqueuing `ensure` instead of `patch` (that's 2b). The modulith side is additive and backward-compatible: it merges and deploys before ECM ever emits an `ensure`.
>
> `CalendarBookingsClient` gained `create` / `move` / `listAvailableSlots` (+ `AvailableSlot`), ported from ECM's `MiotCalendarBookingsClient`. Slot resolution is deliberately asymmetric: a **create** may auto-pick from the ETD (a retry re-picks against fresh availability → self-heal); an **existing** booking only moves for an *explicit* slot, never for the drifting ETD pick. No-slot policy: ETD present but no capacity ⇒ **throw** (retryable, self-heals when a slot frees); no explicit slot and no/unparseable ETD ⇒ **SKIPPED** (terminal — nothing to act on).

### 2. `#266` sync listeners → enqueuers — ECM
- `OnCreateAssignDriverBinding`: replace the synchronous `.create()` with `enqueue(ensure, status=planned, slot|etd snapshot)`.
- `OnAssignDriverMoveBooking`: fold into the same `ensure` enqueue (the executor re-slots); remove as a distinct sync step.
- `OnCreateUnplannedBinding`: replace the synchronous cancel with `enqueueCancel` (already the pattern); `markNone` stays a local binding-row write.
- Existing status enqueuers (`presentDriver`=ASSIGNED, `monitorTrip`=IN_TRANSIT, `confirmArrival`=ARRIVED, `finished`=FINISHED) keep firing but as `ensure(status=X)` so an early push creates-if-absent rather than 404-skipping.

### 3. Drop the synchronous `bookingId` process var dependency
Today the sync create writes `mintral_calendarBookingId_<calendarId>`, read by move-on-replan. With async `ensure`, the executor owns idempotency by `(calendarId, resourceId)` (it already looks up via `findByResource`/`listByResource`), so the var isn't needed for correctness. Audit other readers (UI, listeners) before removing; the executor no longer relies on it.

### 4. Reconciler backfills the planned/created state — ECM
Extend `JobReconcileCalendarSync` to derive expected `ensure` jobs for services in `assignDriver+` with no booking (not just terminal statuses). This is the safety net that turns "no slot right now" into "booked when a slot frees."

### Key decision: ETD auto-pick at **execute** time
`pickSlotFromEtd` runs in the executor (snapshot the ETD, not the chosen slot). A retry re-picks against **fresh** availability, so "no slot now" self-heals when capacity frees. (Snapshotting the slot at enqueue would freeze a stale/no-slot decision — the current bug, just moved.)

## Sub-steps (each shippable behind the existing outbox flag + executor lane)

- **2a — Executor upsert.** ✅ *Done (modulith).* Additive `ensure` op: create-if-absent (explicit slot or ETD auto-pick at run time), move-if-explicit-slot-differs, then forward-only status. Legacy `patch`/`cancel` untouched. No ECM change; ships behind the executor lane. Tests: `CalendarSyncExecutorTest` (18).
- **2b — Async create at assignDriver.** `OnCreateAssignDriverBinding` enqueues `ensure(planned)` instead of sync `.create()` (ECM). No-slot becomes retryable.
- **2c — Collapse move + unplanned.** Move-on-replan and unplanned-cancel become `ensure`/`cancel` enqueues; drop the `bookingId` var dependency (ECM).
- **2d — Reconciler create-backfill.** Extend the reconciler to created/planned state (ECM).

Do them in order; 2a + 2b already deliver the user's use case (async, retryable create+status per kanban stage).

## Migration / safety

- Rides the existing `mintral.features.integrationOutbox.enabled` flag and the `calendarSync.executor` lane — no new transport.
- Gate the sync→async create switch behind config so it can roll out per env; keep the sync create as a fallback until 2b is validated.
- Rollback at any sub-step: revert the enqueue to the sync call.
- **Not solved by this:** raw calendar capacity. Async turns *silent permanent failure* into *retryable eventual consistency*, but "no slot, ever" still won't book — slot definitions/capacity remain a data concern.

## Open decisions (need a call before 2b)

1. **Dedupe key for `ensure` jobs** — per `(service, stage)` or per `(service, slot-tuple)`? Must let a genuine re-plan re-fire while a re-entry dedupes. (Mirror the ASSIGNED hash-suffix trick.)
2. **Does any business rule need the workflow to BLOCK on no-slot?** Today it soft-fails and advances. If "no calendar slot ⇒ can't assign" must hard-stop, that stays synchronous and is out of scope for async-ification.
3. **`bookingId` var readers** — confirm nothing outside the calendar listeners depends on `mintral_calendarBookingId_*` before removing the write.

## Out of scope

- Execution-scale track (whatsapp/alerce handlers, broker wake).
- miot-calendar slot-capacity configuration/UX.
- Removing ECM's legacy `CalendarSyncJobExecutor` (keep until no `ecm`-lane jobs remain).
