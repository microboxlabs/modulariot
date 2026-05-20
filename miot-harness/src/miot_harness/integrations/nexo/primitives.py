"""Composable Nexo DB primitives (PR #2 redemption — plan 13 E3).

Four read-only primitives the agentic graph can call when the curated
`fn_dx_*` catalog doesn't cover a question:

- ``nexo_describe`` — ``pg_catalog`` introspection → columns + types.
  Allowlist ``nexo.*``; read-only.
- ``nexo_select`` — parameterised SELECT with optional WHERE / ORDER /
  LIMIT. sqlglot AST + allowlist + bounded LIMIT (default 100, cap
  5000).
- ``nexo_grep`` — sugar for ``SELECT ... WHERE col ILIKE pattern``.
  Same gate as ``nexo_select`` + single-column constraint.
- ``nexo_explain`` — ``EXPLAIN (FORMAT JSON)``. Refuses if total cost
  exceeds the env-tunable threshold.

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
    exp.Merge,
    exp.Copy,
    # Row-locking syntax (`SELECT … FOR UPDATE`, `FOR SHARE`, `FOR KEY SHARE`,
    # incl. `NOWAIT` / `SKIP LOCKED`). Read-shaped at the AST level but
    # acquires row-level locks — against `nexo.dx_*` snapshots this can block
    # the refresh job; against Citus it can escalate. The read-only DB role
    # would refuse it at runtime, but gate it here for defense in depth.
    exp.Lock,
)


# Positive allowlist of functions the agent may invoke. Anything else —
# notably `pg_terminate_backend`, `set_config`, `pg_sleep`, `pg_read_file`,
# `lo_import`, `dblink`, `pg_advisory_lock`, `pg_reload_conf` — is treated
# as a side-effect/escape hatch and rejected. Postgres considers many of
# these "read-only" at the planner level (no Insert/Update/Delete AST
# node) but they DoS, mutate session state, exfiltrate files, or kill
# other backends. A positive allowlist is the only durable defense.
#
# Add new entries on demand — every additional name is a small security
# review. Lowercase, sqlglot canonicalises identifiers when comparing.
_SAFE_FUNCTIONS: frozenset[str] = frozenset(
    {
        # aggregates
        "count", "sum", "avg", "min", "max", "stddev", "variance",
        "array_agg", "string_agg", "bool_and", "bool_or",
        "json_agg", "jsonb_agg", "json_object_agg", "jsonb_object_agg",
        # numeric
        "abs", "ceil", "ceiling", "floor", "round", "trunc",
        "mod", "div", "power", "sqrt", "ln", "log", "exp",
        # string
        "lower", "upper", "length", "char_length", "octet_length",
        "substring", "substr", "replace", "trim", "btrim", "ltrim", "rtrim",
        "concat", "concat_ws", "position", "strpos",
        "regexp_replace", "regexp_matches", "regexp_match", "regexp_split_to_array",
        "split_part", "to_char", "starts_with", "left", "right", "reverse",
        # date/time (read-only) — both Postgres spellings AND sqlglot canonical names
        "now", "current_timestamp", "current_date", "current_time",
        "currenttimestamp", "currentdate", "currenttime",  # sqlglot class slugs
        "date_trunc", "datetrunc", "timestamp_trunc", "timestamptrunc",
        "date_part", "datepart", "extract", "age",
        "to_timestamp", "to_date", "totimestamp", "todate",
        "time_to_str", "timetostr",
        "make_date", "make_timestamp", "makedate", "maketimestamp",
        "justify_interval", "justify_hours", "justify_days",
        # conversion / null-handling
        "cast", "coalesce", "nullif", "greatest", "least",
        # array
        "array_length", "cardinality", "unnest", "array_append",
        "array_prepend", "array_cat", "array_position", "array_positions",
        # json
        "json_build_object", "jsonb_build_object",
        "json_build_array", "jsonb_build_array",
        "json_extract_path", "jsonb_extract_path",
        "json_extract_path_text", "jsonb_extract_path_text",
        "json_array_elements", "jsonb_array_elements",
        "json_array_elements_text", "jsonb_array_elements_text",
        "json_each", "jsonb_each", "json_object_keys", "jsonb_object_keys",
        "jsonb_pretty", "jsonb_typeof", "json_typeof",
        # misc (truly read-only)
        "row_number", "rank", "dense_rank", "lag", "lead",
        "first_value", "last_value", "nth_value",
    }
)


def validate_select_sql(sql: str) -> exp.Expression:
    """Parse SQL with sqlglot and raise on any safety violation.

    Returns the parsed AST so callers can re-serialize via ``ast.sql()``
    after validation (defense in depth — see ``_render_safe`` below).
    """

    try:
        statements = sqlglot.parse(sql, dialect="postgres")
    except sqlglot.errors.ParseError as exc:
        raise UnsupportedConstruct(f"sqlglot parse error: {exc}") from exc

    real_statements = [s for s in statements if s is not None]
    if len(real_statements) != 1:
        raise MultiStatementRejected(
            f"expected exactly 1 statement, got {len(real_statements)}"
        )
    ast = real_statements[0]

    # 1. No mutations / DDL / DCL anywhere in the tree.
    for node in ast.walk():
        if isinstance(node, _MUTATION_NODES):
            raise MutationRejected(
                f"mutation construct rejected: {type(node).__name__}"
            )

    if not isinstance(ast, (exp.Select, exp.Union)):
        raise UnsupportedConstruct(
            f"top-level construct must be SELECT or UNION, got {type(ast).__name__}"
        )

    # 2. No LATERAL — its function-as-table form bypasses the table
    #    allowlist (`LATERAL pg_read_file('/etc/passwd')` reads server
    #    files without ever instantiating an exp.Table node).
    for lat in ast.find_all(exp.Lateral):
        raise UnsupportedConstruct(
            "LATERAL is rejected by the composable primitives gate "
            f"(found at: {lat.sql(dialect='postgres')[:80]!r})"
        )

    # 3. Every function call must be in the safe-builtin allowlist.
    #    sqlglot emits dedicated AST classes for common builtins (`Sum`,
    #    `Count`, `Cast`, `Coalesce`, `TimestampTrunc`, ...) and
    #    `exp.Anonymous` for everything else. We accept if ANY candidate
    #    name (sql_name, key, class name, Anonymous.this) is in the
    #    allowlist — robust to sqlglot's per-builtin AST normalization.
    for func in ast.find_all(exp.Func):
        candidates = _function_name_candidates(func)
        if not candidates:
            continue  # synthetic Func with no resolvable name — skip
        if not candidates & _SAFE_FUNCTIONS:
            picked = next(iter(candidates))
            raise UnsupportedConstruct(
                f"function {picked!r} is not in the composable-primitives allowlist"
            )

    # 4. Every table reference must be allowlisted. CTE aliases referenced
    #    in the outer SELECT show up as exp.Table too — collect their
    #    alias names from `exp.With` and exempt them from the allowlist
    #    check (the CTE BODY itself was already walked above).
    cte_aliases: set[str] = set()
    for with_clause in ast.find_all(exp.With):
        for cte in with_clause.expressions:
            alias = cte.alias_or_name
            if alias:
                cte_aliases.add(alias.lower())

    for table in ast.find_all(exp.Table):
        schema = table.args.get("db") or table.args.get("catalog")
        schema_name = schema.name if schema is not None else ""
        table_name = table.name
        qualified = f"{schema_name}.{table_name}" if schema_name else table_name
        if (
            not schema_name
            and table_name
            and table_name.lower() in cte_aliases
        ):
            continue  # CTE alias reference — allowed
        if not _ALLOWED_TABLE_RE.match(qualified):
            raise AllowlistViolation(
                f"table {qualified!r} is outside the allowlist (nexo.dx_*)"
            )

    return ast


def _function_name_candidates(func: exp.Func) -> set[str]:
    """Return all lowercase names a function might match in the allowlist.

    sqlglot exposes a function under several aliases:
    - `Anonymous.this` is the literal SQL name (`'pg_terminate_backend'`).
    - Dedicated builtins (`Sum`, `Count`, `TimestampTrunc`) expose
      `sql_name()` returning the canonical SQL token (`SUM`,
      `TIMESTAMP_TRUNC`) and `key` returning the lowercase class slug
      (`sum`, `timestamptrunc`).
    - The class name (`TimestampTrunc`) is a fallback.

    We collect every form so the allowlist can use any spelling.
    """

    candidates: set[str] = set()
    if isinstance(func, exp.Anonymous):
        this = func.this
        if this:
            candidates.add(str(this).lower())
    # `sql_name()` (canonical SQL token, e.g. "TIMESTAMP_TRUNC").
    sql_name = getattr(func, "sql_name", None)
    if callable(sql_name):
        try:
            value = sql_name()
        except Exception:  # noqa: BLE001
            value = None
        if value:
            candidates.add(str(value).lower())
    # `key` (sqlglot's internal slug, e.g. "timestamptrunc").
    key = getattr(func, "key", None)
    if isinstance(key, str) and key:
        candidates.add(key.lower())
    # Class name (e.g. "TimestampTrunc" -> "timestamptrunc").
    candidates.add(type(func).__name__.lower())
    return candidates


def _render_safe(ast: exp.Expression) -> str:
    """Re-serialize the validated AST so the DB sees only what we approved.

    Comments, whitespace tricks, and any structurally-equivalent rewrites
    sqlglot prefers are normalized away. The caller's original string is
    discarded after validation.
    """

    return ast.sql(dialect="postgres")


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
