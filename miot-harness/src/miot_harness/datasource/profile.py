"""Column profiles for a policy-allowed table.

A profile tells the agent what the data looks like before it writes a query:
how full each column is, its range, its common values, and which keys its
JSON documents carry. It reads a bounded sample, so it costs the same on a
table of a thousand rows or a billion.
"""

from __future__ import annotations

import json
from typing import Any

from miot_harness.datasource.safe_query import _split_qualified, fetch_readonly
from miot_harness.datasource.safe_sql import (
    AllowlistViolation,
    UnsupportedConstruct,
    quote_ident,
)
from miot_harness.datasource.sql_policy import TableAccessPolicy

DEFAULT_SAMPLE_ROWS = 5000
MAX_COLUMNS = 40
TOP_VALUES = 5
JSON_KEYS = 15
EXAMPLE_CHARS = 240

_RANGE_TYPES = ("int", "numeric", "double", "real", "date", "time")
_TEXT_TYPES = ("char", "text", "bool", "uuid")


async def safe_profile(
    *,
    pool: Any,
    policy: TableAccessPolicy,
    table: str,
    columns: list[str] | None = None,
    sample_rows: int = DEFAULT_SAMPLE_ROWS,
    statement_timeout_ms: int | None = None,
) -> dict[str, Any]:
    """Profile a sample of `table`; `columns` limits which columns are profiled."""
    schema, name = _split_qualified(table)
    if not policy.is_allowed(schema=schema, table=name):
        raise AllowlistViolation(
            f"profile target {table!r} is outside the allowlist ({policy.describe()})"
        )

    async def fetch(sql: str, *args: Any) -> list[Any]:
        return await fetch_readonly(pool, sql, *args, statement_timeout_ms=statement_timeout_ms)

    meta = await fetch(
        "SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, "
        "col_description(a.attrelid, a.attnum) AS comment, "
        "CASE WHEN c.reltuples >= 0 THEN c.reltuples::bigint END AS est_rows "
        "FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid "
        "JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped "
        "ORDER BY a.attnum",
        schema,
        name,
    )
    wanted = {c.lower() for c in columns} if columns else None
    cols = [dict(r) for r in meta if wanted is None or str(r["name"]).lower() in wanted]
    cols = [c for c in cols if _quotable(str(c["name"]))][:MAX_COLUMNS]
    est_rows = meta[0]["est_rows"] if meta else None
    sample = max(100, min(int(sample_rows), 50000))
    source = _sample_source(schema, name, est_rows, sample)

    total = await fetch(f"SELECT count(*) AS n FROM {source}")
    sampled = int(total[0]["n"]) if total else 0
    profiled = [await _profile_column(fetch, source, col, sampled) for col in cols]
    return {
        "table": f"{schema}.{name}",
        "est_rows": est_rows,
        "sampled_rows": sampled,
        "sample": _sample_kind(source, est_rows, sample),
        "columns": profiled,
    }


def _quotable(name: str) -> bool:
    try:
        quote_ident(name)
    except UnsupportedConstruct:
        return False
    return True


def _sample_kind(source: str, est_rows: int | None, sample: int) -> str:
    if "TABLESAMPLE" in source:
        return "random pages"
    if est_rows is not None and est_rows <= sample * 10:
        return "all rows"
    return "first rows"


def _sample_source(schema: str, name: str, est_rows: int | None, sample: int) -> str:
    qualified = f"{quote_ident(schema)}.{quote_ident(name)}"
    if est_rows and est_rows > sample * 10:
        percent = max(0.01, min(100.0, 100.0 * sample * 2 / est_rows))
        return f"(SELECT * FROM {qualified} TABLESAMPLE SYSTEM ({percent:.4f}) LIMIT {sample}) s"
    # Small enough to read whole; the limit only guards a stale estimate.
    return f"(SELECT * FROM {qualified} LIMIT {sample * 10}) s"


async def _profile_column(
    fetch: Any, source: str, col: dict[str, Any], sampled: int
) -> dict[str, Any]:
    ident = quote_ident(str(col["name"]))
    kind = str(col["type"]).lower()
    out: dict[str, Any] = {"name": col["name"], "type": col["type"]}
    if col.get("comment"):
        out["comment"] = col["comment"]
    if kind.startswith("json"):
        stats = await fetch(f"SELECT count({ident}) AS non_null FROM {source}")
        out["null_pct"] = _null_pct(stats[0]["non_null"], sampled)
        keys = await fetch(
            f"SELECT k AS key, count(*) AS n FROM {source}, "
            f"jsonb_object_keys(CASE WHEN jsonb_typeof({ident}::jsonb) = 'object' "
            f"THEN {ident}::jsonb END) k GROUP BY 1 ORDER BY 2 DESC LIMIT {JSON_KEYS}"
        )
        out["json_keys"] = [[r["key"], r["n"]] for r in keys]
        example = await fetch(
            f"SELECT {ident}::text AS v FROM {source} WHERE {ident} IS NOT NULL LIMIT 1"
        )
        if example:
            out["example"] = _clip(example[0]["v"])
        return out
    ranged = any(t in kind for t in _RANGE_TYPES)
    extra = f", min({ident})::text AS min, max({ident})::text AS max" if ranged else ""
    stats = await fetch(
        f"SELECT count({ident}) AS non_null, count(DISTINCT {ident}) AS distinct_n{extra} "
        f"FROM {source}"
    )
    row = dict(stats[0])
    out["null_pct"] = _null_pct(row["non_null"], sampled)
    out["distinct"] = row["distinct_n"]
    if ranged:
        out["min"], out["max"] = row.get("min"), row.get("max")
    if any(t in kind for t in _TEXT_TYPES) and row["distinct_n"]:
        top = await fetch(
            f"SELECT {ident}::text AS v, count(*) AS n FROM {source} WHERE {ident} IS NOT NULL "
            f"GROUP BY 1 ORDER BY 2 DESC LIMIT {TOP_VALUES}"
        )
        out["top"] = [[_clip(r["v"], 80), r["n"]] for r in top]
    return out


def _null_pct(non_null: Any, sampled: int) -> float:
    if not sampled:
        return 0.0
    return round(100.0 * (sampled - int(non_null or 0)) / sampled, 1)


def _clip(value: Any, limit: int = EXAMPLE_CHARS) -> str:
    text = value if isinstance(value, str) else json.dumps(value, default=str)
    return text if len(text) <= limit else text[: limit - 1] + "…"
