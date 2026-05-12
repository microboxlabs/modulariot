"""E6 — agentic graph end-to-end happy paths."""

from __future__ import annotations

import json
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.config import HarnessSettings
from miot_harness.runtime.agentic_graph import build_agentic_graph
from miot_harness.runtime.context import HarnessContext


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


def _models(plan_response: str, synthesizer_text: str = "Final answer.") -> dict[str, Any]:
    """Scripted models for each LLM seat the agentic graph uses."""

    return {
        "planner": FakeListChatModel(responses=[plan_response]),
        "domain_analyst": FakeListChatModel(
            responses=[json.dumps({"verdict": "ready", "reasoning": "ok"})]
        ),
        "critic": FakeListChatModel(
            responses=[json.dumps({"verdict": "approve", "reasoning": "looks fine"})]
        ),
        "synthesizer": FakeListChatModel(responses=[synthesizer_text]),
        "summarizer": FakeListChatModel(responses=["summary"]),
    }


@pytest.mark.asyncio
async def test_agentic_graph_refuses_non_mintral_tenant() -> None:
    """tenancy_gate refuses data routes for non-Mintral; final state carries `answer`."""

    settings = HarnessSettings()
    graph = build_agentic_graph(
        settings=settings,
        models=_models(plan_response="(unused)"),
        provenance_log=None,
    )
    state = await graph.ainvoke(
        {
            "user_message": "anything",
            "ctx": HarnessContext(thread_id="t", tenant_id="other", user_id="u"),
            "evidence": [],
            "turn_count": 0,
        }
    )
    assert state.get("answer", "").lower().find("mintral") >= 0


@pytest.mark.asyncio
async def test_agentic_graph_happy_path_runs_to_synthesis() -> None:
    """Mintral tenant + ready evidence → planner → synthesizer → critic → END."""

    plan_response = json.dumps(
        {
            "steps": [
                {
                    "intent": "fetch overview",
                    "tool": "coordinador_centro_control",
                    "args": {},
                    "rationale": "broad question",
                }
            ],
            "final_format": "answer",
        }
    )
    settings = HarnessSettings()
    graph = build_agentic_graph(
        settings=settings,
        models=_models(plan_response, synthesizer_text="Estado operativo: ok."),
        provenance_log=None,
    )
    final = await graph.ainvoke(
        {
            "user_message": "estado operativo?",
            "ctx": _ctx(),
            "evidence": [],
            "turn_count": 0,
        }
    )
    assert final.get("answer", "").startswith("Estado operativo")


@pytest.mark.asyncio
async def test_agentic_graph_caps_turns_at_12() -> None:
    """When turn_count starts at the cap, planner doesn't loop forever — it ends."""

    settings = HarnessSettings()
    graph = build_agentic_graph(
        settings=settings,
        models=_models(plan_response="{}", synthesizer_text="fallback"),
        provenance_log=None,
    )
    final = await graph.ainvoke(
        {
            "user_message": "x",
            "ctx": _ctx(),
            "evidence": [],
            "turn_count": 99,  # well above the cap
        }
    )
    # Either an answer or a failure — never a hang.
    assert final.get("answer") is not None or final.get("failure") is not None


def test_agentic_graph_topology_has_required_nodes() -> None:
    """The graph compiles and exposes the agents the plan calls for."""

    settings = HarnessSettings()
    graph = build_agentic_graph(
        settings=settings,
        models=_models(plan_response="{}"),
        provenance_log=None,
    )
    nodes = set(graph.get_graph().nodes)
    # Plan 13 §E6 names these explicitly. Each must be a node in the graph.
    required = {"tenancy_gate", "planner", "synthesizer", "critic", "summarizer"}
    missing = required - nodes
    assert not missing, f"agentic_graph missing nodes: {missing}"
