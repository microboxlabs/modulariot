"""Call an analyst's SQL function inside the read-only envelope.

The harness renders the call itself (`SELECT * FROM schema.fn(p_a => $1, …)`),
so the statement never goes through the SQL gate's function allowlist. What
keeps it safe is the envelope: the transaction is read-only, so a routine that
writes fails at execution; a statement timeout and a row cap bound the cost.

Refused before any call: procedures, routines outside the allowed schemas,
SECURITY DEFINER routines unless the connection opts in (they run with the
owner's grants, not the harness role's), and routines whose `@meta` declares
side effects.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import asyncpg

from miot_harness.datasource.pg_description import parse_pg_description
from miot_harness.datasource.safe_query import (
    DEFAULT_STATEMENT_TIMEOUT_MS,
    QueryRun,
    fetch_readonly,
    record_to_dict,
    run_readonly,
)
from miot_harness.datasource.safe_sql import (
    HARD_LIMIT_CAP,
    AllowlistViolation,
    CostGateViolation,
    UnsupportedConstruct,
)
from miot_harness.datasource.sql_policy import TableAccessPolicy

_IN_MODES = frozenset({"i", "b", "v"})

_ROUTINE_LOOKUP_QUERY = """
SELECT n.nspname AS schema,
       p.proname AS name,
       p.prokind::text AS kind,
       p.prosecdef AS security_definer,
       p.pronargs AS nargs,
       p.pronargdefaults AS ndefaults,
       p.proargnames AS arg_names,
       p.proargmodes::text[] AS arg_modes,
       (SELECT array_agg(pg_catalog.format_type(t.oid, NULL) ORDER BY a.ord)
          FROM unnest(p.proargtypes) WITH ORDINALITY AS a(oid, ord)
          JOIN pg_catalog.pg_type t ON t.oid = a.oid) AS arg_types,
       pg_catalog.pg_get_function_arguments(p.oid) AS signature,
       d.description AS description
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_language l ON l.oid = p.prolang
LEFT JOIN pg_catalog.pg_description d
  ON d.objoid = p.oid AND d.classoid = 'pg_catalog.pg_proc'::regclass
WHERE n.nspname = $1
  AND p.proname = $2
  AND p.prokind IN ('f', 'p')
  AND l.lanname NOT IN ('c', 'internal')
  AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend dep
        WHERE dep.classid = 'pg_catalog.pg_proc'::regclass
          AND dep.objid = p.oid AND dep.deptype = 'e'
      )
  AND pg_catalog.has_function_privilege(p.oid, 'EXECUTE')
  AND pg_catalog.has_schema_privilege(n.oid, 'USAGE')
