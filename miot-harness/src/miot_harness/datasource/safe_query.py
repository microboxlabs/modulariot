"""Generic, policy-driven safe-query primitives (Tier B / Layer 2).

Backend-agnostic read-only primitives for ANY Postgres connection, parameterised
by a `TableAccessPolicy`. The difference from the Nexo primitives is the
execution envelope: every statement runs inside ``conn.transaction(readonly=True)``
(``BEGIN READ ONLY`` — PgBouncer-safe) with ``SET LOCAL statement_timeout``, so
the harness enforces read-only + a time budget IN-PROCESS without depending on a
dedicated least-privilege DB role existing (that role is recommended prod
hardening, layered on top — not a prerequisite).

- ``safe_list_tables`` — tables in the policy's allowed schema(s) (introspection).
- ``safe_describe``   — columns + types of a policy-allowed table.
- ``safe_select``     — bounded, gate-validated SELECT.
- ``safe_grep``       — ILIKE pattern search on one column.
- ``safe_explain``    — EXPLAIN (FORMAT JSON) with a total-cost gate.
"""

from __future__ import annotations

from typing import Any

from miot_harness.datasource.safe_sql import (
    DEFAULT_LIMIT,
    HARD_LIMIT_CAP,
    AllowlistViolation,
    CostGateViolation,
    UnsupportedConstruct,
    quote_ident,
    render_safe,
    validate_select_sql,
)
from miot_harness.datasource.sql_policy import TableAccessPolicy

DEFAULT_STATEMENT_TIMEOUT_MS = 5000


async def _fetch_readonly(
    pool: Any,
    sql: str,
    *args: Any,
    statement_timeout_ms: int | None,
) -> list[Any]:
    """Run a query inside a READ ONLY transaction with a statement timeout.

    `BEGIN READ ONLY` is the hard backstop: even if the gate were bypassed, the
    DB refuses writes. `SET LOCAL statement_timeout` bounds runtime. Both are
    per-transaction (PgBouncer-safe), never startup parameters.
    """
    async with pool.acquire() as conn:
        async with conn.transaction(readonly=True):
            if statement_timeout_ms:
                await conn.execute(
                    f"SET LOCAL statement_timeout = {int(statement_timeout_ms)}"
                )
            rows = await conn.fetch(sql, *args)
            return list(rows)


def _split_qualified(table: str) -> tuple[str, str]:
    parts = table.split(".")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise UnsupportedConstruct(
            f"table {table!r} must be schema-qualified as 'schema.table'"
        )
    return parts[0], parts[1]


async def safe_list_tables(
    *,
    pool: Any,
    policy: TableAccessPolicy,
    statement_timeout_ms: int | None = DEFAULT_STATEMENT_TIMEOUT_MS,
) -> list[dict[str, Any]]:
    """List tables/views in the policy's allowed schema(s)."""

    schemas = policy.allowed_schemas()
    if not schemas:
        raise UnsupportedConstruct(
            "this connection's policy does not enumerate schemas; cannot list tables"
        )
    sql = (
        "SELECT table_schema, table_name, table_type "
        "FROM information_schema.tables "
        "WHERE table_schema = ANY($1::text[]) "
        "ORDER BY table_schema, table_name"
    )
    rows = await _fetch_readonly(
        pool, sql, sorted(schemas), statement_timeout_ms=statement_timeout_ms
    )
    return [dict(row) for row in rows]


async def safe_describe(
    *,
    pool: Any,
    policy: TableAccessPolicy,
    table: str,
    statement_timeout_ms: int | None = DEFAULT_STATEMENT_TIMEOUT_MS,
) -> list[dict[str, Any]]:
    """Return column name + type for a policy-allowed, schema-qualified table."""

    schema, name = _split_qualified(table)
    if not policy.is_allowed(schema=schema, table=name):
        raise AllowlistViolation(
            f"describe target {table!r} is outside the allowlist ({policy.describe()})"
        )
    sql = (
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position"
    )
    rows = await _fetch_readonly(
        pool, sql, schema, name, statement_timeout_ms=statement_timeout_ms
    )
    return [dict(row) for row in rows]


def _bounded(limit: int, max_rows: int) -> int:
    cap = max(1, min(max_rows, HARD_LIMIT_CAP))
    return max(1, min(limit, cap))


async def safe_select(
    *,
    pool: Any,
    policy: TableAccessPolicy,
    table: str,
    where: str | None = None,
    order: str | None = None,
    limit: int = DEFAULT_LIMIT,
    columns: list[str] | None = None,
    max_rows: int = HARD_LIMIT_CAP,
    statement_timeout_ms: int | None = DEFAULT_STATEMENT_TIMEOUT_MS,
) -> list[dict[str, Any]]:
    """Bounded, gate-validated, read-only SELECT against a policy-allowed table."""

    bounded_limit = _bounded(limit, max_rows)
    col_clause = ", ".join(quote_ident(c) for c in columns) if columns else "*"

    sql = f"SELECT {col_clause} FROM {table}"
    if where:
        sql += f" WHERE {where}"
    if order:
        sql += f" ORDER BY {order}"
    sql += f" LIMIT {bounded_limit}"

    ast = validate_select_sql(sql, table_policy=policy)
    safe_sql = render_safe(ast)
    rows = await _fetch_readonly(
        pool, safe_sql, statement_timeout_ms=statement_timeout_ms
    )
    return [dict(row) for row in rows]


async def safe_grep(
    *,
    pool: Any,
    policy: TableAccessPolicy,
    table: str,
    column: str,
    pattern: str,
    limit: int = DEFAULT_LIMIT,
    max_rows: int = HARD_LIMIT_CAP,
    statement_timeout_ms: int | None = DEFAULT_STATEMENT_TIMEOUT_MS,
) -> list[dict[str, Any]]:
    """SELECT * WHERE col ILIKE pattern — sugar over ``safe_select``."""

    bounded_limit = _bounded(limit, max_rows)
    col = quote_ident(column)
    sql_for_gate = f"SELECT * FROM {table} WHERE {col} ILIKE $1 LIMIT {bounded_limit}"
    ast = validate_select_sql(sql_for_gate, table_policy=policy)
    safe_sql = render_safe(ast)
    rows = await _fetch_readonly(
        pool, safe_sql, pattern, statement_timeout_ms=statement_timeout_ms
    )
    return [dict(row) for row in rows]


async def safe_explain(
    *,
    pool: Any,
    policy: TableAccessPolicy,
    query: str,
    cost_threshold: float,
    statement_timeout_ms: int | None = DEFAULT_STATEMENT_TIMEOUT_MS,
) -> dict[str, Any]:
    """EXPLAIN (FORMAT JSON) the query; refuse if total cost > threshold."""

    ast = validate_select_sql(query, table_policy=policy)
    safe_inner = render_safe(ast)
    rows = await _fetch_readonly(
        pool,
        f"EXPLAIN (FORMAT JSON) {safe_inner}",
        statement_timeout_ms=statement_timeout_ms,
    )
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
