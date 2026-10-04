# Continuous driving: evals

| File | What |
|---|---|
| `production-rule.json` | The legacy SQL rule written as a spec over the `trip_check` source |
| `production-traces.json` | 4 real trips: net driving minutes per signal and the transitions the legacy engine produced |
| `known-gaps.json` | None: every trip matches |

## The production rule

| Step | Rule |
|---|---|
| Matches | On a trip with one driver, net driving of at least 4 h 30 min |
| Opens | At the first matching signal |
| Level | Net driving: 300 min → 2, 330 → 3, 360 → 4, else 1. Rest lowers it. |
| Closes | First signal under 4 h 30 min |

## Net driving minutes: what the source must compute

The evaluator reads `check.driving_minutes`; the source computes it. The legacy tracker does it like this, signal by signal, per vehicle and trip:

| Situation | Effect |
|---|---|
| Moving since the previous signal | The time between the two signals is driving |
| Stopped for at least 24 min (1,440 s) | The stop pays back driving at 2.5 times its length (3,600 s per 1,440 s), never more than was driven |
| Net driving | Driving minus what stops paid back |
| All driving paid back | The tracker starts again from zero |
| New trip, or no trip | The tracker starts again |

"Moving" is more than 2.78 m/s between two accepted signals (distance over time, not the device's speed).

A model of this tracker reproduced 5 of the 6 legacy episodes on the trips that started inside the export window, with the same signal count and level sequence. The traces carry the minutes that model computed.

## How the traces were made

From one day of a carrier fleet's trips, only trips that started inside that day (the tracker needs the whole trip). Kept where the model reproduced the engine's episodes and case levels exactly. Of each run under 4 h 30 min only the first signal is kept. Columns: `[seconds, net driving minutes]`. No plates, coordinates, ids or dates.

Four trips is a small set; a longer export would add more.