ORDER BY p.oid
"""


@dataclass(frozen=True)
class RoutineSignature:
    schema: str
    name: str
    kind: str  # f | p
    security_definer: bool
    in_args: tuple[tuple[str, str], ...]  # (name, type) of IN arguments
    required: int  # leading IN arguments without a default
    signature: str
    side_effects: str | None  # `@meta side_effects`, when declared

    @property
    def qualified(self) -> str:
        return f"{self.schema}.{self.name}"


def _signature_from_row(row: Any) -> RoutineSignature:
    names = list(row["arg_names"] or [])
    modes = list(row["arg_modes"] or [])
    types = list(row["arg_types"] or [])
    nargs = int(row["nargs"] or 0)
    if modes:
        in_names = [n for n, m in zip(names, modes, strict=False) if m in _IN_MODES]
    else:
        in_names = names[:nargs]
    in_names = in_names[:nargs] + [""] * max(0, nargs - len(in_names))
    in_args = tuple(zip(in_names, types[:nargs], strict=False))
    meta = parse_pg_description(row["description"]).meta
    return RoutineSignature(
        schema=row["schema"],
        name=row["name"],
        kind=row["kind"],
        security_definer=bool(row["security_definer"]),
        in_args=in_args,
        required=nargs - int(row["ndefaults"] or 0),
        signature=row["signature"] or "",
        side_effects=meta.get("side_effects"),
    )


def _as_text(value: Any) -> str | None:
    """Every argument travels as text and is cast to the declared type in SQL."""
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str)
    return str(value)


def _quote(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def _matches(sig: RoutineSignature, provided: set[str]) -> bool:
    names = {n for n, _ in sig.in_args}
    required = {n for n, _ in sig.in_args[: sig.required]}
    return provided <= names and required <= provided


def _render(
    sig: RoutineSignature, args: dict[str, Any], cap: int
) -> tuple[str, str, list[str | None]]:
    """Return (parametrized sql, display sql with literals, parameters)."""
    params: list[str | None] = []
    holders: list[str] = []
    literals: list[str] = []
    for name, typ in sig.in_args:
        if name not in args:
            continue
        params.append(_as_text(args[name]))
        n = len(params)
        holders.append(f"{name} => ${n}::text::{typ}")
        literals.append(f"{name} => {_quote(params[-1])}::{typ}")
    call = f"SELECT * FROM {sig.qualified}({{}})"
    wrap = f"SELECT * FROM ({call}) AS _miot_q LIMIT {cap}"
    return (
        wrap.format(", ".join(holders)),
        wrap.format(", ".join(literals)),
        params,
    )


async def _candidates(
    pool: object,
    policy: TableAccessPolicy,
    name: str,
    statement_timeout_ms: int | None,
) -> list[RoutineSignature]:
    schemas = policy.allowed_schemas()
    if name.count(".") > 1 or not name or name.endswith("."):
        raise UnsupportedConstruct(f"routine {name!r} must be 'name' or 'schema.name'")
    if "." in name:
        schema, _, obj = name.partition(".")
        if schemas is None or schema not in schemas:
            raise AllowlistViolation(f"{name!r} is outside the allowlist ({policy.describe()})")
        order = [schema]
    else:
        if not schemas:
            raise AllowlistViolation(f"{name!r} is outside the allowlist ({policy.describe()})")
        obj = name
        order = sorted(schemas)
    for schema in order:
        rows = await fetch_readonly(
            pool,
            _ROUTINE_LOOKUP_QUERY,
            schema,
            obj,
            statement_timeout_ms=statement_timeout_ms,
        )
        if rows:
            return [_signature_from_row(r) for r in rows]
    return []


async def safe_call_routine(
    *,
    pool: object,
    policy: TableAccessPolicy,
    name: str,
    args: dict[str, Any] | None = None,
    max_rows: int = HARD_LIMIT_CAP,
    cost_threshold: float | None = None,
    allow_security_definer: bool = False,
    statement_timeout_ms: int | None = DEFAULT_STATEMENT_TIMEOUT_MS,
) -> QueryRun:
    """Run `SELECT * FROM name(args)` inside the read-only envelope.

    `args` maps IN-argument names to values; arguments with defaults may be
    omitted. Overloads are resolved by the argument names given.
    """
    args = dict(args or {})
    candidates = await _candidates(pool, policy, name, statement_timeout_ms)
    if not candidates:
        raise UnsupportedConstruct(f"no executable routine named {name!r} in the allowed schemas")
    provided = set(args)
    matching = [c for c in candidates if _matches(c, provided)]
    if not matching:
        sigs = "; ".join(f"{c.qualified}({c.signature})" for c in candidates)
        raise UnsupportedConstruct(
            f"arguments {sorted(provided)} do not match any signature: {sigs}"
        )
    if len(matching) > 1:
        sigs = "; ".join(f"{c.qualified}({c.signature})" for c in matching)
        raise UnsupportedConstruct(f"ambiguous call; pass more argument names: {sigs}")
    sig = matching[0]
    if sig.kind == "p":
        raise UnsupportedConstruct(f"{sig.qualified} is a procedure; only functions run")
    if sig.security_definer and not allow_security_definer:
        raise AllowlistViolation(
            f"{sig.qualified} is SECURITY DEFINER: it runs with its owner's grants, "
            "not this connection's. The connection must opt in with "
            "`call_security_definer: true`."
        )
    if sig.side_effects is not None and sig.side_effects.strip().lower() != "none":
        raise UnsupportedConstruct(
            f"{sig.qualified} declares side_effects: {sig.side_effects}; refused"
        )
    cap = max(1, min(int(max_rows), HARD_LIMIT_CAP))
    sql, display, params = _render(sig, args, cap)

    async def _gated_fetch(conn: Any) -> list[Any]:
        if cost_threshold is not None:
            plan_rows = await conn.fetch(f"EXPLAIN (FORMAT JSON) {sql}", *params)
            plan = json.loads(plan_rows[0][0]) if plan_rows else []
            total_cost = float((plan[0].get("Plan") or {}).get("Total Cost", 0.0)) if plan else 0.0
            if total_cost > cost_threshold:
                raise CostGateViolation(
                    f"plan total_cost={total_cost:.1f} exceeds threshold {cost_threshold:.1f}"
                )
        try:
            return list(await conn.fetch(sql, *params))
        except asyncpg.ReadOnlySQLTransactionError as exc:
            raise UnsupportedConstruct(
                f"{sig.qualified} tried to write; refused by the read-only envelope ({exc})"
            ) from exc

    rows = await run_readonly(pool, _gated_fetch, statement_timeout_ms=statement_timeout_ms)
    return QueryRun(rows=[record_to_dict(r) for r in rows], sql=display)
