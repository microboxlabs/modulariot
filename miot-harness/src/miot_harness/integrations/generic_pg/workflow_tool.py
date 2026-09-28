"""`<conn>_workflow`: BPMN process definitions and their history.

Registered for a connection whose allowed schemas hold the Activiti/Flowable
tables (act_re_procdef, act_ge_bytearray, act_hi_*). Every query goes through
the same gate, read-only envelope and cost check as `<conn>_query`.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field
from sqlglot import exp

from miot_harness.datasource.safe_query import safe_run_select
from miot_harness.datasource.safe_sql import CostGateViolation, quote_ident
from miot_harness.integrations.generic_pg import bpmn
from miot_harness.integrations.generic_pg.workspace_tools import ToolEnv
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.tool import HarnessTool, Progress

DEFAULT_DAYS = 90
_TASK_TYPES = "('userTask', 'manualTask', 'receiveTask', 'callActivity', 'subProcess')"


class _WorkflowInput(BaseModel):
    action: Literal["list", "graph", "stats"] = Field(
        description=(
            "list: process definitions with instance counts; graph: the process "
            "diagram (nodes, edges, conditions) shown to the user; stats: per-task "
            "durations, open tasks, most frequent transitions and rework"
        )
    )
    key: str | None = Field(default=None, description="Process definition key (from list)")
    id: str | None = Field(default=None, description="Process definition id, instead of key")
    version: int | None = Field(
        default=None,
        description="graph: version to draw (default latest); stats: one version (default all)",
    )
    since: date | None = Field(
        default=None, description=f"stats/heat: first day (default {DEFAULT_DAYS} days ago)"
    )
    until: date | None = Field(default=None, description="stats/heat: last day (default today)")
    heat: bool = Field(
        default=False,
        description="graph: color tasks by median duration between since and until",
    )
    title: str | None = Field(default=None, description="graph: diagram title, user's language")


class _WorkflowOutput(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)
    process: dict[str, Any] | None = None
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)
    mermaid: str = ""
    artifact_id: str = ""
    transitions: list[dict[str, Any]] = Field(default_factory=list)
    rework: list[dict[str, Any]] = Field(default_factory=list)
    period: dict[str, str] | None = None
    note: str = ""
    source: str = ""
    executed_sql: str | None = None


def _lit(value: str) -> str:
    if len(value) > 255:
        raise ValueError("identifier is longer than 255 characters")
    return exp.Literal.string(value).sql(dialect="postgres")


def _period(parsed: _WorkflowInput) -> tuple[date, date]:
    until = parsed.until or datetime.now(UTC).date()
    since = parsed.since or until - timedelta(days=DEFAULT_DAYS)
    if since > until:
        raise ValueError("since is after until")
    return since, until


def _ms(value: Any) -> float | None:
    return None if value is None else float(value)


class _Workflow:
    def __init__(self, env: ToolEnv, schema: str) -> None:
        self.env = env
        self.s = quote_ident(schema)
        self.last_sql: str | None = None

    async def rows(self, sql: str, limit: int) -> list[dict[str, Any]]:
        run = await safe_run_select(
            pool=self.env.pool,
            policy=self.env.policy,
            sql=sql,
            max_rows=min(limit, self.env.max_rows),
            cost_threshold=self.env.explain_cost_threshold,
            statement_timeout_ms=self.env.statement_timeout_ms,
        )
        self.last_sql = run.sql
        return run.rows

    async def definitions(self) -> tuple[list[dict[str, Any]], str]:
        defs = await self.rows(
            f"SELECT key_, name_, version_, id_ FROM {self.s}.act_re_procdef "
            "ORDER BY key_, version_ DESC LIMIT 1000",
            1000,
        )
        note = ""
        try:
            counts = await self.rows(
                "SELECT proc_def_id_, COUNT(*) AS total, "
                "COUNT(*) FILTER (WHERE end_time_ IS NULL) AS running "
                f"FROM {self.s}.act_hi_procinst GROUP BY proc_def_id_ LIMIT 5000",
                5000,
            )
        except CostGateViolation as exc:
            counts, note = [], f"Instance counts skipped: {exc}."
        by_def = {r["proc_def_id_"]: r for r in counts}
        out: dict[str, dict[str, Any]] = {}
        for d in defs:
            entry = out.setdefault(
                d["key_"],
                {
                    "key": d["key_"],
                    "name": d["name_"],
                    "latest_version": d["version_"],
                    "latest_id": d["id_"],
                    "versions": 0,
                    "instances": 0,
                    "running": 0,
                },
            )
            entry["versions"] += 1
            c = by_def.get(d["id_"], {})
            entry["instances"] += int(c.get("total") or 0)
            entry["running"] += int(c.get("running") or 0)
        return sorted(out.values(), key=lambda e: -e["instances"]), note

    async def definition(self, parsed: _WorkflowInput) -> dict[str, Any]:
        cols = "id_, key_, name_, version_, deployment_id_, resource_name_"
        if parsed.id:
            where = f"id_ = {_lit(parsed.id)}"
        elif parsed.key:
            where = f"key_ = {_lit(parsed.key)}"
            if parsed.version is not None:
                where += f" AND version_ = {int(parsed.version)}"
        else:
            raise ValueError("pass key (or id); list shows them")
        rows = await self.rows(
            f"SELECT {cols} FROM {self.s}.act_re_procdef WHERE {where} "
            "ORDER BY version_ DESC LIMIT 1",
            1,
        )
        if not rows:
            raise ValueError("no process definition matches; call list")
        return rows[0]

    async def graph(self, definition: dict[str, Any]) -> bpmn.ProcessGraph:
        rows = await self.rows(
            f"SELECT bytes_ FROM {self.s}.act_ge_bytearray "
            f"WHERE deployment_id_ = {_lit(definition['deployment_id_'])} "
            f"AND name_ = {_lit(definition['resource_name_'])} LIMIT 1",
            1,
        )
        if not rows or rows[0].get("bytes_") is None:
            raise ValueError("the definition's BPMN resource was not found")
        raw = rows[0]["bytes_"]
        return bpmn.parse_bpmn(bytes(raw) if not isinstance(raw, str) else raw, definition["key_"])

    def def_filter(self, parsed: _WorkflowInput, definition: dict[str, Any]) -> str:
        if parsed.id or parsed.version is not None:
            return f"proc_def_id_ = {_lit(definition['id_'])}"
        return (
            f"proc_def_id_ IN (SELECT id_ FROM {self.s}.act_re_procdef "
            f"WHERE key_ = {_lit(definition['key_'])})"
        )

    def range_filter(self, since: date, until: date) -> str:
        end = until + timedelta(days=1)
        return f"start_time_ >= '{since.isoformat()}' AND start_time_ < '{end.isoformat()}'"

    async def task_stats(self, where: str, rng: str) -> list[dict[str, Any]]:
        return await self.rows(
            "SELECT act_id_ AS task, MAX(act_name_) AS name, COUNT(*) AS started, "
            "COUNT(end_time_) AS completed, "
            "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_) AS median_ms, "
            "PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY duration_) AS p90_ms "
            f"FROM {self.s}.act_hi_actinst WHERE {where} AND {rng} "
            f"AND act_type_ IN {_TASK_TYPES} "
            "GROUP BY act_id_ ORDER BY median_ms DESC NULLS LAST LIMIT 200",
            200,
        )

    async def open_tasks(self, where: str) -> dict[str, int]:
        rows = await self.rows(
            f"SELECT task_def_key_, COUNT(*) AS open FROM {self.s}.act_ru_task "
            f"WHERE {where} GROUP BY task_def_key_ LIMIT 500",
            500,
        )
        return {r["task_def_key_"]: int(r["open"]) for r in rows}

    async def transitions(self, where: str, rng: str) -> list[dict[str, Any]]:
        return await self.rows(
            "WITH seq AS (SELECT act_id_, LAG(act_id_) OVER "
            "(PARTITION BY proc_inst_id_ ORDER BY start_time_, id_) AS prev "
            f"FROM {self.s}.act_hi_actinst WHERE {where} AND {rng}) "
            "SELECT prev AS from_id, act_id_ AS to_id, COUNT(*) AS n FROM seq "
            "WHERE prev IS NOT NULL GROUP BY prev, act_id_ ORDER BY n DESC LIMIT 60",
            60,
        )

    async def rework(self, where: str, rng: str) -> list[dict[str, Any]]:
        return await self.rows(
            "SELECT act_id_ AS task, COUNT(*) AS instances, SUM(n - 1) AS repeats FROM "
            "(SELECT proc_inst_id_, act_id_, COUNT(*) AS n "
            f"FROM {self.s}.act_hi_actinst WHERE {where} AND {rng} "
            f"AND act_type_ IN {_TASK_TYPES} "
            "GROUP BY proc_inst_id_, act_id_ HAVING COUNT(*) > 1) AS r "
            "GROUP BY act_id_ ORDER BY repeats DESC LIMIT 30",
            30,
        )


def _process_info(definition: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": definition["id_"],
        "key": definition["key_"],
        "name": definition["name_"],
        "version": definition["version_"],
    }


def _label(graph: bpmn.ProcessGraph | None, node_id: str) -> str:
    node = graph.node(node_id) if graph else None
    return (node.name if node and node.name else None) or node_id


def build_workflow_tool(env: ToolEnv, schema: str) -> HarnessTool[Any, Any]:
    source_label = env.source_label

    async def call_list(wf: _Workflow) -> _WorkflowOutput:
        defs, note = await wf.definitions()
        return _WorkflowOutput(rows=defs, note=note, source=source_label)

    async def call_graph(
        ctx: HarnessContext, wf: _Workflow, parsed: _WorkflowInput, progress: Progress
    ) -> _WorkflowOutput:
        definition = await wf.definition(parsed)
        graph = await wf.graph(definition)
        heat: dict[str, float] = {}
        period = None
        if parsed.heat:
            since, until = _period(parsed)
            period = {"since": since.isoformat(), "until": until.isoformat()}
            stats = await wf.task_stats(
                wf.def_filter(parsed, definition), wf.range_filter(since, until)
            )
            heat = {r["task"]: float(r["median_ms"]) for r in stats if r["median_ms"] is not None}
        title = parsed.title or definition["name_"] or definition["key_"]
        svg = bpmn.to_svg(graph, heat=heat, title=title)
        mermaid = bpmn.to_mermaid(graph)
        artifact_id = f"a{uuid4().hex[:10]}"
        kind, content = ("svg", svg) if svg else ("mermaid", mermaid)
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="artifact.created",
                message=f"Diagram {title}",
                data={
                    "id": artifact_id,
                    "kind": kind,
                    "title": title,
                    "content": content,
                    "source": source_label,
                },
            )
        )
        shape = graph.to_json()
        note = (
            "The user sees the diagram. Describe the flow in words (main path, "
            "decisions, loops); do not repeat the diagram."
        )
        if kind == "mermaid":
            note += " The definition has no saved layout, so it was drawn as a flowchart."
        return _WorkflowOutput(
            process=_process_info(definition),
            nodes=shape["nodes"],
            edges=shape["edges"],
            mermaid=mermaid,
            artifact_id=artifact_id,
            rows=[
                {"task": k, "name": _label(graph, k), "median": bpmn.format_duration(v)}
                for k, v in heat.items()
            ],
            period=period,
            note=note,
            source=source_label,
            executed_sql=wf.last_sql,
        )

    async def call_stats(wf: _Workflow, parsed: _WorkflowInput) -> _WorkflowOutput:
        definition = await wf.definition(parsed)
        since, until = _period(parsed)
        where, rng = wf.def_filter(parsed, definition), wf.range_filter(since, until)
        skipped: list[str] = []
        graph: bpmn.ProcessGraph | None = None
        try:
            graph = await wf.graph(definition)
        except (ValueError, CostGateViolation) as exc:
            skipped.append(f"diagram ({exc})")
        tasks = await wf.task_stats(where, rng)
        open_now: dict[str, int] = {}
        try:
            open_now = await wf.open_tasks(where)
        except Exception as exc:  # noqa: BLE001 — act_ru_task may be missing or outside the policy
            skipped.append(f"open tasks ({exc})")
        transitions: list[dict[str, Any]] = []
        rework: list[dict[str, Any]] = []
        try:
            transitions = await wf.transitions(where, rng)
            rework = await wf.rework(where, rng)
        except CostGateViolation as exc:
            skipped.append(f"transitions ({exc})")
        edges = {(e.source, e.target): e for e in graph.edges} if graph else {}
        rows = [
            {
                "task": r["task"],
                "name": r["name"] or _label(graph, r["task"]),
                "started": r["started"],
                "completed": r["completed"],
                "open_now": open_now.get(r["task"], 0),
                "median": bpmn.format_duration(r["median_ms"])
                if r["median_ms"] is not None
                else None,
                "p90": bpmn.format_duration(r["p90_ms"]) if r["p90_ms"] is not None else None,
                "median_ms": _ms(r["median_ms"]),
                "p90_ms": _ms(r["p90_ms"]),
            }
            for r in tasks
        ]
        trans = []
        for t in transitions:
            edge = edges.get((t["from_id"], t["to_id"]))
            trans.append(
                {
                    "from": _label(graph, t["from_id"]),
                    "to": _label(graph, t["to_id"]),
                    "count": t["n"],
                    "back": bool(edge and edge.back),
                    "in_model": edge is not None or graph is None,
                }
            )
        note = (
            "Durations are from activity history started in the period; open_now "
            "counts tasks open today. Transitions follow each instance's activity "
            "order, so parallel branches can add pairs that are not model edges "
            "(in_model=false). Use show for a chart of these numbers."
        )
        if skipped:
            note += " Skipped: " + "; ".join(skipped) + ". Narrow the period to include them."
        return _WorkflowOutput(
            process=_process_info(definition),
            rows=rows,
            transitions=trans,
            rework=[
                {
                    "task": _label(graph, r["task"]),
                    "instances": r["instances"],
                    "repeats": r["repeats"],
                }
                for r in rework
            ],
            period={"since": since.isoformat(), "until": until.isoformat()},
            note=note,
            source=source_label,
            executed_sql=wf.last_sql,
        )

    async def call(
        ctx: HarnessContext, parsed: _WorkflowInput, progress: Progress
    ) -> _WorkflowOutput:
        wf = _Workflow(env, schema)
        if parsed.action == "graph":
            return await call_graph(ctx, wf, parsed, progress)
        if parsed.action == "stats":
            return await call_stats(wf, parsed)
        return await call_list(wf)

    return HarnessTool(
        name=f"{env.tool_prefix}workflow",
        description=(
            f"Business processes (BPMN) of {source_label} and how they run. "
            "`list` the process definitions with instance counts; `graph` draws "
            "one process for the user (tasks, decisions and their conditions, "
            "parallel branches, loops back) and returns its nodes and edges; "
            "`heat` colors tasks by median duration. `stats` gives per-task "
            "median and p90 duration, open tasks, the most frequent transitions "
            "and tasks repeated in the same instance (rework), over a date range. "
            "Use it before querying act_* tables by hand to understand a process."
        ),
        input_model=_WorkflowInput,
        output_model=_WorkflowOutput,
        call=call,
        **env.common,
    )
