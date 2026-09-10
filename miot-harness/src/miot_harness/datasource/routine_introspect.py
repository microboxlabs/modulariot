"""Routine catalog and object definitions for generic connections.

`introspect_routines` lists the functions and procedures a connection's role can
execute in its allowed schemas, with the analyst's `@meta` block parsed.
`fetch_definition` returns a view body or a function body so the agent can read
how the analyst joined things, instead of guessing from column names.

Both run inside the read-only envelope. Extension-owned routines (PostGIS,
pgRouting) are excluded: they are not the analyst's work.
"""

from __future__ import annotations

from dataclasses import dataclass

from miot_harness.datasource.pg_description import (
    ParsedDescription,
    parse_pg_description,
)
from miot_harness.datasource.safe_query import (
    DEFAULT_STATEMENT_TIMEOUT_MS,
    fetch_readonly,
)
from miot_harness.datasource.safe_sql import AllowlistViolation, UnsupportedConstruct
from miot_harness.datasource.sql_policy import TableAccessPolicy

_VOLATILITY = {"i": "immutable", "s": "stable", "v": "volatile"}
_KIND = {"f": "function", "p": "procedure"}
_RELKIND = {"v": "view", "m": "materialized view"}


@dataclass(frozen=True)
class RoutineInfo:
    schema: str
    name: str
    args: str
    returns: str
    kind: str  # function | procedure
    volatility: str  # immutable | stable | volatile
    language: str
    description: ParsedDescription

    @property
    def qualified(self) -> str:
        return f"{self.schema}.{self.name}"


@dataclass(frozen=True)
class RoutineCatalog:
    routines: tuple[RoutineInfo, ...]
    total: int  # matching routines before the limit


@dataclass(frozen=True)
class ObjectDefinition:
    qualified: str
    kind: str  # view | materialized view | function | procedure
    definition: str
    description: str = ""
    truncated: bool = False


_ROUTINES_QUERY = """
SELECT n.nspname AS schema,
       p.proname AS name,
       pg_catalog.pg_get_function_arguments(p.oid) AS args,
       pg_catalog.pg_get_function_result(p.oid) AS returns,
       p.prokind::text AS kind,
       p.provolatile::text AS volatility,
       l.lanname AS language,
       d.description AS description,
       count(*) OVER () AS total
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_language l ON l.oid = p.prolang
LEFT JOIN pg_catalog.pg_description d
  ON d.objoid = p.oid AND d.classoid = 'pg_catalog.pg_proc'::regclass
WHERE n.nspname = ANY($1::text[])
  AND p.prokind IN ('f', 'p')
  AND l.lanname NOT IN ('c', 'internal')
  AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend dep
        WHERE dep.classid = 'pg_catalog.pg_proc'::regclass
          AND dep.objid = p.oid AND dep.deptype = 'e'
      )
  AND pg_catalog.has_function_privilege(p.oid, 'EXECUTE')
  AND pg_catalog.has_schema_privilege(n.oid, 'USAGE')
  AND ($2::text IS NULL OR p.proname ILIKE $2 OR d.description ILIKE $2)
ORDER BY n.nspname, p.proname, p.oid
LIMIT $3
"""


def _substring_pattern(pattern: str | None) -> str | None:
    """A pattern with `%` is ILIKE as written; anything else is a literal
    substring, so `_` in a name like fn_dx_x matches itself, not any char."""
    if pattern is None or "%" in pattern:
        return pattern
    literal = pattern.replace("\\", "\\\\").replace("_", "\\_")
    return f"%{literal}%"


async def introspect_routines(
    *,
    pool: object,
    policy: TableAccessPolicy,
    pattern: str | None = None,
    limit: int = 50,
    statement_timeout_ms: int | None = DEFAULT_STATEMENT_TIMEOUT_MS,
) -> RoutineCatalog:
    """Executable routines in the policy's schemas, optionally filtered by a
    case-insensitive pattern on name or description. A pattern without `%` is
    a substring match. `limit=0` returns only the total."""
    schemas = policy.allowed_schemas()
    if not schemas:
        return RoutineCatalog(routines=(), total=0)
    rows = await fetch_readonly(
        pool,
        _ROUTINES_QUERY,
        sorted(schemas),
        _substring_pattern(pattern),
        # LIMIT 0 would drop the window row that carries the total.
        max(1, limit),
        statement_timeout_ms=statement_timeout_ms,
    )
    total = int(rows[0]["total"]) if rows else 0
    routines = tuple(
        RoutineInfo(
            schema=r["schema"],
            name=r["name"],
            args=r["args"] or "",
            returns=r["returns"] or "",
            kind=_KIND.get(r["kind"], r["kind"]),
            volatility=_VOLATILITY.get(r["volatility"], r["volatility"]),
            language=r["language"],
            description=parse_pg_description(r["description"]),
        )
        for r in rows[:limit]
    )
    return RoutineCatalog(routines=routines, total=total)


