"""E6 — agentic graph end-to-end happy paths."""

from __future__ import annotations

import json
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
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
        profile=NEXO_PROFILE,
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
        profile=NEXO_PROFILE,
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
        profile=NEXO_PROFILE,
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
        profile=NEXO_PROFILE,
    )
    nodes = set(graph.get_graph().nodes)
    # Plan 13 §E6 names these explicitly. Each must be a node in the graph.
    required = {"tenancy_gate", "planner", "synthesizer", "critic", "summarizer"}
    missing = required - nodes
    assert not missing, f"agentic_graph missing nodes: {missing}"


@pytest.mark.asyncio
async def test_agentic_synthesizer_includes_prior_messages_in_llm_call() -> None:
    """The agentic synthesizer stub must splice `state["prior_messages"]`
    into its `model.ainvoke` call so multi-turn AGENTIC chats actually
    carry context.

    Without this, the LLM sees only the current `user_message` and
    replies "I don't have context for 'that'" on any follow-up — the
    bug Step 4 of PER_TENANT_BILLING_TEST.md surfaced.
    """

    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

    captured: list[list[Any]] = []

    class _RecordingModel(FakeListChatModel):
        async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
            captured.append(list(input))
            return await super().ainvoke(input, *args, **kwargs)

    models = _models(plan_response="{}", synthesizer_text="ok")
    models["synthesizer"] = _RecordingModel(responses=["synth answer"])

    # Disable streaming so this test's ainvoke recorder works. Streaming
    # path uses astream_events which the recorder doesn't intercept.
    settings = HarnessSettings(agents_synthesizer_stream=False)
    graph = build_agentic_graph(
        settings=settings, models=models, provenance_log=None, profile=NEXO_PROFILE
    )

    prior = [
        HumanMessage(content="¿estado del coordinador hoy?"),
        AIMessage(content="## Estado: 1822 críticos, 46 ETA en riesgo, …"),
    ]
    await graph.ainvoke(
        {
            "user_message": "tell me more about that",
            "ctx": _ctx(),
            "evidence": [],
            "turn_count": 0,
            "prior_messages": prior,
        }
    )

    assert captured, "synthesizer model was not invoked"
    sent_msgs = captured[0]
    # System prompt first — load-bearing for stub state (otherwise the
    # LLM treats prior turn data as hallucinated by itself).
    assert isinstance(sent_msgs[0], SystemMessage)
    assert "agentic synthesizer" in sent_msgs[0].content.lower()
    # Prior turn next, BEFORE the current user message.
    assert isinstance(sent_msgs[1], HumanMessage)
    assert sent_msgs[1].content == "¿estado del coordinador hoy?"
    assert isinstance(sent_msgs[2], AIMessage)
    assert sent_msgs[2].content.startswith("## Estado")
    # The last message is the current turn's user input.
    assert isinstance(sent_msgs[-1], HumanMessage)
    assert sent_msgs[-1].content == "tell me more about that"


@pytest.mark.asyncio
async def test_agentic_synthesizer_handles_empty_prior_messages() -> None:
    """When state has no prior_messages (first turn or no conversation_id),
    the synthesizer falls back cleanly to a single-message prompt."""

    from langchain_core.messages import HumanMessage, SystemMessage

    captured: list[list[Any]] = []

    class _RecordingModel(FakeListChatModel):
        async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
            captured.append(list(input))
            return await super().ainvoke(input, *args, **kwargs)

    models = _models(plan_response="{}", synthesizer_text="ok")
    models["synthesizer"] = _RecordingModel(responses=["first-turn"])

    settings = HarnessSettings(agents_synthesizer_stream=False)
    graph = build_agentic_graph(
        settings=settings, models=models, provenance_log=None, profile=NEXO_PROFILE
    )
    await graph.ainvoke(
        {
            "user_message": "first message",
            "ctx": _ctx(),
            "evidence": [],
            "turn_count": 0,
            # prior_messages intentionally omitted
        }
    )
    sent_msgs = captured[0]
    # SystemMessage + current user HumanMessage. No prior turns.
    assert len(sent_msgs) == 2
    assert isinstance(sent_msgs[0], SystemMessage)
    assert isinstance(sent_msgs[1], HumanMessage)
    assert sent_msgs[1].content == "first message"
