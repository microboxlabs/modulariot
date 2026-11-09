# Duty tracker

Counts net driving, the current rest and the duty of a vehicle on an organization's trip, frame by frame, as the GPS database's driving and resting trackers do. The counters are the `trip_check` fields `check.driving_minutes`, `check.resting_minutes` and `check.duty_minutes`, read by the continuous-driving and continuous-resting templates.

| | |
|---|---|
| Code | `duty/DutyTracker` (the counts), `duty/DutyChecks` (the check of a frame), `duty/RedisDutyStore` |
| Runs | In the evaluator (`EvaluatorStream`), on each frame of an organization with a TEST or ACTIVE `trip_check` symptom that reads one of the three fields |
| State | Redis hash `symptoms:duty:<tenant>:<asset>`: `state` (JSON) and `restarts` (a counter). Expires `miot.symptoms.evaluator.episode-ttl` (7 days) after its last write. In memory without a Redis URL |

## Frames

| Frame | Effect |
|---|---|
| No position, position 0,0, device speed outside 0–150 km/h | Not applied |
| Not newer than the last applied frame | Not applied: a replay or an out-of-order frame changes nothing |
| More than 1 h after the last applied frame | Applied as stopped, without the 150 km/h check. The gap is unobserved: rest after a stopped frame, neither driving nor rest after a moving one |
| More than 150 km/h from the last applied frame | Not applied, but kept in the state (`skipped`). If the next frame is within 150 km/h of the kept one and not of the last applied one, the kept frame becomes the last applied one (the time up to it unobserved) and the next frame is applied from it |
| Other | Applied. Moving when more than 2.78 m/s from the previous applied frame (distance over time, not the device speed) |

The time between two applied frames goes to driving when the later frame moves or the earlier one moved, and to rest between two stopped frames. Unobserved time is never driving.

The 1 h is the GPS database's: its gate (the enrichment service) keeps the previous position in Redis for 1 h. After that the next frame has no previous position, so it passes the 150 km/h check and its computed speed is 0. A device that sends its buffered frames newest first after a stop of more than 1 h therefore applies only the newest one, and the stop is not counted as driving. A buffered gap of less than 1 h still counts as driving when the frame before it moved.

The one kept frame includes its trip, so promoting it preserves the trip boundary. After an operator's duty restart, promotion leaves duty uninitialized until the confirming frame. States written before `skipped` was added still load with their counters intact; a kept frame without a trip is treated as unknown. State size stays bounded to the counters and one kept frame. Promotion adds no store reads or writes beyond the confirming frame's normal save.

## Counters

| Field | Rule |
|---|---|
| `check.driving_minutes` | Driving minus what stops pay back. A stop of 24 min or more pays back 2.5 times its length, never more than the driving before it. When all driving is paid back the count starts again; that restart frame publishes 0, and the next frame includes any driving saved by the restart |
| `check.resting_minutes` | Length of the stop in the current duty cycle, from its first stopped frame; 0 while moving. The 8 h frame ends that cycle; a subsequent parked frame starts the rest counter again |
| `check.duty_minutes` | From the first moving frame of the trip, including the interval before it; stops count. A stopped frame that completes 8 h of rest publishes 0 and ends the duty; the next frame starts a new one, which waits for movement |

No trip, or a new trip id, starts all three again. `check.signal_lost_minutes` is 0 and `check.loss` is absent on these checks.

## Zone

`check.geo` is the evaluating organization's `signal.geo` at the frame (`authorized_zone`, `zone`, `risk_zone`, `outside_authorized`), never another organization's. It is absent when the organization has no zones at the frame. Zones do not change the counters: time inside an authorized zone counts, as in the GPS database, which only hides the symptom there. Read it null-safely: `check.?geo.?authorized_zone.orValue(false)`.

## Evaluation

| Step | What happens |
|---|---|
| Which symptoms | Only `trip_check` symptoms whose rules read a counter run on the frame's check. The lost-signal detector's checks run the others |
| Watermark | `wm:trip_check@frames` in the episode hash, apart from the detector's `wm:trip_check` |
| Transitions | Recorded with the frame's trip and position. The context is the check without `trip`, with `geo` |
| Order | Transitions, then episodes, then the tracker's state. A failure replays the frame from the saved state |
| Signal access ends | Existing duty cases reconcile under the frame watermark without GPS input; the trip counters end. Older frames cannot close newer cases |
| Operator close | Closing a case of a symptom that reads `check.duty_minutes` increments `restarts`; the next frame ends the duty count. The driving count stays |

The `miot.symptoms.duty.skipped` counter counts frames the tracker did not apply. A kept jump frame saves the state without evaluating any symptom.

## Differences from the GPS database

| GPS database | Tracker |
|---|---|
| Past 16 h 15 min of duty, the current rest keeps counting while the vehicle drives, until the next 8 h reset | The rest is 0 while moving and each stop starts it again |
| Cases inside an authorized zone are marked excluded | No automatic exclusion; rules can use optional `check.geo` fields |
| After a gap of more than 1 h following a moving frame, the gap counts as driving | The gap is neither driving nor rest |
| A jump frame is dropped until the previous position expires (1 h) | A jump frame confirmed by the next frame replaces the previous position at once |

Evals: `src/test/resources/evals/duty/README.md`.

The restart-frame driving value and the 8 h rest reset preserve `accumulate_continuous_tracking` and `accumulate_resting_tracking`: the former returns a zero check while installing the next driving run, and the latter deactivates its row at 28,800 seconds and inserts a new row on the following frame. These counters do not measure an uninterrupted rest beyond a duty cycle.
