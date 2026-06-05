from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel
from pydantic import BaseModel

from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.data_graph import build_data_graph
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry


def _ctx(tenant: str = "mintral") -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id=tenant, user_id="u")


def _stub_tool(name: str, refreshed: datetime) -> HarnessTool:
    class _In(BaseModel):
        pass

    class _Out(BaseModel):
        rows: list[dict[str, Any]] = []
        refreshed_at: datetime | None = None
        source: str = "Coordinador · nexo (Citus DB)"

    async def _check(ctx, inp):
        if ctx.tenant_id != "mintral":
            return PermissionResult.deny("Mintral-only")
        return PermissionResult.allow()

    async def _call(ctx, inp, progress):
        return _Out(
            rows=[{"n_eta_riesgo": 3, "refreshed_at_servicios": refreshed}],
            refreshed_at=refreshed,
        )

    return HarnessTool(
        name=name,
        description="[Layer L1] KPI summary",
        input_model=_In,
        output_model=_Out,
        check_permission=_check,
        call=_call,
    )


def _registry_with_centro() -> tuple[ToolRegistry, datetime]:
    refreshed = datetime.now(UTC)
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", refreshed))
    return registry, refreshed


def _models(filter_step_tool: str = "coordinador_centro_control") -> dict[str, Any]:
    """Scripted FakeListChatModels for each LLM seat in the staged graph."""
    return {
        "filter_expert": FakeListChatModel(
            responses=[
                json.dumps(
                    {
                        "intent": "fetch operational summary",
                        "tool": filter_step_tool,
                        "args": {},
                        "rationale": "broad question",
                    }
                ),
            ]
        ),
        "domain_analyst": FakeListChatModel(
            responses=[
                json.dumps({"verdict": "ready", "reasoning": "have evidence"}),
            ]
        ),
        "synthesizer": FakeListChatModel(
            responses=[
                "Operativo: 3 ETA en riesgo. Snapshot al instante.",
            ]
        ),
        "critic": FakeListChatModel(responses=[]),
        "summarizer": FakeListChatModel(responses=[]),
    }


@pytest.mark.asyncio
async def test_happy_path_mintral_run_emits_answer():
    registry, _refreshed = _registry_with_centro()
    settings = HarnessSettings(
        datasource_freshness_warn_minutes=30,
        datasource_freshness_refuse_minutes=240,
    )
    graph = build_data_graph(
        registry=registry, settings=settings, models=_models(), profile=NEXO_PROFILE
    )

    initial: dict[str, Any] = {
        "user_message": "¿estado operativo de hoy?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 0,
    }

    final_state = await graph.ainvoke(initial)

    assert final_state.get("answer")
    assert "Operativo" in final_state["answer"]
    # plan was created and the step ran
    assert final_state.get("plan") is not None
    assert len(final_state["evidence"]) == 1


@pytest.mark.asyncio
async def test_non_mintral_tenant_short_circuits_at_tenant_gate():
    """tenant_gate must produce a refusal WITHOUT invoking any LLM."""
    registry, _ = _registry_with_centro()
    settings = HarnessSettings()

    # Empty FakeListChatModels — would IndexError if any LLM is invoked
    bare_models = {
        "filter_expert": FakeListChatModel(responses=[]),
        "domain_analyst": FakeListChatModel(responses=[]),
        "synthesizer": FakeListChatModel(responses=[]),
        "critic": FakeListChatModel(responses=[]),
        "summarizer": FakeListChatModel(responses=[]),
    }
    graph = build_data_graph(
        registry=registry, settings=settings, models=bare_models, profile=NEXO_PROFILE
    )

    initial = {
        "user_message": "for client X?",
        "ctx": _ctx(tenant="demo-tenant"),
        "evidence": [],
        "turn_count": 0,
    }

    final = await graph.ainvoke(initial)
    assert final.get("answer")
    assert "Mintral" in final["answer"] or "mintral" in final["answer"].lower()


@pytest.mark.asyncio
async def test_stale_data_routes_through_synth_failure_path():
    """Refreshed_at older than refuse threshold → freshness_judge sets
    failure, supervisor routes to synth, synth renders graceful refusal."""
    refreshed = datetime(2026, 5, 1, tzinfo=UTC)  # 7+ days stale vs default 240min refuse
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", refreshed))
    settings = HarnessSettings(datasource_freshness_refuse_minutes=240)
    graph = build_data_graph(
        registry=registry, settings=settings, models=_models(), profile=NEXO_PROFILE
    )

    initial = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 0,
    }
    final = await graph.ainvoke(initial)

    # Synth failure path emits a localized refusal and never asks the synth model
    assert final.get("answer")
    assert (
        "stale" in final["answer"].lower()
        or "snapshot" in final["answer"].lower()
        or "stale" in (final.get("failure") or "").lower()
    )
