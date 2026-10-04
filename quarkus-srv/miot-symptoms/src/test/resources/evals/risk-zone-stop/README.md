# Stop in a risk zone: evals

| File | What |
|---|---|
| `production-rule.json` | The legacy SQL rule written as a spec |
| `production-traces.json` | 15 real trips and the transitions the legacy engine produced |
| `known-gaps.json` | None: every trip matches |

## The production rule

| Step | Rule |
|---|---|
| Matches | On a trip, stopped, inside a risk zone (geofence type 1), local time from 06:00:01 to 20:59:59 |
| Opens | At the first matching signal, level 1 |
| Level | Minutes since it started: 10 → 2, 25 → 3, 40 → 4 |
| Closes | First signal that does not match |

## Source field

The platform source has no field for "inside a risk zone": `signal.geo.zone` is the zone's name. The traces add `signal.geo.risk_zone` (yes/no) as an `extraFields` entry. The catalog cannot express this rule until the source has that field.

## How the traces were made

As in `night-stop-unauthorized`: one day of a carrier fleet's trips, after the GPS gate, kept where a model of the legacy rule reproduced the engine's episodes and case levels exactly. Columns: `[seconds, moving, local hour, inside a risk zone]`. No plates, coordinates, ids or dates.
