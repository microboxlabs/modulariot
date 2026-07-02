"""Backend-agnostic SQL safety gate (shared by Nexo + generic connections).

Extracted from `integrations/nexo/primitives.py` so there is exactly ONE audited
validator. The only per-connection decision — *which tables may be read* — is
injected as a `TableAccessPolicy`; everything else (single-statement,
no-mutation, no-LATERAL, function allowlist, AST re-render) is universal.

`validate_select_sql` parses the SQL with sqlglot, rejects anything outside the
read-only envelope BEFORE the DB sees it, and returns the parsed AST so callers
can re-serialize via `render_safe()` (defense in depth — the caller's original
string is discarded).
"""

from __future__ import annotations

import re

import sqlglot
from sqlglot import exp

from miot_harness.datasource.sql_policy import TableAccessPolicy

# ----------------------------------------------------------------------
# Safety gate exceptions
# ----------------------------------------------------------------------


class SafetyGateViolation(Exception):
    """Base for all gate rejections — agent surfaces the reason."""


class MultiStatementRejected(SafetyGateViolation):
    """Composable primitives accept exactly one statement; bare ``;`` is fatal."""


class MutationRejected(SafetyGateViolation):
    """Any DML/DDL/DCL is rejected — composable primitives are read-only."""


class AllowlistViolation(SafetyGateViolation):
    """Table is outside the connection's TableAccessPolicy."""


class UnsupportedConstruct(SafetyGateViolation):
    """SQL contains a construct we cannot statically reason about."""


class CostGateViolation(SafetyGateViolation):
    """EXPLAIN reports a total cost above the configured threshold."""


# ----------------------------------------------------------------------
# Universal limits + identifier quoting
# ----------------------------------------------------------------------

DEFAULT_LIMIT = 100
HARD_LIMIT_CAP = 5000


def quote_ident(ident: str) -> str:
    if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", ident):
        raise UnsupportedConstruct(f"identifier {ident!r} contains unsafe characters")
    return f'"{ident}"'


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
    # acquires row-level locks — against snapshot tables this can block the
    # refresh job; against Citus it can escalate. The read-only DB role would
    # refuse it at runtime, but gate it here for defense in depth.
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


def validate_select_sql(sql: str, *, table_policy: TableAccessPolicy) -> exp.Expression:
    """Parse SQL with sqlglot and raise on any safety violation.

    `table_policy` decides which tables may be read; every other check is
    universal. Returns the parsed AST so callers can re-serialize via
    `render_safe` (defense in depth).
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
            "LATERAL is rejected by the safe-query gate "
            f"(found at: {lat.sql(dialect='postgres')[:80]!r})"
        )

    # 3. Arbitrary/unknown function NAMES must be allowlisted.
    #    The escape-hatch threats — pg_read_file, dblink, pg_sleep, set_config,
    #    lo_import, pg_terminate_backend, pg_advisory_lock, … — are all parsed by
    #    sqlglot as `exp.Anonymous` (it has no dedicated class for them). Every
    #    DEDICATED Func subclass (Sum/Count/Cast/Coalesce/Case/And/Or/Extract/
    #    Interval/window fns/…) is a recognized, inherently read-only SQL
    #    construct — gating those by name caused false rejects (AND/OR/CASE) and
    #    blocked legitimate analytical SQL. So we gate ONLY Anonymous names
    #    against the allowlist; that is exactly where the dangerous functions
    #    live, and adding a new Postgres function name still requires a review.
    for func in ast.find_all(exp.Anonymous):
        candidates = _function_name_candidates(func)
        if not candidates:
            continue  # unresolvable name — nothing to match
        if not candidates & _SAFE_FUNCTIONS:
            picked = next(iter(candidates))
            raise UnsupportedConstruct(
                f"function {picked!r} is not in the safe-query allowlist"
            )

    # 4. Every table reference must be allowed by the policy. CTE aliases
    #    referenced in the outer SELECT show up as exp.Table too — collect their
    #    alias names from `exp.With` and exempt them from the policy check (the
    #    CTE BODY itself was already walked above).
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
        if not table_policy.is_allowed(schema=schema_name, table=table_name):
            raise AllowlistViolation(
                f"table {qualified!r} is outside the allowlist "
                f"({table_policy.describe()})"
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


def render_safe(ast: exp.Expression) -> str:
    """Re-serialize the validated AST so the DB sees only what we approved.

    Comments, whitespace tricks, and any structurally-equivalent rewrites
    sqlglot prefers are normalized away. The caller's original string is
    discarded after validation.
    """

    return ast.sql(dialect="postgres")
