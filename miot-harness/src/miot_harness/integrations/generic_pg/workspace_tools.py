"""Widget, memory and saved-analysis tools of a generic pg connection.

Built by `build_generic_tools`; kept apart because they carry their own
state (the widget event, the workspace files) and are larger than the plain
read-only primitives.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from miot_harness.datasource import workspace_store as ws
from miot_harness.datasource.safe_query import safe_run_select
from miot_harness.datasource.sql_policy import TableAccessPolicy
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.tool import HarnessTool, Progress


@dataclass(frozen=True)
class ToolEnv:
    """What a connection's tools share: its pool, policy, limits and labels."""

    pool: Any
    policy: TableAccessPolicy
    tool_prefix: str
    source_label: str
    scope: str
    max_rows: int
    explain_cost_threshold: float
    statement_timeout_ms: int
    common: dict[str, Any]
    workspace_dir: Path | None


WidgetKind = Literal["kpi", "table", "bar", "line", "pie"]
WIDGET_MAX_ROWS = 500
WIDGET_PREVIEW_ROWS = 5


class _ShowInput(BaseModel):
    sql: str | None = Field(
        default=None,
        description=(
            "Read-only SELECT whose result is the data to show, same rules as "
            "query. Name the columns the way the user should read them. Omit "
            "when showing a saved analysis."
        ),
    )
    analysis: str | None = Field(
        default=None, description="Name of a saved analysis to show instead of sql"
    )
    args: dict[str, Any] = Field(
        default_factory=dict, description="Arguments for the saved analysis"
    )
    widget: WidgetKind = Field(
        description=(
            "kpi: one headline number (first row, first y column); table: a "
            "list to scan; bar: compare categories; line: a trend over "
            "time; pie: shares of a whole (few categories)"
        )
    )
    title: str = Field(description="Short title in the user's language")
    x: str | None = Field(
        default=None, description="Category or time column (charts); omit for kpi/table"
    )
    y: list[str] = Field(
        default_factory=list,
        description="Value columns: the series of a chart, or the kpi's value column",
    )
    unit: str | None = Field(default=None, description="Unit of the values, e.g. h or km")
    subtitle: str | None = Field(default=None, description="One line of context")


class _ShowOutput(BaseModel):
    widget_id: str = ""
    row_count: int = 0
    columns: list[str] = Field(default_factory=list)
    preview: list[dict[str, Any]] = Field(default_factory=list)
    note: str = ""
    source: str = ""
    executed_sql: str | None = None


class _MemoryInput(BaseModel):
    action: Literal["list", "read", "write"] = Field(
        description="list: every note's title; read: one note; write: create or replace one"
    )
    id: str | None = Field(default=None, description="Note id to read (from list)")
    title: str | None = Field(default=None, description="write: the note title; it names the note")
    kind: Literal["definition", "fact", "preference"] = Field(
        default="fact",
        description=(
            "definition: what a business term means in this data, confirmed by "
            "the user; fact: something true about the data (a trap, a gap, a "
            "join); preference: how this organization wants answers"
        ),
    )
    body: str | None = Field(
        default=None,
        description="write: the note, in plain words plus the SQL predicate or columns it maps to",
    )


class _MemoryOutput(BaseModel):
    notes: list[dict[str, Any]] = Field(default_factory=list)
    note: dict[str, Any] | None = None
    source: str = ""


class _AnalysisInput(BaseModel):
    action: Literal["list", "read", "save", "run"] = Field(
        description=(
            "list: saved analyses; read: one with its SQL; save: store a tested "
            "query under a name; run: execute a saved one with arguments"
        )
    )
    name: str | None = Field(default=None, description="Analysis name, e.g. driving_hours_by_month")
    description: str | None = Field(
        default=None, description="save: the question it answers and the definitions it uses"
    )
    sql: str | None = Field(
        default=None,
        description="save: the SELECT, with :param placeholders for the parameters",
    )
    params: list[dict[str, Any]] = Field(
        default_factory=list,
        description=(
            "save: [{name, type (text|int|numeric|date|timestamptz|bool), default, description}]"
        ),
    )
    args: dict[str, Any] = Field(default_factory=dict, description="run: {param: value}")


