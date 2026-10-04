# Lost signal: evals

| File | What |
|---|---|
| `production-rule.json` | The legacy SQL rule written as a spec over the `trip_check` source |
| `production-traces.json` | 59 real trips: one check every 5 minutes and the transitions the legacy engine produced |
| `known-gaps.json` | None: every trip matches |

## The production rule

A job runs every 5 minutes (at second 27). For each vehicle on a trip:

| Step | Rule |
|---|---|
| Last signal | The latest signal to arrive, not the one with the latest timestamp |
| Silence | The job's time minus that signal's timestamp |
| Lost | Silence longer than the area's normal gap (p75 + 1.5 × IQR of the gaps seen in that grid cell). Where the area has no data: longer than the vehicle's own p95 gap, and over 5 minutes. |
| Opens | At the first check where the vehicle is lost |
| Level | Whole minutes of silence: 90 → 2, 120 → 3, 180 → 4, else 1 |
| Closes | First check where it is not lost |

## Source field

`trip_check` has `check.signal_lost_minutes` but nothing that says whether that silence is unusual for the area. The traces add `check.signal_lost` (yes/no) as an `extraFields` entry. The catalog's template uses a fixed 30 minutes instead: `LostSignalCatalogImpactTest` pins the difference.

## Arrival order

The legacy "last signal" is overwritten by every signal that arrives, even an older one. When a device sends a buffered signal after a newer one, the silence the job measures jumps back up. The traces replay that, because production did. The new source should use the newest timestamp.

## How the traces were made

From one day of a carrier fleet's trips. Each signal's arrival time came from the database insert time; the area and vehicle statistics from the tables the legacy job reads (unchanged since before that day). A model of the job reproduced 409 of the 422 legacy episodes; a trip was kept when its episodes and case levels matched exactly and it had at least one. Of each run of checks where the vehicle was not lost only the first is kept. Columns: `[seconds, minutes of silence, lost]`. No plates, coordinates, ids or dates.
