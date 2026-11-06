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
| More than 150 km/h from the last applied frame | Not applied, and not used as the previous position |
| Other | Applied. Moving when more than 2.78 m/s from the previous applied frame (distance over time, not the device speed) |

The time between two applied frames goes to driving when the later frame moves or the earlier one moved, and to rest between two stopped frames. A signal gap gets no special treatment: a gap while driving counts as driving.

## Counters

| Field | Rule |
|---|---|
| `check.driving_minutes` | Driving minus what stops pay back. A stop of 24 min or more pays back 2.5 times its length, never more than the driving before it. When all driving is paid back the count starts again |
| `check.resting_minutes` | Length of the stop in progress, from its first stopped frame; 0 while moving |
| `check.duty_minutes` | From the first moving frame of the trip, including the interval before it; stops count. A stopped frame that completes 8 h of rest publishes 0 and ends the duty; the next frame starts a new one, which waits for movement |

No trip, or a new trip id, starts all three again. `check.signal_lost_minutes` is 0 and `check.loss` is absent on these checks.

## Evaluation

| Step | What happens |
|---|---|
| Which symptoms | Only `trip_check` symptoms whose rules read a counter run on the frame's check. The lost-signal detector's checks run the others |
| Watermark | `wm:trip_check@frames` in the episode hash, apart from the detector's `wm:trip_check` |
| Transitions | Recorded with the frame's trip and position. The context is the check without `trip` |
| Order | Transitions, then episodes, then the tracker's state. A failure replays the frame from the saved state |
| Operator close | Closing a case of a symptom that reads `check.duty_minutes` increments `restarts`; the next frame ends the duty count. The driving count stays |

The `miot.symptoms.duty.skipped` counter counts frames the tracker did not apply.

## Differences from the GPS database

| GPS database | Tracker |
|---|---|
| Past 16 h 15 min of duty, the current rest keeps counting while the vehicle drives, until the next 8 h reset | The rest is 0 while moving and each stop starts it again |
| Cases inside an authorized zone are marked excluded | No exclusion: `trip_check` has no zone fields |

Evals: `src/test/resources/evals/duty/README.md`.
