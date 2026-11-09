# Duty tracker: evals

| File | What |
|---|---|
| `production-trips.json` | 34 finished trips longer than 16 h with continuous-driving or continuous-resting cases in production |
| `known-gaps.json` | Trips and symptoms where the tracker differs from production, and why |

`DutyParityEvalTest` replays each trip through `DutyChecks` (the tracker) and the published continuous-driving and continuous-resting templates, frame by frame, with the operators' closes. `DutyTrackerTest` and `EvaluatorDutyTest` cover the rules on synthetic frames.

## Files

| Key | Content |
|---|---|
| `frames` | `[seconds from the trip start, metres from the previous frame, on the trip]`, only the frames production's GPS gate accepted, in arrival order. The replay lays them on a meridian, so the distances and speeds are the recorded ones |
| `closes` | `[seconds, symptom]`: when an operator's treatment closed the case in production (resting: any expired treatment; driving: an expired "invalidate"). The replay closes the case then, and a resting close restarts the duty |
| `expected` | Production's transitions per symptom. A level change is on the first frame after the last frame of the previous level |

"On the trip" starts at the first frame production's trackers counted, a few minutes after the trip's start time. No plates, coordinates, ids or dates.

## Results

| Symptom | Identical | Same transitions within 2 min | Different |
|---|---|---|---|
| Continuous driving | 24 | 8 | 2 |
| Continuous rest | 30 | 0 | 4 |

| Cause of a difference | Trips |
|---|---|
| Production's rest keeps counting while driving past 16 h 15 min; the tracker's does not | 3 (rest) |
| A device that alternates a stale and a live position: production kept other frames | 1 (driving) |
| Production processed the vehicle's frames out of order | 1 (driving, rest) |

The time offsets of up to a minute come from frames production's gate saw differently.
