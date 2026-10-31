"""Builds the lost-signal shadow map from exported frames and prints it as Redis commands.

Reads CSV rows (sender, latitude, longitude, frame time, arrival time) from stdin, as export.sql writes them, and
prints HSET commands for symptoms:cov:<sender> and symptoms:cov:* in the detector's format (CoverageMap,
Coverage). Delayed: arrival later than max(2 min, 3 x the sender's median delay). Weights fade with a 7-day
half-life to the newest frame. Review the output, then pipe it to redis-cli by hand; never against prod
without a deliberate decision.

    cat frames-*.csv | python3 -I seed.py > coverage.redis
"""
import csv
import json
import math
import statistics
import sys
from datetime import datetime

CELL = 0.05
HALF_LIFE_S = 7 * 86400
DELAYED_S = 120
TTL_S = 30 * 86400


def ts(text):
    return datetime.fromisoformat(text.replace(" ", "T")).timestamp()


def main():
    rows = []
    for sender, lat, lon, at, arrived in csv.reader(sys.stdin):
        lat, lon = float(lat), float(lon)
        if lat == 0 and lon == 0:
            continue
        rows.append((sender, lat, lon, ts(at), max(0.0, ts(arrived) - ts(at))))
    if not rows:
        return
    medians = {}
    for sender in {r[0] for r in rows}:
        medians[sender] = statistics.median(r[4] for r in rows if r[0] == sender)
    newest = max(r[3] for r in rows)
    cells = {}
    for sender, lat, lon, at, delay in rows:
        cell = f"{math.floor(lat / CELL)}:{math.floor(lon / CELL)}"
        weight = 0.5 ** ((newest - at) / HALF_LIFE_S)
        delayed = delay > max(DELAYED_S, 3 * medians[sender])
        for key in (sender, "*"):
            f, d = cells.get((key, cell), (0.0, 0.0))
            cells[(key, cell)] = (f + weight, d + (weight if delayed else 0.0))
    at_ms = int(newest * 1000)
    for (key, cell), (f, d) in sorted(cells.items()):
        value = json.dumps({"f": round(f, 3), "d": round(d, 3), "t": at_ms}, separators=(",", ":"))
        print(f"HSET symptoms:cov:{key} {cell} '{value}'")
    for key in sorted({k for k, _ in cells}):
        print(f"EXPIRE symptoms:cov:{key} {TTL_S}")


if __name__ == "__main__":
    main()
