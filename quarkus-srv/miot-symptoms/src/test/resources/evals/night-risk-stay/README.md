# Overnight stay in a risk zone: evals

| File | What |
|---|---|
| `production-rule.json` | The legacy SQL rule written as a spec |
| `production-traces.json` | 6 real trips and the transitions the legacy engine produced |
| `known-gaps.json` | None: every trip matches |

## The production rule

| Step | Rule |
|---|---|
| Matches | On a trip, stopped, inside a risk zone (geofence type 1), local time from 21:00:00 to 05:59:59. The number of drivers does not matter. |
| Opens | At the first matching signal, level 1 |
| Level | Minutes since it started: 10 → 2, 20 → 3, 30 → 4 |
| Closes | First signal that does not match |
| Hidden | When the point is also inside an authorized zone, the case is created but marked excluded, so the tower does not show it |

The evaluator has no "excluded" case, so the traces count those cases as ordinary ones.

## Source field

Same as `risk-zone-stop`: the traces add `signal.geo.risk_zone` as an `extraFields` entry.

## How the traces were made

As in `night-stop-unauthorized`. Columns: `[seconds, moving, local hour, inside a risk zone]`. No plates, coordinates, ids or dates.
