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

## The new detector

`LostSignalScenariosEvalTest` replays synthetic fleets through the lost-signal detector (`docs/lost-signal.md`) and the platform template, with `LostSignalReplay`: frames in arrival order, a simulated clock, a tick every 5 s, in-memory stores, no Docker. Vehicles, senders and positions are made up. Each vehicle first reports for two hours (a slow reporter: four hours off a trip) so its profile is warm, as with the week-long profiles in production.

| Scenario | Expected |
|---|---|
| Abrupt cut at 80 km/h, sender delivers in 3 s, frames every 30 s | Opens 60–120 s after the last frame arrived; level 2 at L (30 min) |
| Slow reporter, a frame every 10 min | No case |
| Engine off at a stop, a frame every 20–40 min | No case |
| Cut inside a cell where two senders' frames arrive delayed; returns after 40 min with the buffer | Level 1 past L (low coverage); `signal_returned` with backfill; not closed |
| Sender that forwards every 20 min, 5 vehicles | No case |
| 5 vehicles of one sender silent at once for 45 min | 5 cases, all at level 1 (group outage) |
| A frame from before the silence arrives 20 min into it | Silence not reset: level 2 at L from the newest frame; no return |

### Differences from the legacy rule

The parity eval above still replays the legacy rule and matches it. The detector differs on purpose:

| Legacy | Detector | Why |
|---|---|---|
| Checks every 5 min | Checks when the vehicle's own deadline passes, then every minute | A cut at speed is seen in 1–2 min |
| Last signal = the last to arrive | The newest frame time; a late frame never moves it back | The legacy bug: buffered frames make the silence jump |
| Threshold per map cell (p75 + 1.5 IQR of gaps) | Expected silence per vehicle and motion, plus the sender's delivery delay | 97% of live silences in the recon were late delivery, not missing data; engine off explains most long gaps |
| Closes at the first check with signal | Only the operator closes; the return is reported to the case | Exacta's protocol: the operator decides after L |
| Opens one case per loss | One case per trip until the operator closes it | `LostSignalCatalogImpactTest`: 59 cases on the 59 traces, against 211 in production |

The scenarios are synthetic. Calibrating on the recon's real arrival order (weeks 1–4, evaluate on 5, per sender) is still to do.
