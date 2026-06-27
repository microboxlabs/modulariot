"""Boot-time schema introspection for generic connections (Phase 2, slice 1).

Builds a compact, byte-stable **schema index** for a connection's allowed
schema(s): one line per table (name · type · row estimate). This is the
always-loaded "header" layer of the Connection Knowledge Base — the agent sees
what tables exist without spending a turn on `list_tables`; columns and FKs stay
lazy (`describe`).

Also exposes `introspect_foreign_keys` for the `describe`-with-FKs body.

All queries run inside Phase 1's read-only envelope (`fetch_readonly`:
`BEGIN READ ONLY` + `SET LOCAL statement_timeout`). Introspection reads
`pg_catalog`/`information_schema` directly (parameterised, harness-authored — not
agent SQL), so it does not go through the agent-facing SELECT gate.
"""

from __future__ import annotations

from dataclasses import dataclass

from miot_harness.datasource.safe_query import (
    DEFAULT_STATEMENT_TIMEOUT_MS,
    fetch_readonly,
)
from miot_harness.datasource.sql_policy import TableAccessPolicy


@dataclass(frozen=True)
class TableInfo:
    schema: str
    name: str
    table_type: str  # BASE TABLE | VIEW | MATERIALIZED VIEW | ...
    row_estimate: int | None  # pg_class.reltuples; None when never analyzed (<0)

    @property
    def qualified(self) -> str:
        return f"{self.schema}.{self.name}"


@dataclass(frozen=True)
class SchemaSummary:
    connection: str
    schemas: tuple[str, ...]
    tables: tuple[TableInfo, ...]  # capped to max_tables, sorted by qualified name
    total_tables: int  # before the cap
    primer: str = ""  # the connection.md body (carried for the grounding fold)
    # The FULL set of bare table names (uncapped) — for knowledge-pack
    # fingerprinting, which must see every table, not just the displayed slice.
    all_table_names: frozenset[str] = frozenset()

    @property
    def truncated(self) -> bool:
        return self.total_tables > len(self.tables)

    def render(self) -> str:
        """Compact, deterministic markdown index for the agent prompt.

        Sorted by qualified name (NOT row count) so the text is byte-stable for
        the process lifetime — keeps the prompt-cache prefix hot. Row estimates
        are fixed at boot, so they don't vary per request.
        """
        schema_label = ", ".join(self.schemas)
        head = f"Schema `{schema_label}` ({self.total_tables} tables):"
        lines = [head]
        for t in self.tables:
            est = _fmt_estimate(t.row_estimate)
            suffix = f" · {est}" if est else ""
            kind = "" if t.table_type == "BASE TABLE" else f" [{t.table_type.lower()}]"
            lines.append(f"- {t.qualified}{kind}{suffix}")
        if self.truncated:
            extra = self.total_tables - len(self.tables)
            lines.append(f"- (+{extra} more — use the connection's list_tables tool)")
        return "\n".join(lines)


@dataclass(frozen=True)
class ForeignKey:
    column: str
    ref_schema: str
    ref_table: str
    ref_column: str
    constraint: str = ""

    def render(self) -> str:
        return f"{self.column} → {self.ref_schema}.{self.ref_table}.{self.ref_column}"


def _estimate(raw: object) -> int | None:
    """pg_class.reltuples → row estimate; <0 means never analyzed (unknown)."""
    if not isinstance(raw, (int, float)):
        return None
    val = int(raw)
    return val if val >= 0 else None


def _fmt_estimate(rows: int | None) -> str:
    if rows is None:
        return ""
    if rows <= 0:
        return "empty"
    if rows < 1000:
        return f"~{rows} rows"
    if rows < 1_000_000:
        return f"~{rows / 1000:.0f}k rows"
    return f"~{rows / 1_000_000:.1f}M rows"


