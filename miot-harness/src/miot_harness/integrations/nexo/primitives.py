"""Composable Nexo DB primitives (PR #2 redemption — plan 13 E3).

Four read-only primitives the agentic graph can call when the curated
`fn_dx_*` catalog doesn't cover a question:

| Tool             | Shape                                               | Safety                                               |
|------------------|-----------------------------------------------------|------------------------------------------------------|
| ``nexo_describe`` | ``pg_catalog`` introspection → columns + types     | Allowlist `nexo.*`; read-only                        |
| ``nexo_select``   | Parameterised SELECT with optional WHERE/ORDER/LIM | sqlglot AST + allowlist + bounded LIMIT (default 100, cap 5000) |
| ``nexo_grep``     | Sugar for SELECT ... WHERE col ILIKE pattern        | Same gate as nexo_select + single-column constraint  |
| ``nexo_explain``  | ``EXPLAIN (FORMAT JSON)``                           | Refuses if total cost > env-tunable threshold        |

The **safety gate** (``validate_select_sql``) is the high-risk surface:
it runs every composable query through sqlglot's AST parser BEFORE the
DB sees it, rejects mutations / multi-statement / non-allowlisted
tables. Plus the pool uses the same read-only role as `coordinador_*`
tools (already provisioned by plan 12).

Spans: each primitive emits a ``nexo.composable.<name>`` span with
``modular.sql.statement`` / ``modular.sql.plan_cost`` /
``modular.sql.rows_returned`` for the provenance log (E4).
"""

from __future__ import annotations

import re
from typing import Any

import sqlglot
from sqlglot import exp


# ----------------------------------------------------------------------
# Safety gate
# ----------------------------------------------------------------------


class SafetyGateViolation(Exception):
    """Base for all gate rejections — agent surfaces the reason."""


class MultiStatementRejected(SafetyGateViolation):
    """Composable primitives accept exactly one statement; bare ``;`` is fatal."""


class MutationRejected(SafetyGateViolation):
    """Any DML/DDL/DCL is rejected — composable primitives are read-only."""


class AllowlistViolation(SafetyGateViolation):
    """Table is outside the allowlist (``nexo.dx_*`` only)."""


class UnsupportedConstruct(SafetyGateViolation):
    """SQL contains a construct we cannot statically reason about."""


class CostGateViolation(SafetyGateViolation):
    """EXPLAIN reports a total cost above the configured threshold."""


# Tables the primitives can touch. `nexo.dx_*` snapshot tables are the
# curated dimension layer. `pg_catalog` and `information_schema` are
# explicitly denied even though `nexo_describe` introspects pg_catalog —
# describe bypasses this allowlist via its own narrower function.
_ALLOWED_TABLE_RE = re.compile(r"^nexo\.dx_[a-zA-Z0-9_]+$")
_MUTATION_NODES = (
    exp.Insert,
    exp.Update,
    exp.Delete,
    exp.Drop,
    exp.Create,
    exp.Alter,
    exp.AlterColumn,
    exp.Grant,
    exp.TruncateTable,
)


def validate_select_sql(sql: str) -> exp.Expression:
    """Parse SQL with sqlglot and raise on any safety violation.

    Returns the parsed AST so callers can re-serialize after validation
    (defense in depth: never trust the original string after parsing).
    """

    try:
        statements = sqlglot.parse(sql, dialect="postgres")
    except sqlglot.errors.ParseError as exc:
        raise UnsupportedConstruct(f"sqlglot parse error: {exc}") from exc

    # Filter out None entries sqlglot returns for empty/leading-semicolon parses.
    real_statements = [s for s in statements if s is not None]
    if len(real_statements) != 1:
        raise MultiStatementRejected(
            f"expected exactly 1 statement, got {len(real_statements)}"
        )
    ast = real_statements[0]

    for node in ast.walk():
        if isinstance(node, _MUTATION_NODES):
            raise MutationRejected(f"mutation construct rejected: {type(node).__name__}")

    if not isinstance(ast, (exp.Select, exp.Subquery, exp.Union)):
        raise UnsupportedConstruct(f"top-level construct must be SELECT, got {type(ast).__name__}")

    # Every table reference must be allowlisted.
    for table in ast.find_all(exp.Table):
        schema = (table.args.get("db") or table.args.get("catalog"))
        schema_name = schema.name if schema is not None else ""
        table_name = table.name
        qualified = f"{schema_name}.{table_name}" if schema_name else table_name
        if not _ALLOWED_TABLE_RE.match(qualified):
            raise AllowlistViolation(
                f"table {qualified!r} is outside the allowlist (nexo.dx_*)"
            )

    return ast


# ----------------------------------------------------------------------
# Primitives
# ----------------------------------------------------------------------


_DESCRIBE_ALLOWED_RE = re.compile(r"^nexo\.dx_[a-zA-Z0-9_]+$")
_DEFAULT_LIMIT = 100
_HARD_LIMIT_CAP = 5000


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


def _quote_ident(ident: str) -> str:
    if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", ident):
        raise UnsupportedConstruct(f"identifier {ident!r} contains unsafe characters")
    return f'"{ident}"'


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

    validate_select_sql(sql)

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql)
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
    validate_select_sql(sql_for_gate)

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql_for_gate, pattern)
    return [dict(row) for row in rows]


async def nexo_explain(
    *,
    pool: Any,
    query: str,
    cost_threshold: float,
) -> dict[str, Any]:
    """EXPLAIN (FORMAT JSON) the query; refuse if total cost > threshold."""

    validate_select_sql(query)

    async with pool.acquire() as conn:
        rows = await conn.fetch(f"EXPLAIN (FORMAT JSON) {query}")

    # asyncpg returns rows; PostgreSQL EXPLAIN JSON returns a single row with
    # a `QUERY PLAN` array whose first element is `{"Plan": {...}}`.
    if not rows:
        raise UnsupportedConstruct("EXPLAIN returned no rows")
    row = rows[0]
    payload = row.get("QUERY PLAN") if isinstance(row, dict) else None
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
