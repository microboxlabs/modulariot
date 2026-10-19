"""Generate a synthetic fleet-operations database for analytics evals.

The tables are raw operational sources, the way they arrive from a workflow
engine and a telemetry pipeline. They carry the problems a data team has to
solve before a KPI is right:

- a service can be reopened, so it has more than one process row;
- a trip can switch tractors, so telemetry has one row per tractor;
- some services have no telemetry, and some checks have no result;
- elapsed time includes stops, so it is not driving time;
- some symptom types are noise and are excluded from safety counts.

    uv run python evals/datasets/fleet_ops/generate.py > /tmp/fleet_ops.sql
    psql -d fleet_demo -f /tmp/fleet_ops.sql

Output is deterministic for a given --seed and --now; the default --now is
the current time.
"""

from __future__ import annotations

import argparse
import io
import json
import random
import sys
from datetime import UTC, datetime, timedelta

CARRIERS = [
    "Transportes Andinos",
    "Cordillera Cargo",
    "Ruta Norte Logística",
    "Pacífico Express",
    "Altiplano Freight",
    "Desierto Transportes",
    "Valle Central Cargo",
    "Minera Trans",
]
SITES = [
    "Antofagasta",
    "Calama",
    "Mejillones",
    "Sierra Gorda",
    "Taltal",
    "Tocopilla",
    "María Elena",
    "Chuquicamata",
    "Baquedano",
    "Iquique",
]
SERVICE_TYPES = ["v", "v", "v", "r", "c"]
GPS_PROVIDERS = ["Wialon", "Geotab", "Samsara", None]
SYMPTOMS = [
    ("fatiga", True),
    ("somnolencia", True),
    ("exceso_velocidad", True),
    ("frenado_brusco", True),
    ("desvio_ruta", True),
    ("detencion_no_autorizada", True),
    ("perdida_senal", False),
    ("bateria_baja", False),
]
EXCLUDED_SYMPTOMS = ["bateria_baja", "prueba_sistema"]
FIRST_NAMES = [
    "Juan",
    "Pedro",
    "Luis",
    "Carlos",
    "Jorge",
    "Miguel",
    "Diego",
    "Raúl",
    "Iván",
    "Hugo",
]
LAST_NAMES = [
    "Rojas",
    "Muñoz",
    "Díaz",
    "Soto",
    "Pérez",
    "Araya",
    "Tapia",
    "Castro",
    "Vega",
    "Flores",
]

SCHEMA = """
DROP SCHEMA IF EXISTS ops CASCADE;
DROP SCHEMA IF EXISTS telemetry CASCADE;
CREATE SCHEMA ops;
CREATE SCHEMA telemetry;

CREATE TABLE ops.fleet (
    asset_id     text PRIMARY KEY,
    plate        text NOT NULL,
    kind         text NOT NULL,
    carrier      text NOT NULL,
    declared     boolean NOT NULL
);
COMMENT ON TABLE ops.fleet IS
    'Vehicles registered by carriers. declared = counted in the contracted fleet.';

CREATE TABLE ops.service_process (
    proc_inst_id   text PRIMARY KEY,
    service_code   text NOT NULL,
    proc_start     timestamptz NOT NULL,
    proc_end       timestamptz,
    carrier        text,
    route_origin   text,
    route_destination text,
    service_type   text,
    truck_plate    text,
    trailer_plate  text,
    driver_name    text,
    gps_provider   text
);
COMMENT ON TABLE ops.service_process IS
    'One row per workflow process instance of a transport service.';
CREATE INDEX ON ops.service_process (service_code);

CREATE TABLE ops.service_checks (
    service_code        text PRIMARY KEY,
    drowsiness_check    text,
    alcohol_check       text,
    drugs_check         text,
    checks_state        text,
    criticality         text
);
COMMENT ON COLUMN ops.service_checks.drowsiness_check IS
    'aprobado | rechazado | NULL when not captured';

CREATE TABLE ops.workflow_task (
    task_id       text PRIMARY KEY,
    proc_inst_id  text NOT NULL,
    form_key      text NOT NULL,
    assignee      text,
    start_time    timestamptz,
    end_time      timestamptz
);
CREATE INDEX ON ops.workflow_task (proc_inst_id);

CREATE TABLE telemetry.trip_gps_summary (
    trip_id               text NOT NULL,
    asset_id              text NOT NULL,
    window_start          timestamptz NOT NULL,
    window_end            timestamptz NOT NULL,
    trip_distance_m       numeric,
    minutes_moving        integer,
    minutes_with_signals  integer,
    total_minutes_span    integer,
    lost_signal_symptoms  integer,
    fatigue_symptoms      integer,
    fatigue_symptoms_treated integer,
    symptoms_detail       jsonb,
    PRIMARY KEY (trip_id, asset_id)
);
COMMENT ON TABLE telemetry.trip_gps_summary IS
    'GPS summary per trip and tractor, inside the window that tractor pulled the trip.';
COMMENT ON COLUMN telemetry.trip_gps_summary.symptoms_detail IS
    'per symptom type: t=total, b=black code (critical), tr=treated, btr=black treated';

CREATE TABLE telemetry.excluded_symptoms (
    symptom_name text PRIMARY KEY,
    reason       text
);
"""


