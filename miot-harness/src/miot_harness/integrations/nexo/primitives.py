"""Composable Nexo DB primitives (PR #2 redemption — plan 13 E3).

Four read-only primitives the agentic graph can call when the curated
`fn_dx_*` catalog doesn't cover a question:

- ``nexo_describe`` — ``information_schema`` introspection → columns + types.
  Safety: allowlist ``nexo.dx_*``; read-only.
- ``nexo_select`` — parameterised SELECT with optional WHERE/ORDER/LIMIT.
  Safety: sqlglot AST + allowlist + bounded LIMIT (default 100, cap 5000).
- ``nexo_grep`` — sugar for ``SELECT ... WHERE col ILIKE pattern``.
  Safety: same gate as ``nexo_select`` plus single-column constraint.
- ``nexo_explain`` — ``EXPLAIN (FORMAT JSON)``.
  Safety: refuses if total cost exceeds an env-tunable threshold.

The **safety gate** now lives in ``datasource/safe_sql.py`` (one audited
validator, shared with generic connections). This module pins the Nexo
table policy (``nexo.dx_*``) and keeps Nexo's exact public surface — the
exception classes and ``validate_select_sql`` are re-exported so existing
imports keep working unchanged.
"""

from __future__ import annotations

import re
from typing import Any

from sqlglot import exp

from miot_harness.datasource.safe_sql import (
    DEFAULT_LIMIT as _DEFAULT_LIMIT,
)
from miot_harness.datasource.safe_sql import (
    HARD_LIMIT_CAP as _HARD_LIMIT_CAP,
)
from miot_harness.datasource.safe_sql import (
    AllowlistViolation,
    CostGateViolation,
    MultiStatementRejected,
    MutationRejected,
    SafetyGateViolation,
    UnsupportedConstruct,
)
from miot_harness.datasource.safe_sql import (
    quote_ident as _quote_ident,
)
from miot_harness.datasource.safe_sql import (
    render_safe as _render_safe,
)
from miot_harness.datasource.safe_sql import (
    validate_select_sql as _validate_select_sql,
)
from miot_harness.datasource.sql_policy import RegexTablePolicy

__all__ = [
    "AllowlistViolation",
    "CostGateViolation",
    "MultiStatementRejected",
    "MutationRejected",
    "SafetyGateViolation",
    "UnsupportedConstruct",
    "nexo_describe",
    "nexo_explain",
    "nexo_grep",
    "nexo_select",
    "validate_select_sql",
]

# Tables the Nexo primitives can touch. `nexo.dx_*` snapshot tables are the
# curated dimension layer. `pg_catalog`/`information_schema` are denied even
# though `nexo_describe` introspects information_schema — describe bypasses
# this policy via its own narrower function.
NEXO_TABLE_POLICY = RegexTablePolicy(r"^nexo\.dx_[a-zA-Z0-9_]+$")


def validate_select_sql(sql: str) -> exp.Expression:
    """Validate `sql` against the Nexo table policy (`nexo.dx_*`).

    Thin wrapper over the shared gate so Nexo's call sites and tests keep their
    single-argument signature.
    """

    return _validate_select_sql(sql, table_policy=NEXO_TABLE_POLICY)


# ----------------------------------------------------------------------
# Primitives
# ----------------------------------------------------------------------


_DESCRIBE_ALLOWED_RE = re.compile(r"^nexo\.dx_[a-zA-Z0-9_]+$")


async def nexo_describe(*, pool: Any, table: str) -> list[dict[str, Any]]:
    """Return column name + type for an allowlisted ``nexo.dx_*`` table."""

    if not _DESCRIBE_ALLOWED_RE.match(table):
        raise AllowlistViolation(f"describe target {table!r} outside nexo.dx_* allowlist")

    schema, name = table.split(".", 1)
    sql = (
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position"
    )
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, schema, name)
    return [dict(row) for row in rows]


async def nexo_select(
    *,
    pool: Any,
    table: str,
    where: str | None = None,
    order: str | None = None,
    limit: int = _DEFAULT_LIMIT,
    columns: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Bounded, gate-validated SELECT against an allowlisted ``nexo.dx_*`` table."""

    bounded_limit = max(1, min(limit, _HARD_LIMIT_CAP))

    if columns:
        col_clause = ", ".join(_quote_ident(c) for c in columns)
    else:
        col_clause = "*"

    sql = f"SELECT {col_clause} FROM {table}"
    if where:
        sql += f" WHERE {where}"
    if order:
        sql += f" ORDER BY {order}"
    sql += f" LIMIT {bounded_limit}"

    ast = validate_select_sql(sql)
    safe_sql = _render_safe(ast)

    async with pool.acquire() as conn:
        rows = await conn.fetch(safe_sql)
    return [dict(row) for row in rows]


async def nexo_grep(
    *,
    pool: Any,
    table: str,
    column: str,
    pattern: str,
    limit: int = _DEFAULT_LIMIT,
) -> list[dict[str, Any]]:
    """SELECT * WHERE col ILIKE pattern — sugar over ``nexo_select``."""

    bounded_limit = max(1, min(limit, _HARD_LIMIT_CAP))
    col = _quote_ident(column)
    # ILIKE pattern is parameterised at the asyncpg layer; sqlglot still
    # validates the SQL skeleton.
    sql_for_gate = f"SELECT * FROM {table} WHERE {col} ILIKE $1 LIMIT {bounded_limit}"
    ast = validate_select_sql(sql_for_gate)
    safe_sql = _render_safe(ast)

    async with pool.acquire() as conn:
        rows = await conn.fetch(safe_sql, pattern)
    return [dict(row) for row in rows]


async def nexo_explain(
    *,
    pool: Any,
    query: str,
    cost_threshold: float,
) -> dict[str, Any]:
    """EXPLAIN (FORMAT JSON) the query; refuse if total cost > threshold."""

    ast = validate_select_sql(query)
    safe_inner = _render_safe(ast)

    async with pool.acquire() as conn:
        rows = await conn.fetch(f"EXPLAIN (FORMAT JSON) {safe_inner}")

    # asyncpg returns rows; PostgreSQL EXPLAIN JSON returns a single row with
    # a `QUERY PLAN` array whose first element is `{"Plan": {...}}`. Use
    # subscript access so we work uniformly across asyncpg.Record (not a dict
    # subclass) and plain-dict fixtures.
    if not rows:
        raise UnsupportedConstruct("EXPLAIN returned no rows")
    row = rows[0]
    try:
        payload = row["QUERY PLAN"]
    except (KeyError, TypeError, IndexError) as exc:
        raise UnsupportedConstruct("EXPLAIN output missing QUERY PLAN") from exc
    if not payload:
        raise UnsupportedConstruct("EXPLAIN output missing QUERY PLAN")
    plan = payload[0].get("Plan", {})
    total_cost = float(plan.get("Total Cost", 0.0))
    if total_cost > cost_threshold:
        raise CostGateViolation(
            f"plan total_cost={total_cost:.1f} exceeds threshold {cost_threshold:.1f}"
        )
    return {
        "total_cost": total_cost,
        "node_type": plan.get("Node Type"),
        "plan": plan,
    }
