# Calendar-sync worker — running `calendar_sync` off ECM

**Status:** implemented (Phase 1). Off by default.

## Problem

`calendar_sync` jobs (booking-lifecycle status pushes to miot-calendar) were
enqueued on the async-job ledger by ECM and **executed on ECM** by
`CalendarSyncJobExecutor`. Two flaws:

1. **Locality.** The work is a pure HTTP call to miot-calendar — it needs no
   Activiti/Alfresco context — yet it burned ECM CPU/memory, defeating the whole
   point of the outbox (offload ECM).
2. **Latency.** `CalendarSyncEnqueuer` has no fast path, so jobs waited for
   ECM's 30 s poll (`0,30 * * ? * * *`).

## Design (Phase 1 — no broker)

The `async_jobs` table stays the durable queue (dedupe, lease, backoff, CAS).
Three things change:

- **Executor lane.** Every job already carries an `executor` column and the
  `claim` is lane-filtered (`WHERE j.executor = $2`). ECM claims only `"ecm"`.
  We add a `"modulith"` lane: ECM stamps `calendar_sync` with `executor=modulith`
  and the **modulith** claims + runs it in-process. The two lanes never collide.
- **Generic worker + handler registry.** `ModulithJobWorker` claims the
  `modulith` lane and dispatches each job to the `ModulithJobHandler` registered
  for its `job_type` — handlers are discovered via CDI (`Instance<ModulithJobHandler>`)
  and indexed once at construction (duplicate `job_type` fails fast at startup).
  Adding a job type is a new `@ApplicationScoped` handler bean, not a branch in
  the worker (mirrors `ConnectionTesterRegistry`). `calendar_sync` is the first
  handler (`CalendarSyncExecutor implements ModulithJobHandler`).
- **Dispatch = in-process kick + reconciler** (no broker needed, because the
  worker lives in the same process that receives the enqueue):
  - *Fast path:* `OrgAsyncJobsResource.enqueue` → `ModulithJobWorker.onEnqueued`
    kicks a drain on the worker pool the moment a handled modulith-lane job is
    inserted (~ms, no poll wait).
  - *Reconciler:* `ModulithJobWorker.drainScheduled` (`@Scheduled`, default 30 s)
    is the safety net for a lost kick, a restart mid-flight, a due backoff retry,
    and the sole driver in a cron-only topology. Both paths funnel through the
    same lease/CAS-guarded claim, so overlap is safe.

Per-handler readiness (e.g. the calendar base URL) is the handler's own concern
via `ModulithJobHandler.isReady()`; an unknown `job_type` on the lane parks
non-retryable (a retry won't conjure a handler).

A broker (ActiveMQ co-located / Pulsar standalone) buys nothing here: it only
matters for waking a *different* process (ECM), which we are not moving. It is
deferred to Phase 2.

## Files

**Modulith (`miot-integrations`):**
- `jobs/ModulithJobHandler.java` — the SPI: lane constant (`EXECUTOR="modulith"`),
  `jobType()`, `isReady()`, `handle(payload)`.
- `jobs/JobOutcome.java` — terminal outcome (SUCCEEDED/SKIPPED); retryable
  failures are thrown.
- `jobs/ModulithJobWorker.java` — generic worker: CDI handler registry +
  `@Scheduled` reconciler + `onEnqueued` kick + claim/dispatch/report drain.
- `calendar/CalendarSyncExecutor.java` — the `calendar_sync` handler (payload →
  miot-calendar calls; 404/409 benign-skip, else retry). Ported from ECM.
- `calendar/CalendarBookingsClient.java` — JDK-`HttpClient` miot-calendar client
  (`patchByResource`, `listByResource`, `cancel`), ported from ECM.
- `calendar/CalendarSyncFeature.java` — job type + payload keys (kept in lockstep
  with ECM's `CalendarSyncFeature`).
- `persistence/AsyncJobRepository.java` — `claimForExecutor` (tenant-agnostic
  `CLAIM_ANY_TENANT`; the reconciler has no request/tenant scope).
- `service/AsyncJobService.java` — `claimForExecutor` wrapper.
- `api/OrgAsyncJobsResource.java` — fires `onEnqueued` after enqueue.

**ECM (`ecm-coordinator`):**
- `OutboxFeature.CALENDAR_SYNC_EXECUTOR` — the lane-flip property key.
- `CalendarSyncEnqueuer` — stamps the configured lane (default `ecm`). ECM keeps
  `CalendarSyncJobExecutor`, so any in-flight `ecm`-lane jobs still drain.

## Rollout ordering (important)

The lanes are decoupled, so a wrong order strands jobs. Deploy in this order:

1. **Modulith:** deploy, then set
   `MIOT_INTEGRATIONS_MODULITH_WORKER_ENABLED=true` and
   `MIOT_INTEGRATIONS_CALENDAR_SYNC_MIOT_CALENDAR_BASE_URL=<miot-calendar url>`
   (dev: `http://dev-mintral-calendar-miot-calendar:8083`). Until the base URL is
   set the calendar handler is not-ready and the worker idles (logs a warn).
2. **ECM:** flip `mintral.features.integrationOutbox.calendarSync.executor=modulith`.

New `calendar_sync` jobs now run on the modulith. Any `ecm`-lane jobs already in
the ledger keep draining on ECM. To roll back, flip ECM's flag to `ecm`.

## Config keys

| Key | Default | Purpose |
|-----|---------|---------|
| `miot.integrations.modulith-worker.enabled` | `false` | worker master switch |
| `miot.integrations.modulith-worker.claim-every` | `30s` | reconciler cadence |
| `miot.integrations.modulith-worker.claim-limit` | `20` | jobs per drain |
| `miot.integrations.modulith-worker.lease-seconds` | `120` | claim lease |
| `miot.integrations.calendar-sync.miot-calendar.base-url` | *(empty)* | calendar handler idle until set |
| `miot.integrations.calendar-sync.miot-calendar.token` | *(unset)* | optional bearer (calendar handler) |
| `mintral.features.integrationOutbox.calendarSync.executor` (ECM) | `ecm` | lane flip |

## Out of scope

**Execution-scale axis** (where jobs run — this doc's follow-ons):
- `whatsapp_pod_notify` relocation (same machinery; also kills a claim-then-POST-back round-trip).
- `alerce_assignment` (Activiti-coupled writeback — stays on ECM).
- Broker wake (ActiveMQ/Pulsar) for ECM-lane jobs.
- Removing ECM's `CalendarSyncJobExecutor` (keep until no `ecm`-lane jobs remain).

**Correctness axis** (what's async): making booking create/move/cancel async too, so the
calendar is a retryable projection of the kanban stage — see
[`calendar-async-projection.md`](calendar-async-projection.md) (Phase 2). Today those still
run synchronously in ECM and soft-fail with no retry.