def _plate(rng: random.Random) -> str:
    letters = "BCDFGHJKLPRSTVWXYZ"
    return "".join(rng.choice(letters) for _ in range(4)) + f"{rng.randint(10, 99)}"


def _copy(out: io.StringIO, table: str, columns: list[str], rows: list[list[object]]) -> None:
    out.write(f"COPY {table} ({', '.join(columns)}) FROM stdin;\n")
    for row in rows:
        out.write("\t".join(_cell(v) for v in row) + "\n")
    out.write("\\.\n\n")


def _cell(value: object) -> str:
    if value is None:
        return "\\N"
    if isinstance(value, bool):
        return "t" if value else "f"
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        value = json.dumps(value, ensure_ascii=False)
    return str(value).replace("\\", "\\\\").replace("\t", " ").replace("\n", " ")


def generate(seed: int, months: int, services_per_month: int, now: datetime) -> str:
    rng = random.Random(seed)
    out = io.StringIO()
    out.write(SCHEMA)

    fleet: list[list[object]] = []
    trucks_by_carrier: dict[str, list[tuple[str, str]]] = {}
    for carrier in CARRIERS:
        for _ in range(rng.randint(25, 60)):
            asset_id = f"A{len(fleet) + 1:05d}"
            plate = _plate(rng)
            declared = rng.random() < 0.9
            fleet.append([asset_id, plate, "tracto", carrier, declared])
            trucks_by_carrier.setdefault(carrier, []).append((asset_id, plate))
    _copy(out, "ops.fleet", ["asset_id", "plate", "kind", "carrier", "declared"], fleet)

    routes = [(o, d) for o in SITES for d in SITES if o != d]
    routes = rng.sample(routes, 24)
    drivers = [f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)} {i}" for i in range(220)]

    processes: list[list[object]] = []
    checks: list[list[object]] = []
    tasks: list[list[object]] = []
    gps: list[list[object]] = []

    first = now.year * 12 + now.month - 1 - (months - 1)
    code = 100000
    for m in range(first, first + months):
        month_start = now.replace(
            year=m // 12, month=m % 12 + 1, day=1, hour=0, minute=0, second=0, microsecond=0
        )
        volume = int(services_per_month * rng.uniform(0.85, 1.15))
        for _ in range(volume):
            code += 1
            service_code = f"SV{code}"
            start = month_start + timedelta(minutes=rng.randint(0, 29 * 24 * 60))
            if start > now:
                continue
            carrier = rng.choice(CARRIERS)
            origin, destination = rng.choice(routes)
            truck_id, truck_plate = rng.choice(trucks_by_carrier[carrier])
            span_min = rng.randint(180, 900)
            end = start + timedelta(minutes=span_min)
            open_trip = end > now
            proc_id = f"P{code}"
            row = [
                proc_id,
                service_code,
                start,
                None if open_trip else end,
                carrier,
                origin,
                destination,
                rng.choice(SERVICE_TYPES),
                truck_plate,
                _plate(rng),
                rng.choice(drivers),
                rng.choice(GPS_PROVIDERS),
            ]
            processes.append(row)
            if rng.random() < 0.05 and not open_trip:
                # Reopened service: an earlier process that was closed and reopened.
                early = list(row)
                early[0] = f"{proc_id}-0"
                early[3] = start + timedelta(minutes=rng.randint(10, 60))
                early[4] = carrier if rng.random() < 0.5 else rng.choice(CARRIERS)
                processes.append(early)

            if rng.random() < 0.85:

                def result(p_ok: float) -> str | None:
                    r = rng.random()
                    return None if r < 0.08 else ("aprobado" if r < p_ok else "rechazado")

                d, a, dr = result(0.95), result(0.98), result(0.985)
                state = "rechazado" if "rechazado" in (d, a, dr) else "aprobado"
                checks.append(
                    [service_code, d, a, dr, state, "alta" if state == "rechazado" else "normal"]
                )

            tasks.append(
                [
                    f"T{code}a",
                    proc_id,
                    "presentDriverTask",
                    "coordinador",
                    start - timedelta(hours=2),
                    start - timedelta(hours=1),
                ]
            )
            if rng.random() < 0.9:
                done = start - timedelta(minutes=rng.randint(5, 50))
                tasks.append(
                    [
                        f"T{code}b",
                        proc_id,
                        "prepareServiceTask",
                        f"operador{rng.randint(1, 12)}",
                        start - timedelta(hours=1),
                        done,
                    ]
                )
            elif rng.random() < 0.5:
                tasks.append(
                    [
                        f"T{code}b",
                        proc_id,
                        "prepareServiceTask",
                        None,
                        start - timedelta(hours=1),
                        None,
                    ]
                )

            if row[11] is None or rng.random() < 0.08:
                continue  # no telemetry for this service
            swap = rng.random() < 0.08
            tractors = [(truck_id, start, end)]
            if swap:
                cut = start + timedelta(minutes=rng.randint(60, span_min - 60))
                other_id = rng.choice([a for a, _ in trucks_by_carrier[carrier] if a != truck_id])
                tractors = [(truck_id, start, cut), (other_id, cut, end)]
            for asset_id, w_start, w_end in tractors:
                window = int((min(w_end, now) - w_start).total_seconds() // 60)
                if window <= 0:
                    continue
                moving = int(window * rng.uniform(0.45, 0.8))
                signal = min(window, int(window * rng.uniform(0.7, 1.0)))
                moving = min(moving, signal)
                km = moving / 60 * rng.uniform(45, 75)
                detail: dict[str, dict[str, int]] = {}
                for name, _safety in SYMPTOMS:
                    if rng.random() < 0.18:
                        total = rng.randint(1, 4)
                        black = rng.randint(0, total) if rng.random() < 0.4 else 0
                        treated = rng.randint(0, total)
                        detail[name] = {
                            "t": total,
                            "b": black,
                            "tr": treated,
                            "btr": min(black, treated),
                        }
                fatigue = detail.get("fatiga", {}).get("t", 0) + detail.get("somnolencia", {}).get(
                    "t", 0
                )
                fatigue_tr = detail.get("fatiga", {}).get("tr", 0) + detail.get(
                    "somnolencia", {}
                ).get("tr", 0)
                gps.append(
                    [
                        service_code,
                        asset_id,
                        w_start,
                        w_end,
                        round(km * 1000, 1),
                        moving,
                        signal,
                        window,
                        detail.get("perdida_senal", {}).get("t", 0),
                        fatigue,
                        fatigue_tr,
                        detail or None,
                    ]
                )

    _copy(
        out,
        "ops.service_process",
        [
            "proc_inst_id",
            "service_code",
            "proc_start",
            "proc_end",
            "carrier",
            "route_origin",
            "route_destination",
            "service_type",
            "truck_plate",
            "trailer_plate",
            "driver_name",
            "gps_provider",
        ],
        processes,
    )
    _copy(
        out,
        "ops.service_checks",
        [
            "service_code",
            "drowsiness_check",
            "alcohol_check",
            "drugs_check",
            "checks_state",
            "criticality",
        ],
        checks,
    )
    _copy(
        out,
        "ops.workflow_task",
        ["task_id", "proc_inst_id", "form_key", "assignee", "start_time", "end_time"],
        tasks,
    )
    _copy(
        out,
        "telemetry.trip_gps_summary",
        [
            "trip_id",
            "asset_id",
            "window_start",
            "window_end",
            "trip_distance_m",
            "minutes_moving",
            "minutes_with_signals",
            "total_minutes_span",
            "lost_signal_symptoms",
            "fatigue_symptoms",
            "fatigue_symptoms_treated",
            "symptoms_detail",
        ],
        gps,
    )
    _copy(
        out,
        "telemetry.excluded_symptoms",
        ["symptom_name", "reason"],
        [[s, "ruido operacional"] for s in EXCLUDED_SYMPTOMS],
    )
    out.write("ANALYZE;\n")
    return out.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--months", type=int, default=13)
    parser.add_argument("--per-month", type=int, default=1200)
    parser.add_argument(
        "--now", default="", help="ISO timestamp treated as now (default: current time)"
    )
    args = parser.parse_args()
    now = datetime.fromisoformat(args.now) if args.now else datetime.now(UTC)
    sys.stdout.write(generate(args.seed, args.months, args.per_month, now))


if __name__ == "__main__":
    main()
