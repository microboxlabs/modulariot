"""Composable Nexo primitives wrapped as HarnessTools (agentic executor).

The raw primitives in `primitives.py` are plain async functions guarded
by the sqlglot safety gate. This module lifts them into `HarnessTool`s
(kind="primitive") so the agentic planner can select them through the
shared ToolRegistry and the executor can invoke them via the same
`registry.invoke()` path as the curated `coordinador_*` tools.

Safety: every gate violation (`SafetyGateViolation` subclasses) raises
out of `call`, which `HarnessTool.invoke` converts into a `tool.failed`
event and the executor converts into `state["failure"]` — a graceful
refusal, never a crash. The canned filter_expert never sees these tools
because `build_tool_catalog` filters by the curated prefix.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from miot_harness.integrations.nexo.primitives import (
    nexo_describe,
    nexo_explain,
    nexo_grep,
    nexo_select,
)
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress


class _DescribeInput(BaseModel):
    table: str = Field(description="Qualified table name, e.g. nexo.dx_servicios")


class _SelectInput(BaseModel):
    table: str
    where: str | None = None
    order: str | None = None
    limit: int = 100
    columns: list[str] | None = None


class _GrepInput(BaseModel):
    table: str
    column: str
    pattern: str = Field(description="ILIKE pattern, e.g. %libertador%")
    limit: int = 100


class _ExplainInput(BaseModel):
    query: str = Field(description="A single SELECT over nexo.dx_* tables")


class _RowsOutput(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)
    source: str = ""


class _ExplainOutput(BaseModel):
    total_cost: float = 0.0
    node_type: str | None = None
    plan: dict[str, Any] = Field(default_factory=dict)
    source: str = ""


def build_primitive_tools(
    *,
    pool: Any,
    schema: str,
    tenant_lock: str,
    explain_cost_threshold: float,
    source_label: str,
) -> list[HarnessTool[Any, Any]]:
    """Build the four composable primitives as registrable HarnessTools."""

    async def check_permission(ctx: HarnessContext, _input: BaseModel) -> PermissionResult:
        if ctx.tenant_id != tenant_lock:
            return PermissionResult.deny(
                f"Coordinador is locked to tenant '{tenant_lock}'; "
                f"refusing for '{ctx.tenant_id}'."
            )
        return PermissionResult.allow("Read-only composable primitive")

    async def call_describe(
        ctx: HarnessContext, parsed: _DescribeInput, progress: Progress
    ) -> _RowsOutput:
        rows = await nexo_describe(pool=pool, table=parsed.table)
        return _RowsOutput(rows=rows, source=source_label)

    async def call_select(
        ctx: HarnessContext, parsed: _SelectInput, progress: Progress
    ) -> _RowsOutput:
        rows = await nexo_select(
            pool=pool,
            table=parsed.table,
            where=parsed.where,
            order=parsed.order,
            limit=parsed.limit,
            columns=parsed.columns,
        )
        return _RowsOutput(rows=rows, source=source_label)

    async def call_grep(
        ctx: HarnessContext, parsed: _GrepInput, progress: Progress
    ) -> _RowsOutput:
        rows = await nexo_grep(
            pool=pool,
            table=parsed.table,
            column=parsed.column,
            pattern=parsed.pattern,
            limit=parsed.limit,
        )
        return _RowsOutput(rows=rows, source=source_label)

    async def call_explain(
        ctx: HarnessContext, parsed: _ExplainInput, progress: Progress
    ) -> _ExplainOutput:
        result = await nexo_explain(
            pool=pool, query=parsed.query, cost_threshold=explain_cost_threshold
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
    return [
        HarnessTool(
            name="nexo_describe",
            description=(
                f"Columns + types of an allowlisted {schema}.dx_* snapshot table. "
                "Use to discover the shape of a table before nexo_select."
            ),
            input_model=_DescribeInput,
            output_model=_RowsOutput,
            call=call_describe,
            **common,
        ),
        HarnessTool(
            name="nexo_select",
            description=(
                f"Bounded read-only SELECT against an allowlisted {schema}.dx_* table "
                "(optional where/order/columns; limit capped at 5000). "
                "sqlglot safety gate: single statement, no mutations, allowlisted "
                "tables and functions only."
            ),
            input_model=_SelectInput,
            output_model=_RowsOutput,
            call=call_select,
            **common,
        ),
        HarnessTool(
            name="nexo_grep",
            description=(
                f"Case-insensitive pattern search (ILIKE) on one column of an "
                f"allowlisted {schema}.dx_* table."
            ),
            input_model=_GrepInput,
            output_model=_RowsOutput,
            call=call_grep,
            **common,
        ),
        HarnessTool(
            name="nexo_explain",
            description=(
                "EXPLAIN (FORMAT JSON) for a candidate SELECT; refuses when the "
                "plan cost exceeds the configured threshold. Use before an "
                "expensive nexo_select."
            ),
            input_model=_ExplainInput,
            output_model=_ExplainOutput,
            call=call_explain,
            **common,
        ),
    ]