# Table list + type + row estimate from pg_catalog (reltuples is a planner
# statistic — free, no COUNT(*)). relkind: r=table, v=view, m=matview,
# p=partitioned, f=foreign.
_TABLES_QUERY = """
SELECT n.nspname AS table_schema,
       c.relname AS table_name,
       CASE c.relkind
            WHEN 'r' THEN 'BASE TABLE'
            WHEN 'v' THEN 'VIEW'
            WHEN 'm' THEN 'MATERIALIZED VIEW'
            WHEN 'p' THEN 'PARTITIONED TABLE'
            WHEN 'f' THEN 'FOREIGN TABLE'
            ELSE c.relkind::text
       END AS table_type,
       c.reltuples::bigint AS row_estimate
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = ANY($1::text[])
  AND c.relkind IN ('r', 'v', 'm', 'p', 'f')
ORDER BY n.nspname, c.relname
"""


async def introspect_schema(
    *,
    pool: object,
    policy: TableAccessPolicy,
    connection: str,
    max_tables: int = 80,
    primer: str = "",
    statement_timeout_ms: int | None = DEFAULT_STATEMENT_TIMEOUT_MS,
) -> SchemaSummary:
    """Survey the policy's allowed schema(s) into a bounded SchemaSummary."""
    schemas = policy.allowed_schemas()
    if not schemas:
        return SchemaSummary(
            connection=connection, schemas=(), tables=(), total_tables=0, primer=primer
        )
    sorted_schemas = tuple(sorted(schemas))
    rows = await fetch_readonly(
        pool,
        _TABLES_QUERY,
        list(sorted_schemas),
        statement_timeout_ms=statement_timeout_ms,
    )
    all_tables = [
        TableInfo(
            schema=r["table_schema"],
            name=r["table_name"],
            table_type=r["table_type"],
            row_estimate=_estimate(r["row_estimate"]),
        )
        for r in rows
    ]
    capped = all_tables[: max(0, max_tables)]
    return SchemaSummary(
        connection=connection,
        schemas=sorted_schemas,
        tables=tuple(capped),
        total_tables=len(all_tables),
        primer=primer,
        all_table_names=frozenset(t.name for t in all_tables),
    )


# Positional mapping so composite (multi-column) FKs pair each local column with
# the CORRECT referenced column. Joining KCU↔CCU on constraint name alone
# Cartesian-products multi-column keys; instead go through referential_constraints
# and match the referenced key_column_usage by
# `kcu.position_in_unique_constraint = ref_kcu.ordinal_position`.
_FK_QUERY = """
SELECT kcu.column_name AS column,
       ref_kcu.table_schema AS ref_schema,
       ref_kcu.table_name AS ref_table,
       ref_kcu.column_name AS ref_column,
       tc.constraint_name AS constraint
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = tc.constraint_schema
 AND rc.constraint_name = tc.constraint_name
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_schema = tc.constraint_schema
 AND kcu.constraint_name = tc.constraint_name
JOIN information_schema.key_column_usage ref_kcu
  ON ref_kcu.constraint_schema = rc.unique_constraint_schema
 AND ref_kcu.constraint_name = rc.unique_constraint_name
 AND ref_kcu.ordinal_position = kcu.position_in_unique_constraint
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = $1
  AND tc.table_name = $2
ORDER BY tc.constraint_name, kcu.ordinal_position
"""


async def introspect_foreign_keys(
    *,
    pool: object,
    schema: str,
    table: str,
    statement_timeout_ms: int | None = DEFAULT_STATEMENT_TIMEOUT_MS,
) -> list[ForeignKey]:
    """Declared foreign keys for one table (for `describe`-with-FKs)."""
    rows = await fetch_readonly(
        pool, _FK_QUERY, schema, table, statement_timeout_ms=statement_timeout_ms
    )
    return [
        ForeignKey(
            column=r["column"],
            ref_schema=r["ref_schema"],
            ref_table=r["ref_table"],
            ref_column=r["ref_column"],
            constraint=r["constraint"],
        )
        for r in rows
    ]
