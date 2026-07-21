# Job-failure notifications: REJECTED stamp + WhatsApp rules

Phase 2 of the calendar↔Alerce confirmation work (phase 1: the `calendar_confirm`
chain leg + `sync_status` columns, ecm-coordinator#328). When an async job parks
as FAILED (attempts exhausted or non-retryable), the ledger now *does something*
about it instead of only waiting for the babysitter to notice:

1. **Booking REJECTED stamp** — a parked external push (e.g. `alerce_assignment`)
   stamps the linked calendar booking `syncStatus=REJECTED` with the failure
   detail, so planners see "planned but the downstream system rejected it"
   right on the calendar.
2. **WhatsApp failure notifications** — per-tenant, per-job-type opt-in rules
   ("when jobs of this type park, message these numbers"), configured from the
   jobs console.

Both hang off one seam: a CDI `JobParkedEvent` fired exactly where
`AsyncJobService.report()` parks a job (the single funnel both executor lanes
report through — ECM via REST, modulith via the in-process worker).

## Design

```
report() parks job as FAILED
        │  fire JobParkedEvent (sync, wrapped — can never break the report path)
        ▼
JobParkedObserver
        ├─ reject stamp: parked jobType ∈ reject-stamp list AND has chain_key?
        │     → find the chain's calendar_sync (seq 0) sibling for coordinates
        │     → enqueue calendar_reject   (modulith lane, STANDALONE — no chain_key)
        │
        └─ notification: enabled rule for (tenant, jobType)?  [self-type excluded]
              → atomically claim the rule's throttle slot (last_notified_at CAS)
              → enqueue job_failure_notification (modulith lane, standalone)
```

Everything downstream of the event is itself an async job — retried with
backoff, visible and babysittable in the console like any other work.

### Why the reject stamp is a standalone job, not a chain leg

A chained successor of the FAILED job would be *blocked by it* — the chain gate
only passes SUCCEEDED/CANCELLED predecessors. The stamp must run precisely when
the chain is stuck, so the observer enqueues it outside the chain.

### Recovery loop stays intact

Booking `syncStatus` has deliberately no forward-only rule. Parked push →
`REJECTED`; the babysitter fixes the cause and hits retry; the push succeeds;
the still-blocked `calendar_confirm` leg unblocks and overwrites to
`CONFIRMED`. Dedupe keys carry the parked job's id *and* attempt count
(`reject:{jobId}:{attempts}`, `notify:{ruleId}:{jobId}:{attempts}`) so a
re-park after a failed manual retry stamps/notifies again, while a single park
can never double-fire.

### Which job types stamp REJECTED

Config list `miot.integrations.jobs.reject-stamp.job-types` (default
`alerce_assignment`): only the legs that represent the external push itself.
Not seq 0 (`calendar_sync` parked ⇒ the booking was never patched — nothing to
un-acknowledge) and not `calendar_confirm` (the push was *accepted*; a parked
confirm means the calendar API is down, not that the data was rejected).

### Notification rules

`miot_integrations.job_notification_rules` — one row per
(tenant, job_type, channel):

| column | notes |
|---|---|
| `recipients` | JSONB array of E.164 strings (`+569…`) |
| `enabled` | console toggle |
| `throttle_seconds` | min gap between notifications for this rule (default 300) |
| `last_notified_at` | throttle state; claimed via atomic UPDATE … WHERE, race-safe across pods |
| `template_name` / `language` | optional Meta template; absent ⇒ free-form TEXT (needs an open 24h session — fine for ops numbers that talk to the bot) |

The throttle is claimed at *enqueue* time (observer side): a burst of parks
within the window produces one notification job, not a queue of them. If the
enqueue then fails, the claim is released again (CAS on the exact claimed
stamp, so it can only undo itself) — a claim that produced no job must not
suppress the window's next park. Rules for `job_failure_notification` itself
are never matched (no notify-about-notify loops).

### The WhatsApp handler lives in miot-conversational

Module dependency direction is `miot-conversational → miot-integrations`, so
integrations code cannot inject `WhatsAppMessagingService`. Instead the handler
bean (`JobFailureNotificationHandler implements ModulithJobHandler`) sits in
miot-conversational — the worker discovers handlers CDI-wide, so registration
is automatic. Payload is self-contained (`handle()` doesn't see the job row):
tenantCode, recipients, failedJobType/Id, correlationKey, lastError, template.

Per-recipient outcomes: `send()` never throws on Meta failure (it persists a
FAILED `wa_message` row) — the handler checks each returned status. All
recipients failed ⇒ throw (ledger retries with backoff); partial ⇒ SUCCEEDED
with the failures in the detail, because a retry would re-message the
recipients that already got it.

## Config surface (console)

`OrgJobNotificationRulesResource` under
`/api/v1/orgs/{organizationId}/integrations/console/notification-rules`
(RS256 org-member family, same idiom as the jobs console resource):
`GET` list, `PUT /{jobType}` upsert, `DELETE /{jobType}`. The console gets a
per-job-type "Notify on failure" settings panel (separate PR).

## Rollout

Ships dark: no rules ⇒ notification branch is a no-op; reject stamp only fires
for chains that already carry `calendar_sync` coordinates, and only patches
bookings on deployments that have the `sync_status` columns (miot-calendar
≥ 0.6.2). No flags needed beyond the existing modulith-worker enablement.