class _AnalysisOutput(BaseModel):
    analyses: list[dict[str, Any]] = Field(default_factory=list)
    analysis: dict[str, Any] | None = None
    rows: list[dict[str, Any]] = Field(default_factory=list)
    source: str = ""
    executed_sql: str | None = None


def _jsonable_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Decimals, dates and UUIDs as JSON values, so the rows can travel in an event."""
    converted: list[dict[str, Any]] = json.loads(json.dumps(rows, default=str))
    return converted


def _show_note(widget_id: str, truncated: bool, row_count: int) -> str:
    placement = (
        f'Place it in your answer with {{"type": "widget", "value": {{"id": "{widget_id}"}}}} '
        "and write what it shows; do not repeat the rows."
    )
    if truncated:
        return (
            f"The result was cut at {row_count} rows; the widget shows only those. "
            "Say so, or aggregate or filter the query and show it again. " + placement
        )
    return "The user sees every row in the widget. " + placement


def _widget_problems(parsed: _ShowInput, columns: list[str], row_count: int) -> list[str]:
    if parsed.widget in ("bar", "line", "pie") and not (parsed.x and parsed.y):
        return [f"a {parsed.widget} chart needs x and at least one y column"]
    if row_count == 0:
        if parsed.widget == "table":
            return []
        return ["the query returned no rows; say there is no data instead of showing a widget"]
    missing = [c for c in [parsed.x, *parsed.y] if c and c not in columns]
    return [f"column {c!r} is not in the result ({', '.join(columns)})" for c in missing]


def _require(workspace_dir: Path | None, source_label: str) -> Path:
    if workspace_dir is None:
        raise ValueError(f"{source_label} has no workspace directory")
    return workspace_dir


def _note_dict(note: ws.Note) -> dict[str, Any]:
    return {"id": note.id, "title": note.title, "kind": note.kind, "body": note.body, **note.meta}


def _analysis_dict(analysis: ws.Analysis) -> dict[str, Any]:
    return {
        "name": analysis.name,
        "description": analysis.description,
        "params": analysis.params,
        "sql": analysis.sql,
        **analysis.meta,
    }


def build_show_tool(env: ToolEnv) -> HarnessTool[Any, Any]:
    pool, policy, source_label = env.pool, env.policy, env.source_label
    tool_prefix, scope, common = env.tool_prefix, env.scope, env.common
    max_rows, explain_cost_threshold = env.max_rows, env.explain_cost_threshold
    statement_timeout_ms, workspace_dir = env.statement_timeout_ms, env.workspace_dir

    def saved_sql(ctx: HarnessContext, name: str, args: dict[str, Any]) -> str:
        if workspace_dir is None:
            raise ValueError(f"{source_label} has no workspace for saved analyses")
        analysis = ws.read_analysis(workspace_dir, ctx.tenant_id, name)
        if analysis is None:
            raise ValueError(f"no saved analysis named {name!r}")
        return ws.bind(analysis.sql, analysis.params, args)

    async def call_show(ctx: HarnessContext, parsed: _ShowInput, progress: Progress) -> _ShowOutput:
        if parsed.analysis:
            sql = saved_sql(ctx, parsed.analysis, parsed.args)
        elif parsed.sql:
            sql = parsed.sql
        else:
            raise ValueError("pass sql or the name of a saved analysis")
        run = await safe_run_select(
            pool=pool,
            policy=policy,
            sql=sql,
            max_rows=min(max_rows, WIDGET_MAX_ROWS),
            cost_threshold=explain_cost_threshold,
            statement_timeout_ms=statement_timeout_ms,
        )
        rows = _jsonable_rows(run.rows)
        columns = list(rows[0].keys()) if rows else []
        problems = _widget_problems(parsed, columns, len(rows))
        if problems:
            raise ValueError("; ".join(problems))
        widget_id = f"w{uuid4().hex[:10]}"
        truncated = len(rows) >= min(max_rows, WIDGET_MAX_ROWS)
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="widget.created",
                message=f"Widget {parsed.title}",
                data={
                    "widget": {
                        "id": widget_id,
                        "kind": parsed.widget,
                        "title": parsed.title,
                        "subtitle": parsed.subtitle,
                        "x": parsed.x,
                        "y": parsed.y,
                        "unit": parsed.unit,
                        "columns": columns,
                        "rows": rows,
                        "truncated": truncated,
                        "source": source_label,
                        "sql": run.sql,
                    }
                },
            )
        )
        return _ShowOutput(
            widget_id=widget_id,
            row_count=len(rows),
            columns=columns,
            preview=rows[:WIDGET_PREVIEW_ROWS],
            note=_show_note(widget_id, truncated, len(rows)),
            source=source_label,
            executed_sql=run.sql,
        )

    return HarnessTool(
        name=f"{tool_prefix}show",
        description=(
            f"Show a query result {scope} to the user as a widget: a kpi card, "
            "a table, or a bar/line/pie chart. Runs the SELECT under the "
            "same rules as query and sends every row to the user's screen; "
            "you get back only a preview. Use it whenever the answer is more "
            "than one or two numbers: a breakdown, a ranking, a trend."
        ),
        input_model=_ShowInput,
        output_model=_ShowOutput,
        call=call_show,
        **common,
    )


def _saved_sql(env: ToolEnv, ctx: HarnessContext, name: str, args: dict[str, Any]) -> str:
    root = _require(env.workspace_dir, env.source_label)
    analysis = ws.read_analysis(root, ctx.tenant_id, name)
    if analysis is None:
        raise ValueError(f"no saved analysis named {name!r}")
    return ws.bind(analysis.sql, analysis.params, args)


async def _select(env: ToolEnv, sql: str, max_rows: int) -> Any:
    return await safe_run_select(
        pool=env.pool,
        policy=env.policy,
        sql=sql,
        max_rows=max_rows,
        cost_threshold=env.explain_cost_threshold,
        statement_timeout_ms=env.statement_timeout_ms,
    )


def _memory_list(env: ToolEnv, ctx: HarnessContext, parsed: _MemoryInput) -> _MemoryOutput:
    notes = ws.list_notes(_require(env.workspace_dir, env.source_label), ctx.tenant_id)
    return _MemoryOutput(
        notes=[{"id": n.id, "title": n.title, "kind": n.kind} for n in notes],
        source=env.source_label,
    )


def _memory_read(env: ToolEnv, ctx: HarnessContext, parsed: _MemoryInput) -> _MemoryOutput:
    root = _require(env.workspace_dir, env.source_label)
    note = ws.read_note(root, ctx.tenant_id, parsed.id or parsed.title or "")
    if note is None:
        raise ValueError(f"no note {parsed.id!r}; list them first")
    return _MemoryOutput(note=_note_dict(note), source=env.source_label)


def _memory_write(env: ToolEnv, ctx: HarnessContext, parsed: _MemoryInput) -> _MemoryOutput:
    note = ws.write_note(
        _require(env.workspace_dir, env.source_label),
        ctx.tenant_id,
        title=parsed.title or "",
        body=parsed.body or "",
        kind=parsed.kind,
        author=ctx.user_id,
        conversation_id=ctx.conversation_id,
    )
    return _MemoryOutput(note=_note_dict(note), source=env.source_label)


_MEMORY_ACTIONS = {"list": _memory_list, "read": _memory_read, "write": _memory_write}


def _analysis_list(env: ToolEnv, ctx: HarnessContext, parsed: _AnalysisInput) -> _AnalysisOutput:
    root = _require(env.workspace_dir, env.source_label)
    return _AnalysisOutput(
        analyses=[
            {"name": a.name, "description": a.description, "params": a.params}
            for a in ws.list_analyses(root, ctx.tenant_id)
        ],
        source=env.source_label,
    )


def _analysis_read(env: ToolEnv, ctx: HarnessContext, parsed: _AnalysisInput) -> _AnalysisOutput:
    root = _require(env.workspace_dir, env.source_label)
    analysis = ws.read_analysis(root, ctx.tenant_id, parsed.name or "")
    if analysis is None:
        raise ValueError(f"no saved analysis named {parsed.name!r}")
    return _AnalysisOutput(analysis=_analysis_dict(analysis), source=env.source_label)


async def _analysis_run(
    env: ToolEnv, ctx: HarnessContext, parsed: _AnalysisInput
) -> _AnalysisOutput:
    run = await _select(env, _saved_sql(env, ctx, parsed.name or "", parsed.args), env.max_rows)
    return _AnalysisOutput(rows=run.rows, source=env.source_label, executed_sql=run.sql)


async def _analysis_save(
    env: ToolEnv, ctx: HarnessContext, parsed: _AnalysisInput
) -> _AnalysisOutput:
    # test-run with the defaults first, so only a working query is kept
    params = ws.validate_params(parsed.params, parsed.sql or "")
    run = await _select(env, ws.bind(parsed.sql or "", params, {}), 5)
    saved = ws.save_analysis(
        _require(env.workspace_dir, env.source_label),
        ctx.tenant_id,
        name=parsed.name or "",
        description=parsed.description or "",
        sql=parsed.sql or "",
        params=params,
        author=ctx.user_id,
        conversation_id=ctx.conversation_id,
        columns=list(run.rows[0].keys()) if run.rows else [],
    )
    return _AnalysisOutput(analysis=_analysis_dict(saved), rows=run.rows, source=env.source_label)


def build_workspace_tools(env: ToolEnv) -> list[HarnessTool[Any, Any]]:
    if env.workspace_dir is None:
        return []
    source_label, tool_prefix, common = env.source_label, env.tool_prefix, env.common
    tools: list[HarnessTool[Any, Any]] = []

    async def call_memory(  # NOSONAR
        ctx: HarnessContext, parsed: _MemoryInput, progress: Progress
    ) -> _MemoryOutput:
        return _MEMORY_ACTIONS[parsed.action](env, ctx, parsed)

    async def call_analysis(
        ctx: HarnessContext, parsed: _AnalysisInput, progress: Progress
    ) -> _AnalysisOutput:
        if parsed.action == "run":
            return await _analysis_run(env, ctx, parsed)
        if parsed.action == "save":
            return await _analysis_save(env, ctx, parsed)
        if parsed.action == "read":
            return _analysis_read(env, ctx, parsed)
        return _analysis_list(env, ctx, parsed)

    writable = {**common, "read_only": False}
    tools.append(
        HarnessTool(
            name=f"{tool_prefix}memory",
            description=(
                f"Notes this organization's analysts and you keep about {source_label}: "
                "confirmed definitions of business terms, facts about the data "
                "(duplicates, gaps, joins), and how they want answers. `list` at "
                "the start of a data question and `read` what applies. `write` a "
                "definition once the user confirms it, and a fact once a query "
                "proved it. Never store row values or personal data."
            ),
            input_model=_MemoryInput,
            output_model=_MemoryOutput,
            call=call_memory,
            **writable,
        )
    )
    tools.append(
        HarnessTool(
            name=f"{tool_prefix}analysis",
            description=(
                f"Saved analyses for {source_label}: named, parameterized SELECTs that "
                "answer a recurring question. `list` before writing a query that may "
                "already exist; `run` one with arguments; `save` a query you tested "
                "(with :param placeholders) when the user will ask it again or asks "
                "you to keep it. `save` runs it once with the defaults and refuses "
                "a query that fails. show accepts an analysis name in place of sql."
            ),
            input_model=_AnalysisInput,
            output_model=_AnalysisOutput,
            call=call_analysis,
            **writable,
        )
    )
    return tools
