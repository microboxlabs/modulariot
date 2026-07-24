# Job HTTP tracing

The ledger stored a job's **request payload** and a one-line `detail` per
attempt. That is enough to know a push failed, not why: the downstream's status
code and response body — `ERROR_ACCION … "REMOLQUE NO EXISTE"`, a 409
regression, a validation list — were discarded the moment the handler returned.

Each attempt now also carries the HTTP calls it made, under
`attempt_history[].http`, and the console renders them as a timeline in the
job detail's **Attempts** tab.

## Shape

```jsonc
// async_jobs.attempt_history[n]
{
  "at": "2026-07-23T12:44:29Z",
  "outcome": "FAILED",
  "detail": "409 conflict",
  "by": "modulith-worker-3f9c1c2a",
  "http": [
    {
      "at": "2026-07-23T12:44:29Z",
      "method": "PATCH",
      "url": "https://calendar.example/api/v1/miot-calendar/bookings/resource/1658427",
      "status": 409,             // absent when the call never got a response
      "durationMs": 42,
      "requestBody": "{\"status\":\"ASSIGNED\"}",
      "responseBody": "{\"error\":\"status regression\"}",
      "error": null              // set instead of status on a transport failure
    }
  ]
}
```

## How it is collected

`JobHttpTrace` is a thread-local recording window. `ModulithJobWorker` opens one
around `ModulithJobHandler.handle` and closes it in a `finally`; jobs run one at
a time on the thread, so the window needs no correlation and cannot mix two
jobs. `CalendarBookingsClient.send` — the single point every modulith-lane call
leaves through — records each exchange.

Outside a window, `record` is a **no-op**. That is what makes it safe to call
from a client shared with non-job traffic: nothing accumulates when nobody is
listening.

## Deliberate limits

- **Headers are never recorded.** That is where the bearer tokens are, and this
  data is rendered in a browser and lives as long as the job row.
- **Bodies are capped** at `MAX_BODY_CHARS` (4000), **exchanges** at
  `MAX_EXCHANGES` (20) per attempt. Both caps announce themselves in the
  recorded data (`… [N more chars]`, a trailing `note` entry) rather than
  truncating silently.
- Request bodies are stored as sent. They are the same data the row's `payload`
  column already holds, so this is not a new class of stored data — but it is a
  second copy, and it inherits whatever the payload carries.

## Other executor lanes

`ReportJobRequest.exchanges` is part of the REST report contract, so any worker
can send a timeline — including the `ecm` lane, which executes
`alerce_assignment` in ecm-coordinator. The field is optional and additive: a
worker that does not send it reports exactly as before, and the console simply
shows no timeline for that attempt. `AsyncJobService` re-applies the caps to
anything that arrives from outside this JVM, since they are ours to enforce and
not the reporter's.

**ecm-coordinator does not populate it yet** — its Alerce and calendar calls go
through `IntegrationJobClient.report(...)` without exchanges. Adopting it there
is a separate change in that repo: record around the handler's HTTP calls and
pass the list to `report`.