_RELATION_DEF_QUERY = """
SELECT c.relkind::text AS relkind,
       CASE WHEN c.relkind IN ('v', 'm')
            THEN pg_catalog.pg_get_viewdef(c.oid, true) END AS definition,
       pg_catalog.obj_description(c.oid, 'pg_class') AS description
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1 AND c.relname = $2
  AND c.relkind IN ('r', 'v', 'm', 'p', 'f')
  AND pg_catalog.has_table_privilege(c.oid, 'SELECT')
  AND pg_catalog.has_schema_privilege(n.oid, 'USAGE')
"""

_ROUTINE_DEF_QUERY = """
SELECT p.prokind::text AS kind,
       pg_catalog.pg_get_functiondef(p.oid) AS definition,
       pg_catalog.obj_description(p.oid, 'pg_proc') AS description
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_language l ON l.oid = p.prolang
WHERE n.nspname = $1 AND p.proname = $2
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


def _clip(text: str, max_chars: int) -> tuple[str, bool]:
    if max_chars <= 0 or len(text) <= max_chars:
        return text, False
    return text[:max_chars] + "\n-- … truncated …", True


async def fetch_definition(
    *,
    pool: object,
    policy: TableAccessPolicy,
    name: str,
    max_chars: int = 20_000,
    statement_timeout_ms: int | None = DEFAULT_STATEMENT_TIMEOUT_MS,
) -> list[ObjectDefinition]:
    """Definitions for a view or routine. Overloaded routines return one entry
    each. A relation name wins over a same-named routine: a plain table returns
    an empty list (use describe). An unqualified name is looked up in each
    allowed schema in order and the first schema with a match wins."""
    schemas = policy.allowed_schemas()
    if name.count(".") > 1 or not name or name.startswith(".") or name.endswith("."):
        raise UnsupportedConstruct(f"object {name!r} must be 'name' or 'schema.name'")
    if "." in name:
        schema, _, obj = name.partition(".")
        if schemas is None or schema not in schemas:
            raise AllowlistViolation(
                f"{name!r} is outside the allowlist ({policy.describe()})"
            )
        candidates = [schema]
    else:
        if not schemas:
            raise AllowlistViolation(
                f"{name!r} is outside the allowlist ({policy.describe()})"
            )
        obj = name
        candidates = sorted(schemas)
    for schema in candidates:
        out = await _definition_in_schema(
            pool, policy, schema, obj, max_chars, statement_timeout_ms
        )
        if out is not None:
            return out
    return []


async def _definition_in_schema(
    pool: object,
    policy: TableAccessPolicy,
    schema: str,
    obj: str,
    max_chars: int,
    statement_timeout_ms: int | None,
) -> list[ObjectDefinition] | None:
    """Definitions of `schema.obj`, or None when nothing by that name exists."""
    qualified = f"{schema}.{obj}"
    out: list[ObjectDefinition] = []
    rel_rows = await fetch_readonly(
        pool, _RELATION_DEF_QUERY, schema, obj, statement_timeout_ms=statement_timeout_ms
    )
    for r in rel_rows:
        if r["definition"] is None:
            continue
        if not policy.is_allowed(schema=schema, table=obj):
            raise AllowlistViolation(
                f"{qualified!r} is outside the allowlist ({policy.describe()})"
            )
        text, truncated = _clip(r["definition"], max_chars)
        out.append(
            ObjectDefinition(
                qualified=qualified,
                kind=_RELKIND.get(r["relkind"], r["relkind"]),
                definition=text,
                description=r["description"] or "",
                truncated=truncated,
            )
        )
    if rel_rows:
        return out
    fn_rows = await fetch_readonly(
        pool, _ROUTINE_DEF_QUERY, schema, obj, statement_timeout_ms=statement_timeout_ms
    )
    for r in fn_rows:
        text, truncated = _clip(r["definition"] or "", max_chars)
        out.append(
            ObjectDefinition(
                qualified=qualified,
                kind=_KIND.get(r["kind"], r["kind"]),
                definition=text,
                description=r["description"] or "",
                truncated=truncated,
            )
        )
    return out if fn_rows else None
