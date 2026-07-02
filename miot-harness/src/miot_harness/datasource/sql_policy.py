"""Table-access policies for the shared safe-query gate.

The sqlglot safety gate (`datasource/safe_sql.py`) is backend-agnostic except for
one decision: *which tables may this connection touch?* That decision is a
`TableAccessPolicy` so the same gate serves both the curated Nexo path (a narrow
`nexo.dx_*` regex) and generic connections (a schema allowlist) — there is only
ONE audited validator, parameterised by policy.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@runtime_checkable
class TableAccessPolicy(Protocol):
    """Decides whether a (schema, table) reference is allowed by a connection."""

    def is_allowed(self, *, schema: str, table: str) -> bool:
        """True iff a SELECT may read `schema.table`. `schema` is "" when the
        reference is unqualified (the gate exempts CTE aliases before calling
        this, so an empty schema here means a genuinely unqualified table)."""
        ...

    def describe(self) -> str:
        """Human-readable policy summary, used in AllowlistViolation messages."""
        ...

    def allowed_schemas(self) -> frozenset[str] | None:
        """The schemas this policy enumerates, or None when not enumerable
        (e.g. a regex policy). Used by `list_tables` to know what to scan."""
        ...


@dataclass(frozen=True)
class RegexTablePolicy:
    """Allow a table iff its qualified name matches a regex.

    Reproduces the historical Nexo behaviour exactly: `^nexo\\.dx_[a-zA-Z0-9_]+$`.
    Not enumerable (`allowed_schemas` is None) — a regex describes a shape, not a
    finite schema set.
    """

    pattern: str

    def is_allowed(self, *, schema: str, table: str) -> bool:
        qualified = f"{schema}.{table}" if schema else table
        return bool(re.match(self.pattern, qualified))

    def describe(self) -> str:
        return f"matching {self.pattern}"

    def allowed_schemas(self) -> frozenset[str] | None:
        return None


@dataclass(frozen=True)
class SchemaAllowlistPolicy:
    """Allow any table that lives in one of an allowlisted set of schemas.

    Generic connections use this: a connection declares `options.schemas: [acs]`
    (or falls back to its `search_path`) and every table in those schemas becomes
    queryable, without enumerating ~70 tables. Unqualified tables are refused —
    the agent must write `acs.act_ru_task`, never a bare `act_ru_task` whose
    resolution depends on the server search_path.
    """

    schemas: frozenset[str]

    def is_allowed(self, *, schema: str, table: str) -> bool:
        if not schema:
            return False
        return schema in self.schemas

    def describe(self) -> str:
        return f"in schema(s) {', '.join(sorted(self.schemas))}"

    def allowed_schemas(self) -> frozenset[str] | None:
        return self.schemas
