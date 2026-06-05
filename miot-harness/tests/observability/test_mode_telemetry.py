"""E9 — `modular.mode` on every root span + per-agent span.

The C2 dashboards split per-mode cost. Every span must carry the
caller's requested mode so the panel can group `canned` vs `agentic`
vs `meta` runs and compare cost-per-question.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from pydantic import BaseModel

from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.observability.spans import agent_span
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.data_graph import build_data_graph
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry


def _ctx(mode: str = "agentic") -> HarnessContext:
    return HarnessContext(
        thread_id="t", tenant_id="mintral", user_id="u", mode=mode  # type: ignore[arg-type]
    )


def _stub_tool(refreshed: datetime) -> HarnessTool:
    class _In(BaseModel):
        pass

    class _Out(BaseModel):
        rows: list[dict[str, Any]] = []
        refreshed_at: datetime | None = None
        source: str = "Coordinador · nexo (Citus DB)"

    async def _check(ctx: Any, inp: Any) -> PermissionResult:
        return PermissionResult.allow()

    async def _call(ctx: Any, inp: Any, progress: Any) -> _Out:
        return _Out(
            rows=[{"n_eta_riesgo": 1, "refreshed_at_servicios": refreshed}],
            refreshed_at=refreshed,
        )

    return HarnessTool(
        name="coordinador_centro_control",
        description="[L1] KPI",
        input_model=_In,
        output_model=_Out,
        check_permission=_check,
        call=_call,
    )


def _models() -> dict[str, Any]:
    return {
        "filter_expert": FakeListChatModel(
            responses=[
                json.dumps(
                    {
                        "intent": "x",
                        "tool": "coordinador_centro_control",
                        "args": {},
                        "rationale": "r",
                    }
                )
            ]
        ),
        "domain_analyst": FakeListChatModel(
            responses=[json.dumps({"verdict": "ready", "reasoning": "ok"})]
        ),
        "synthesizer": FakeListChatModel(responses=["done"]),
        "critic": FakeListChatModel(responses=[]),
        "summarizer": FakeListChatModel(responses=[]),
    }


@pytest.mark.asyncio
async def test_root_run_span_carries_mode_attribute(
    memory_exporter: InMemorySpanExporter,
) -> None:
    """`agent_span("run", mode=...)` must surface mode on the root span."""

    ctx = _ctx(mode="agentic")
    with agent_span("run", run_id=ctx.run_id, tenant_id=ctx.tenant_id, mode=ctx.mode):
        pass
    root = next(
        s for s in memory_exporter.get_finished_spans() if s.name == "nexo.run"
    )
    assert root.attributes["modular.mode"] == "agentic"


@pytest.mark.asyncio
async def test_per_agent_callback_emits_mode_attribute(
    memory_exporter: InMemorySpanExporter,
) -> None:
    """`_instrument` threads `ctx.mode` into the callback so per-agent spans
    carry `modular.mode` for the C2 per-mode cost panel."""

    refreshed = datetime.now(UTC)
    registry = ToolRegistry()
    registry.register(_stub_tool(refreshed))
    settings = HarnessSettings(
        datasource_freshness_warn_minutes=30, datasource_freshness_refuse_minutes=240
    )
    graph = build_data_graph(
        registry=registry, settings=settings, models=_models(), profile=NEXO_PROFILE
    )

    ctx = _ctx(mode="canned")
    await graph.ainvoke(
        {
            "user_message": "estado operativo",
            "ctx": ctx,
            "evidence": [],
            "turn_count": 0,
        }
    )

    nexo_spans = [
        s
        for s in memory_exporter.get_finished_spans()
        if s.name.startswith("nexo.") and s.attributes.get("modular.agent")
    ]
    assert nexo_spans, "no per-agent spans emitted"
    for span in nexo_spans:
        assert span.attributes.get("modular.mode") == "canned", (
            f"{span.name} missing modular.mode='canned' "
            f"(got {span.attributes.get('modular.mode')!r})"
        )
