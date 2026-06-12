"""Agentic graph — planner → executor → freshness_judge loop → synthesis."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel
from pydantic import BaseModel

from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.observability.provenance import ProvenanceLog
from miot_harness.runtime.agentic_graph import build_agentic_graph
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


def _stub_tool(name: str, refreshed: datetime | None) -> HarnessTool:
    class _In(BaseModel):
        pass

    class _Out(BaseModel):
        rows: list[dict[str, Any]] = []
        refreshed_at: datetime | None = None
        source: str = "Coordinador · nexo (Citus DB)"

    async def _check(ctx: HarnessContext, inp: Any) -> PermissionResult:
        if ctx.tenant_id != "mintral":
            return PermissionResult.deny("Mintral-only")
        return PermissionResult.allow()

    async def _call(ctx: HarnessContext, inp: Any, progress: Any) -> Any:
        return _Out(rows=[{"n_eta_riesgo": 3}], refreshed_at=refreshed)

    return HarnessTool(
        name=name,
        description="[Layer L1] KPI summary",
        input_model=_In,
        output_model=_Out,
        check_permission=_check,
        call=_call,
        kind="curated",
    )


def _registry(refreshed: datetime | None = None) -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(
        _stub_tool("coordinador_centro_control", refreshed or datetime.now(UTC))
    )
    return registry


def _call_tool_response(tool: str = "coordinador_centro_control") -> str:
    return json.dumps(
        {
            "action": "call_tool",
            "tool": tool,
            "args": {},
            "intent": "fetch overview",
            "rationale": "broad question",
        }
    )


_FINAL_RESPONSE = json.dumps({"action": "final", "reasoning": "evidence suffices"})


def _models(
    planner_responses: list[str],
    synthesizer_text: str = "Final answer.",
) -> dict[str, Any]:
    return {
        "planner": FakeListChatModel(responses=planner_responses),
        "critic": FakeListChatModel(responses=[]),
        "synthesizer": FakeListChatModel(responses=[synthesizer_text]),
        "summarizer": FakeListChatModel(responses=[]),
    }


def _graph(
    *,
    registry: ToolRegistry | None = None,
    models: dict[str, Any] | None = None,
    settings: HarnessSettings | None = None,
    provenance_log: ProvenanceLog | None = None,
) -> Any:
    return build_agentic_graph(
        settings=settings or HarnessSettings(agents_synthesizer_stream=False),
        models=models or _models([_call_tool_response(), _FINAL_RESPONSE]),
        provenance_log=provenance_log,
        profile=NEXO_PROFILE,
        registry=registry or _registry(),
    )


def _visited_agents(final_state: dict[str, Any]) -> list[str]:
    return [
        evt.data["agent"]
        for evt in final_state.get("_events") or []
        if evt.type == "agent.started"
    ]


@pytest.mark.asyncio
async def test_agentic_graph_refuses_non_mintral_tenant() -> None:
    graph = _graph(models=_models([]))
    state = await graph.ainvoke(
        {
            "user_message": "anything",
            "ctx": HarnessContext(thread_id="t", tenant_id="other", user_id="u"),
            "evidence": [],
            "turn_count": 0,
        }
    )
    assert "mintral" in state.get("answer", "").lower()


@pytest.mark.asyncio
async def test_agentic_executor_collects_real_evidence() -> None:
    """planner(call_tool) → executor invokes the registry tool →
    freshness_judge → planner(final) → synthesizer sees the evidence."""
    graph = _graph(
        models=_models(
            [_call_tool_response(), _FINAL_RESPONSE],
            synthesizer_text="Estado operativo: 3 ETA en riesgo.",
        )
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
    assert len(final.get("evidence", [])) == 1
    assert final["evidence"][0].tool == "coordinador_centro_control"
    assert len(final.get("executed_steps", [])) == 1
    assert _visited_agents(final) == [
        "tenancy_gate",
        "planner",
        "executor",
        "freshness_judge",
        "planner",
        "synthesizer",
        "critic",
        "summarizer",
    ]


@pytest.mark.asyncio
async def test_agentic_synthesizer_receives_rendered_evidence() -> None:
    from langchain_core.messages import HumanMessage

    captured: list[list[Any]] = []

    class _RecordingModel(FakeListChatModel):
        async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
            captured.append(list(input))
            return await super().ainvoke(input, *args, **kwargs)

    models = _models([_call_tool_response(), _FINAL_RESPONSE])
    models["synthesizer"] = _RecordingModel(responses=["ok"])
    graph = _graph(models=models)
    await graph.ainvoke(
        {"user_message": "estado?", "ctx": _ctx(), "evidence": [], "turn_count": 0}
    )
    assert captured, "synthesizer model was not invoked"
    human = [m for m in captured[0] if isinstance(m, HumanMessage)][-1]
    assert "coordinador_centro_control" in human.content
    assert "n_eta_riesgo" in human.content


@pytest.mark.asyncio
async def test_agentic_failure_renders_spanish_refusal() -> None:
    """Planner failure (malformed, no evidence) → deterministic Spanish
    copy, not the old '(no answer — see failure)' placeholder."""
    models = _models(["this is not json"])
    models["synthesizer"] = FakeListChatModel(responses=[])  # any LLM call IndexErrors
    graph = _graph(models=models)
    final = await graph.ainvoke(
        {"user_message": "x", "ctx": _ctx(), "evidence": [], "turn_count": 0}
    )
    assert final.get("failure")
    assert final.get("answer")
    assert "(no answer" not in final["answer"]
    assert "No pude" in final["answer"]


@pytest.mark.asyncio
async def test_agentic_stale_evidence_is_a_caveat_not_a_dead_end() -> None:
    """Multi-evidence exploration must not refuse the whole run because
    one snapshot is old (beta Gap 2 frustration): the judge's refuse
    verdict downgrades to a warn, the loop continues, and the synthesizer
    answers citing the staleness (evidence carries status=stale)."""
    from langchain_core.messages import HumanMessage

    captured: list[list[Any]] = []

    class _RecordingModel(FakeListChatModel):
        async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
            captured.append(list(input))
            return await super().ainvoke(input, *args, **kwargs)

    stale = datetime.now(UTC) - timedelta(days=30)
    models = _models([_call_tool_response(), _FINAL_RESPONSE])
    models["synthesizer"] = _RecordingModel(
        responses=["Datos antiguos: 3 ETA en riesgo (snapshot de hace 30 días)."]
    )
    graph = _graph(registry=_registry(refreshed=stale), models=models)
    final = await graph.ainvoke(
        {"user_message": "estado?", "ctx": _ctx(), "evidence": [], "turn_count": 0}
    )
    assert not final.get("failure")
    assert final.get("answer", "").startswith("Datos antiguos")
    assert final["evidence"][0].is_stale is True
    # The synthesizer prompt carries the stale marker so it can caveat.
    human = [m for m in captured[0] if isinstance(m, HumanMessage)][-1]
    assert "status=stale" in human.content


@pytest.mark.asyncio
async def test_agentic_executor_writes_provenance(tmp_path: Path) -> None:
    log = ProvenanceLog(tmp_path)
    graph = _graph(provenance_log=log)
    await graph.ainvoke(
        {"user_message": "estado?", "ctx": _ctx(), "evidence": [], "turn_count": 0}
    )
    files = list(tmp_path.glob("*.jsonl"))
    assert len(files) == 1
    lines = files[0].read_text().strip().splitlines()
    assert len(lines) == 1
    entry = json.loads(lines[0])
    assert "coordinador_centro_control" in entry["sql"]
    assert entry["tenant_id"] == "mintral"
    assert entry["rows_returned"] == 1


@pytest.mark.asyncio
async def test_agentic_graph_caps_turns() -> None:
    """At the cap with no evidence the planner fails fast — never hangs,
    never invokes the model."""
    models = _models([])
    models["synthesizer"] = FakeListChatModel(responses=[])
    graph = _graph(models=models)
    final = await graph.ainvoke(
        {"user_message": "x", "ctx": _ctx(), "evidence": [], "turn_count": 99}
    )
    assert "turn cap" in (final.get("failure") or "")
    assert final.get("answer")


@pytest.mark.asyncio
async def test_agentic_turn_cap_is_configurable() -> None:
    """agents_agentic_max_turns=1 stops the loop after one executed step."""
    settings = HarnessSettings(
        agents_synthesizer_stream=False, agents_agentic_max_turns=1
    )
    # Planner would happily call tools forever; the cap must stop it after
    # one turn and synthesize with the single piece of evidence.
    models = _models(
        [_call_tool_response()] * 3, synthesizer_text="capped answer"
    )
    graph = _graph(settings=settings, models=models)
    final = await graph.ainvoke(
        {"user_message": "x", "ctx": _ctx(), "evidence": [], "turn_count": 0}
    )
    assert final.get("answer") == "capped answer"
    assert len(final.get("evidence", [])) == 1


def test_agentic_graph_topology_has_required_nodes() -> None:
    graph = _graph(models=_models([]))
    nodes = set(graph.get_graph().nodes)
    required = {
        "tenancy_gate",
        "planner",
        "executor",
        "freshness_judge",
        "synthesizer",
        "critic",
        "summarizer",
    }
    missing = required - nodes
    assert not missing, f"agentic_graph missing nodes: {missing}"


def test_agentic_synth_prompt_no_longer_disclaims_executor() -> None:
    import inspect

    import miot_harness.runtime.agentic_graph as module

    source = inspect.getsource(module)
    assert "not yet wired" not in source


@pytest.mark.asyncio
async def test_agentic_synthesizer_includes_prior_messages_in_llm_call() -> None:
    """Multi-turn agentic chats must splice prior_messages into the
    synthesizer call (plan 13 §E5 hydration)."""
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

    captured: list[list[Any]] = []

    class _RecordingModel(FakeListChatModel):
        async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
            captured.append(list(input))
            return await super().ainvoke(input, *args, **kwargs)

    models = _models([_FINAL_RESPONSE])
    models["synthesizer"] = _RecordingModel(responses=["synth answer"])
    graph = _graph(models=models)

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
    assert isinstance(sent_msgs[0], SystemMessage)
    # Prior turn next, BEFORE the current user message.
    assert isinstance(sent_msgs[1], HumanMessage)
    assert sent_msgs[1].content == "¿estado del coordinador hoy?"
    assert isinstance(sent_msgs[2], AIMessage)
    assert sent_msgs[2].content.startswith("## Estado")
    assert isinstance(sent_msgs[-1], HumanMessage)
    assert "tell me more about that" in sent_msgs[-1].content


@pytest.mark.asyncio
async def test_agentic_synthesizer_prior_turns_rule_present() -> None:
    """The 'prior turns are authoritative' grounding rule must survive the
    executor wire-up — multi-turn answers still reference earlier data."""
    from langchain_core.messages import SystemMessage

    captured: list[list[Any]] = []

    class _RecordingModel(FakeListChatModel):
        async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
            captured.append(list(input))
            return await super().ainvoke(input, *args, **kwargs)

    models = _models([_FINAL_RESPONSE])
    models["synthesizer"] = _RecordingModel(responses=["ok"])
    graph = _graph(models=models)
    await graph.ainvoke(
        {"user_message": "hola", "ctx": _ctx(), "evidence": [], "turn_count": 0}
    )
    system = [m for m in captured[0] if isinstance(m, SystemMessage)][0]
    assert "authoritative" in system.content


@pytest.mark.asyncio
async def test_agentic_tool_failure_feeds_back_to_planner() -> None:
    """A failed tool call must not dead-end the exploration: the failure
    is recorded in failed_steps, the planner sees it (and the evidence
    already collected) and can adapt — try another tool or finalize.
    Found live: nexo_describe ok + nexo_grep raised → whole run died with
    the generic failure copy, discarding the describe evidence."""
    from pydantic import BaseModel as _BM

    registry = _registry()

    class _In(_BM):
        pass

    class _Out(_BM):
        rows: list[dict[str, Any]] = []

    async def _check(ctx: HarnessContext, inp: Any) -> PermissionResult:
        return PermissionResult.allow()

    async def _boom(ctx: HarnessContext, inp: Any, progress: Any) -> Any:
        raise RuntimeError("relation does not exist")

    registry.register(
        HarnessTool(
            name="nexo_grep",
            description="grep",
            input_model=_In,
            output_model=_Out,
            check_permission=_check,
            call=_boom,
            kind="primitive",
        )
    )

    captured: list[list[Any]] = []

    class _RecordingModel(FakeListChatModel):
        async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
            captured.append(list(input))
            return await super().ainvoke(input, *args, **kwargs)

    models = {
        "planner": _RecordingModel(
            responses=[
                _call_tool_response("nexo_grep"),  # fails
                _call_tool_response(),  # recovers with the curated tool
                _FINAL_RESPONSE,
            ]
        ),
        "critic": FakeListChatModel(responses=[]),
        "synthesizer": FakeListChatModel(responses=["Recovered answer."]),
        "summarizer": FakeListChatModel(responses=[]),
    }
    graph = _graph(registry=registry, models=models)
    final = await graph.ainvoke(
        {"user_message": "explora", "ctx": _ctx(), "evidence": [], "turn_count": 0}
    )

    assert final.get("answer") == "Recovered answer."
    assert not final.get("failure")
    assert len(final.get("evidence", [])) == 1  # only the successful call
    assert any("nexo_grep" in note for note in final.get("failed_steps", []))
    # The planner's 2nd/3rd prompts must mention the failed call so it
    # doesn't repeat it.
    later_prompts = "".join(m.content for m in captured[1])
    assert "nexo_grep" in later_prompts
