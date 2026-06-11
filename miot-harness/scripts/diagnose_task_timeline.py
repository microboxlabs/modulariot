"""Diagnose Gap 3: `coordinador_task_timeline` returning 0 rows for a
valid service code (beta review, tenant mintral, service 1643006).

Read-only probes against the Coordinador DB:

  1. Print the signature + COMMENT of fn_dx_task_timeline and
     fn_dx_servicio_detalle (argument semantics).
  2. fn_dx_task_timeline(p_service_code => N)      → row count.
  3. fn_dx_servicio_detalle(p_service_code => N)   → resolve proc_inst_id.
  4. fn_dx_task_timeline(p_proc_inst_id => M)      → row count.
  5. If both timeline calls are empty: scan nexo.dx_* tables whose name
     suggests the timeline snapshot and report row counts — distinguishes
     "wrong filter argument" from "unrefreshed/empty snapshot" (the
     latter is a DB-side escalation, not a harness fix).

Usage (requires MIOT_HARNESS_DATASOURCE_DSN in env or .env):

    uv run python scripts/diagnose_task_timeline.py --service-code 1643006
    uv run python scripts/diagnose_task_timeline.py \
        --service-code 1643006 --proc-inst-id 45703329

Exit code 0 always (diagnostic, not a gate); findings go to stdout.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import UTC, datetime
from typing import Any

from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.pool import create_nexo_pool
from miot_harness.integrations.nexo.settings import NexoSettings
from miot_harness.integrations.nexo.tool_factory import _extract_refreshed_at, _row_to_dict

_SIGNATURE_SQL = """
SELECT p.proname,
       pg_get_function_arguments(p.oid) AS arguments,
       obj_description(p.oid, 'pg_proc') AS comment
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = $1 AND p.proname = ANY($2::text[])
ORDER BY p.proname
"""

_TIMELINE_TABLES_SQL = """
SELECT table_name
FROM information_schema.tables
WHERE table_schema = $1
  AND table_name LIKE 'dx_%'
  AND (table_name ILIKE '%task%' OR table_name ILIKE '%timeline%')
ORDER BY table_name
"""


def _summarize_rows(label: str, rows: list[dict[str, Any]]) -> None:
    refreshed = _extract_refreshed_at(rows[0]) if rows else None
    age = (
        f"{(datetime.now(UTC) - refreshed).total_seconds() / 60:.0f} min"
        if refreshed
        else "n/a"
    )
    print(f"  {label}: rows={len(rows)} refreshed_at={refreshed} (age {age})")
    if rows:
        sample = {k: v for i, (k, v) in enumerate(rows[0].items()) if i < 8}
        print(f"    row[0] sample: {sample}")


async def _fetch(conn: Any, sql: str, *args: Any) -> list[dict[str, Any]]:
    async with conn.transaction(readonly=True):
        raw = await conn.fetch(sql, *args)
    return [_row_to_dict(r) for r in raw]


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service-code", type=str, default="1643006")
    parser.add_argument(
        "--proc-inst-id",
        type=str,
        default=None,
        help="Skip resolution and probe fn_dx_task_timeline with this id directly.",
    )
    args = parser.parse_args()

    settings = HarnessSettings()
    nexo = NexoSettings()
    schema = nexo.nexo_search_path
    if not settings.datasource_dsn:
        print("MIOT_HARNESS_DATASOURCE_DSN is not set — aborting.", file=sys.stderr)
        return 1

    pool = await create_nexo_pool(
        settings.datasource_dsn, application_name="miot-harness-diagnose"
    )
    try:
        async with pool.acquire() as conn:
            await conn.execute(f"SET search_path TO {schema}, public")

            print("== 1. Function signatures ==")
            sigs = await _fetch(
                conn,
                _SIGNATURE_SQL,
                schema,
                ["fn_dx_task_timeline", "fn_dx_servicio_detalle"],
            )
            if not sigs:
                print(f"  No functions found in schema {schema!r}!")
            for sig in sigs:
                print(f"\n  {sig['proname']}({sig['arguments']})")
                comment = (sig.get("comment") or "(no COMMENT)").strip()
                print("    " + comment.replace("\n", "\n    "))

            print(f"\n== 2. fn_dx_task_timeline(p_service_code => {args.service_code}) ==")
            try:
                rows = await _fetch(
                    conn,
                    f"SELECT * FROM {schema}.fn_dx_task_timeline(p_service_code => $1)",
                    args.service_code,
                )
                _summarize_rows("by service_code", rows)
                timeline_by_service = len(rows)
            except Exception as exc:  # noqa: BLE001 — keep probing
                print(f"  RAISED: {exc}")
                timeline_by_service = -1

            proc_inst_id = args.proc_inst_id
            print(f"\n== 3. fn_dx_servicio_detalle(p_service_code => {args.service_code}) ==")
            try:
                rows = await _fetch(
                    conn,
                    f"SELECT * FROM {schema}.fn_dx_servicio_detalle(p_service_code => $1)",
                    args.service_code,
                )
                _summarize_rows("servicio_detalle", rows)
                if rows and proc_inst_id is None:
                    for key in ("proc_inst_id", "p_proc_inst_id", "process_instance_id"):
                        if rows[0].get(key) is not None:
                            proc_inst_id = str(rows[0][key])
                            print(f"  resolved proc_inst_id = {proc_inst_id}")
                            break
            except Exception as exc:  # noqa: BLE001
                print(f"  RAISED: {exc}")

            timeline_by_proc = -1
            if proc_inst_id is not None:
                print(f"\n== 4. fn_dx_task_timeline(p_proc_inst_id => {proc_inst_id}) ==")
                try:
                    rows = await _fetch(
                        conn,
                        f"SELECT * FROM {schema}.fn_dx_task_timeline(p_proc_inst_id => $1)",
                        proc_inst_id,
                    )
                    _summarize_rows("by proc_inst_id", rows)
                    timeline_by_proc = len(rows)
                except Exception as exc:  # noqa: BLE001
                    print(f"  RAISED: {exc}")
            else:
                print("\n== 4. skipped (no proc_inst_id resolved) ==")

            if timeline_by_service == 0 and timeline_by_proc <= 0:
                print("\n== 5. Both probes empty — checking underlying snapshot tables ==")
                tables = await _fetch(conn, _TIMELINE_TABLES_SQL, schema)
                if not tables:
                    print("  No dx_* table matching %task%/%timeline% found.")
                for t in tables:
                    name = t["table_name"]
                    try:
                        count_rows = await _fetch(
                            conn, f'SELECT count(*) AS n FROM {schema}."{name}"'
                        )
                        print(f"  {schema}.{name}: {count_rows[0]['n']} rows")
                    except Exception as exc:  # noqa: BLE001
                        print(f"  {schema}.{name}: RAISED {exc}")
                print(
                    "\n  → If these tables are empty/old, the root cause is the "
                    "DB-side refresh job (escalate to the Coordinador owners), "
                    "not the harness."
                )

            print("\n== Verdict hints ==")
            if timeline_by_service == 0 and timeline_by_proc > 0:
                print(
                    "  fn_dx_task_timeline ignores p_service_code but honors "
                    "p_proc_inst_id → enable the TOOL_USAGE_HINTS chaining hint "
                    "(servicio_detalle → task_timeline)."
                )
            elif timeline_by_service > 0:
                print("  p_service_code works — Gap 3 may have been a stale snapshot.")
    finally:
        await pool.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
