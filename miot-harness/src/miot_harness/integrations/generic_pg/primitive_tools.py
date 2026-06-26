"""Generic safe-query primitives wrapped as HarnessTools.

Mirrors `integrations/nexo/primitive_tools.py` but backend-agnostic: the tools
are named by the connection's prefix (e.g. ``acs_select``) and run through the
shared `datasource/safe_query.py` primitives with a `TableAccessPolicy` and the
read-only execution envelope. Registered with ``kind="primitive"`` so the canned
filter_expert never surfaces them — they are the agentic executor surface.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from miot_harness.datasource.safe_query import (
    safe_describe,
    safe_explain,
    safe_grep,
    safe_list_tables,
    safe_select,
)
from miot_harness.datasource.schema_introspect import introspect_foreign_keys
from miot_harness.datasource.sql_policy import TableAccessPolicy
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress


class _ListTablesInput(BaseModel):
    pass


class _DescribeInput(BaseModel):
    table: str = Field(description="Schema-qualified table, e.g. acs.act_ru_task")


class _SelectInput(BaseModel):
    table: str = Field(description="Schema-qualified table, e.g. acs.act_ru_task")
    where: str | None = None
    order: str | None = None
    limit: int = 100
    columns: list[str] | None = None


class _GrepInput(BaseModel):
    table: str
    column: str
    pattern: str = Field(description="ILIKE pattern, e.g. %assignee%")
    limit: int = 100


class _ExplainInput(BaseModel):
    query: str = Field(description="A single SELECT over allowed schema tables")


class _RowsOutput(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)
    source: str = ""


class _DescribeOutput(BaseModel):
    columns: list[dict[str, Any]] = Field(default_factory=list)
    foreign_keys: list[dict[str, Any]] = Field(default_factory=list)
    source: str = ""


class _ExplainOutput(BaseModel):
    total_cost: float = 0.0
    node_type: str | None = None
    plan: dict[str, Any] = Field(default_factory=dict)
    source: str = ""


def build_generic_tools(
    *,
    pool: Any,
    policy: TableAccessPolicy,
    tool_prefix: str,
    source_label: str,
    tenant_lock: str | None,
    max_rows: int,
    explain_cost_threshold: float,
    statement_timeout_ms: int,
) -> list[HarnessTool[Any, Any]]:
    """Build the five generic safe-query primitives as registrable HarnessTools."""

    async def check_permission(
        ctx: HarnessContext, _input: BaseModel
    ) -> PermissionResult:
        if tenant_lock is not None and ctx.tenant_id != tenant_lock:
            return PermissionResult.deny(
                f"{source_label} is locked to tenant '{tenant_lock}'; "
                f"refusing for '{ctx.tenant_id}'."
            )
        return PermissionResult.allow("Read-only generic safe-query primitive")

    async def call_list_tables(
        ctx: HarnessContext, parsed: _ListTablesInput, progress: Progress
    ) -> _RowsOutput:
        rows = await safe_list_tables(
            pool=pool, policy=policy, statement_timeout_ms=statement_timeout_ms
        )
        return _RowsOutput(rows=rows, source=source_label)

    async def call_describe(
        ctx: HarnessContext, parsed: _DescribeInput, progress: Progress
    ) -> _DescribeOutput:
        columns = await safe_describe(
            pool=pool,
            policy=policy,
            table=parsed.table,
            statement_timeout_ms=statement_timeout_ms,
        )
        # FK relationships (the "how does this table connect" body). The policy
        # already validated the table in safe_describe; reuse its schema/name.
        schema, _, name = parsed.table.partition(".")
        fks = await introspect_foreign_keys(
            pool=pool,
            schema=schema,
            table=name,
            statement_timeout_ms=statement_timeout_ms,
        )
        return _DescribeOutput(
            columns=columns,
            foreign_keys=[
                {
                    "column": fk.column,
                    "references": f"{fk.ref_schema}.{fk.ref_table}.{fk.ref_column}",
                }
                for fk in fks
            ],
            source=source_label,
        )

    async def call_select(
        ctx: HarnessContext, parsed: _SelectInput, progress: Progress
    ) -> _RowsOutput:
        rows = await safe_select(
            pool=pool,
            policy=policy,
            table=parsed.table,
            where=parsed.where,
            order=parsed.order,
            limit=parsed.limit,
            columns=parsed.columns,
            max_rows=max_rows,
            statement_timeout_ms=statement_timeout_ms,
        )
        return _RowsOutput(rows=rows, source=source_label)

    async def call_grep(
        ctx: HarnessContext, parsed: _GrepInput, progress: Progress
    ) -> _RowsOutput:
        rows = await safe_grep(
            pool=pool,
            policy=policy,
            table=parsed.table,
            column=parsed.column,
            pattern=parsed.pattern,
            limit=parsed.limit,
            max_rows=max_rows,
            statement_timeout_ms=statement_timeout_ms,
        )
        return _RowsOutput(rows=rows, source=source_label)

    async def call_explain(
        ctx: HarnessContext, parsed: _ExplainInput, progress: Progress
    ) -> _ExplainOutput:
        result = await safe_explain(
            pool=pool,
            policy=policy,
            query=parsed.query,
            cost_threshold=explain_cost_threshold,
            statement_timeout_ms=statement_timeout_ms,
        )
        return _ExplainOutput(
            total_cost=result["total_cost"],
            node_type=result.get("node_type"),
            plan=result.get("plan", {}),
            source=source_label,
        )

    common: dict[str, Any] = {
        "read_only": True,
        "destructive": False,
        "kind": "primitive",
        "source": source_label,
        "check_permission": check_permission,
    }
    scope = policy.describe()
    return [
        HarnessTool(
            name=f"{tool_prefix}list_tables",
            description=(
                f"List tables/views {scope}. Use first to discover what exists "
                "before describe/select (this connection has no curated catalog)."
            ),
            input_model=_ListTablesInput,
            output_model=_RowsOutput,
            call=call_list_tables,
            **common,
        ),
        HarnessTool(
            name=f"{tool_prefix}describe",
            description=(
                f"Columns + types AND foreign-key relationships of a "
                f"schema-qualified table {scope}. Use to discover a table's shape "
                "and how it joins to others before select."
            ),
            input_model=_DescribeInput,
            output_model=_DescribeOutput,
            call=call_describe,
            **common,
        ),
        HarnessTool(
            name=f"{tool_prefix}select",
            description=(
                f"Bounded read-only SELECT against a schema-qualified table {scope} "
                "(optional where/order/columns; limit capped). Runs BEGIN READ ONLY "
                "with a statement timeout. sqlglot gate: single statement, no "
                "mutations, allowlisted tables and functions only."
            ),
            input_model=_SelectInput,
            output_model=_RowsOutput,
            call=call_select,
            **common,
        ),
        HarnessTool(
            name=f"{tool_prefix}grep",
            description=(
                f"Case-insensitive pattern search (ILIKE) on one column of a "
                f"schema-qualified table {scope}."
            ),
            input_model=_GrepInput,
            output_model=_RowsOutput,
            call=call_grep,
            **common,
        ),
        HarnessTool(
            name=f"{tool_prefix}explain",
            description=(
                "EXPLAIN (FORMAT JSON) for a candidate SELECT; refuses when the "
                "plan cost exceeds the configured threshold. Use before an "
                "expensive select."
            ),
            input_model=_ExplainInput,
            output_model=_ExplainOutput,
            call=call_explain,
            **common,
        ),
    ]
