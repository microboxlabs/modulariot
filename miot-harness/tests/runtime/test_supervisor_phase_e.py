"""Phase E supervisor wire-up — `HarnessSupervisor` consumes the new modules.

Verifies the runtime contract documented in `.ralph/blockers.md` (the
supervisor-wire-up OPEN entry). Covers:
- LLM router replaces the keyword router for "auto" mode.
- Explicit modes (canned / meta / agentic) bypass the LLM router.
- agentic-mode refusal for non-Orion tenants surfaces as a record answer.
- meta route calls `meta_agent_node` directly (no graph).
- agentic route calls the agentic graph.
- conversation_id round-trips via `ConversationStore`.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.agents.meta_agent import MetaAgentCatalogEntry
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.conversation import (
    ConversationTurn,
    InMemoryConversationStore,
)
from miot_harness.runtime.intent_router import LLMIntentRouter
from miot_harness.runtime.router import IntentRouter
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE


def _scripted_llm_router(route: str, confidence: float = 0.95) -> LLMIntentRouter:
    model = FakeListChatModel(
        responses=[json.dumps({"route": route, "confidence": confidence})]
    )
    return LLMIntentRouter(model, confidence_threshold=0.7, keyword_fallback=IntentRouter())


def _meta_catalog() -> list[MetaAgentCatalogEntry]:
    return [
        MetaAgentCatalogEntry(
            name="fn_dx_centro_control",
            layer="L1",
            title="KPI summary",
            body="Counters for ETA-at-risk, critical queue.",
        ),
    ]


def _build_supervisor(
    tmp_path: Any,
    *,
    data_graph: Any = None,
    llm_router: LLMIntentRouter | None = None,
    agentic_graph: Any = None,
    meta_model: Any = None,
    conversation_store: InMemoryConversationStore | None = None,
) -> HarnessSupervisor:
    return HarnessSupervisor(
        router=IntentRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        data_graph=data_graph,
        llm_router=llm_router,
        agentic_graph=agentic_graph,
        meta_model=meta_model,
        meta_primer="primer text",
        meta_catalog=_meta_catalog(),
        conversation_store=conversation_store,
        tenant_lock="orion",
    )


@pytest.mark.asyncio
async def test_explicit_canned_mode_dispatches_to_data_graph(tmp_path: Any) -> None:
    data_graph = AsyncMock()
    data_graph.ainvoke = AsyncMock(return_value={"answer": "canned answer", "_events": []})
    supervisor = _build_supervisor(
        tmp_path,
        data_graph=data_graph,
        llm_router=_scripted_llm_router("DIRECT"),  # should NOT be consulted
    )

    record = await supervisor.run(
        UserRequest(message="anything", tenant_id="orion", mode="canned")
    )
    data_graph.ainvoke.assert_awaited_once()
    assert record.answer == "canned answer"


@pytest.mark.asyncio
async def test_explicit_meta_mode_calls_meta_agent(tmp_path: Any) -> None:
    meta_model = FakeListChatModel(responses=["This is what we have: fn_dx_centro_control."])
    supervisor = _build_supervisor(
        tmp_path,
        llm_router=_scripted_llm_router("DIRECT"),
        meta_model=meta_model,
    )
    record = await supervisor.run(
        UserRequest(message="what data?", tenant_id="any-tenant", mode="meta")
    )
    assert "fn_dx_centro_control" in (record.answer or "")


@pytest.mark.asyncio
async def test_meta_mode_per_agent_span_carries_tenant_tag(
    tmp_path: Any, memory_exporter: Any
) -> None:
    """DATA_META observation-level attribution: the harness-emitted
    per-agent ``nexo.meta_agent`` span carries the same
    ``modular.{agent, tenant_id, mode}`` + ``langfuse.tags`` attrs as
    canned/agentic paths.

    Scope: covers the harness-side wrap (the per-agent span emitted by
    ``AgentTelemetryCallback`` when ``_run_data_meta`` calls
    ``instrument_model(self.meta_model, "meta_agent", ctx)``). It does
    NOT exercise Traceloop's auto-instrumented ``anthropic.chat`` child
    observation — ``FakeListChatModel`` doesn't trigger the Anthropic
    SDK instrumentor. The Traceloop child-observation path was verified
    live via ClickHouse query (PR #470 description), confirming the
    inner observation row carries the same tenant tag after the wrap.
    """

    import json as _json

    meta_model = FakeListChatModel(responses=["primer answer"])
    supervisor = _build_supervisor(
        tmp_path,
        llm_router=_scripted_llm_router("DIRECT"),
        meta_model=meta_model,
    )
    await supervisor.run(
        UserRequest(
            message="what data?",
            tenant_id="acme-corp",
            user_id="alice",
            mode="meta",
        )
    )

    nexo_spans = [
        s
        for s in memory_exporter.get_finished_spans()
        if s.attributes and s.attributes.get("modular.agent") == "meta_agent"
    ]
    assert nexo_spans, "meta_agent per-agent span not emitted"
    attrs = dict(nexo_spans[0].attributes or {})
    assert attrs["modular.agent"] == "meta_agent"
    assert attrs["modular.tenant_id"] == "acme-corp"
    assert attrs["modular.mode"] == "meta"
    assert attrs["langfuse.user.id"] == "alice"
    tags = _json.loads(attrs["langfuse.tags"])
    assert "tenant:acme-corp" in tags
    assert "mode:meta" in tags
    assert "agent:meta_agent" in tags


@pytest.mark.asyncio
async def test_explicit_agentic_mode_dispatches_to_agentic_graph(tmp_path: Any) -> None:
    agentic_graph = AsyncMock()
    agentic_graph.ainvoke = AsyncMock(
        return_value={"answer": "agentic exploration result", "_events": []}
    )
    supervisor = _build_supervisor(
        tmp_path,
        agentic_graph=agentic_graph,
        llm_router=_scripted_llm_router("DIRECT"),
    )
    record = await supervisor.run(
        UserRequest(message="explore", tenant_id="orion", mode="agentic")
    )
    agentic_graph.ainvoke.assert_awaited_once()
    assert record.answer == "agentic exploration result"


@pytest.mark.asyncio
async def test_explicit_agentic_mode_for_non_orion_returns_refusal(tmp_path: Any) -> None:
    agentic_graph = AsyncMock()
    agentic_graph.ainvoke = AsyncMock(return_value={"answer": "should not run"})
    supervisor = _build_supervisor(
        tmp_path,
        agentic_graph=agentic_graph,
        llm_router=_scripted_llm_router("DIRECT"),
    )
    record = await supervisor.run(
        UserRequest(message="explore", tenant_id="other-tenant", mode="agentic")
    )
    agentic_graph.ainvoke.assert_not_awaited()
    assert "orion" in (record.answer or "").lower()


@pytest.mark.asyncio
async def test_auto_mode_uses_llm_router_to_pick_route(tmp_path: Any) -> None:
    """The whole point of `llm_router`: replace the keyword router for "auto"."""

    agentic_graph = AsyncMock()
    agentic_graph.ainvoke = AsyncMock(
        return_value={"answer": "routed agentic", "_events": []}
    )
    supervisor = _build_supervisor(
        tmp_path,
        agentic_graph=agentic_graph,
        # LLM router classifies any message as DATA_AGENTIC.
        llm_router=_scripted_llm_router("DATA_AGENTIC"),
    )
    record = await supervisor.run(
        UserRequest(message="show me stuff", tenant_id="orion")  # mode default "auto"
    )
    agentic_graph.ainvoke.assert_awaited_once()
    assert record.answer == "routed agentic"


@pytest.mark.asyncio
async def test_data_query_remapped_to_agentic_without_curated_catalog(
    tmp_path: Any,
) -> None:
    """A primitives-only datasource (no curated catalog) has nothing for the
    canned filter_expert seat to pick, so a DATA_QUERY route — whether the LLM
    misclassified it or the caller sent `mode=canned` — must be remapped to the
    agentic graph. This is the regression guard for the "servicio 1585735"
    onboarding-fallback dead-end."""

    from dataclasses import replace

    data_graph = AsyncMock()
    data_graph.ainvoke = AsyncMock(return_value={"answer": "canned (should not run)"})
    agentic_graph = AsyncMock()
    agentic_graph.ainvoke = AsyncMock(
        return_value={"answer": "servicio 1585735 encontrado", "_events": []}
    )
    supervisor = _build_supervisor(
        tmp_path,
        data_graph=data_graph,
        agentic_graph=agentic_graph,
        llm_router=_scripted_llm_router("DATA_QUERY"),
    )
    # The active datasource has no curated catalog (generic_pg / acs).
    supervisor.profile = replace(FAKE_PROFILE, has_curated_catalog=False)

    record = await supervisor.run(
        UserRequest(message="que me puedes decir del servicio 1585735", tenant_id="mintral")
    )

    agentic_graph.ainvoke.assert_awaited_once()
    data_graph.ainvoke.assert_not_awaited()
    assert record.answer == "servicio 1585735 encontrado"


@pytest.mark.asyncio
async def test_data_query_kept_canned_with_curated_catalog(tmp_path: Any) -> None:
    """The remap is scoped to no-catalog datasources: a curated profile still
    sends DATA_QUERY to the canned data graph."""

    data_graph = AsyncMock()
    data_graph.ainvoke = AsyncMock(return_value={"answer": "canned answer", "_events": []})
    agentic_graph = AsyncMock()
    agentic_graph.ainvoke = AsyncMock(return_value={"answer": "should not run"})
    supervisor = _build_supervisor(
        tmp_path,
        data_graph=data_graph,
        agentic_graph=agentic_graph,
        llm_router=_scripted_llm_router("DATA_QUERY"),
    )
    supervisor.profile = FAKE_PROFILE  # has_curated_catalog defaults to True

    record = await supervisor.run(
        UserRequest(message="dame KPIs", tenant_id="mintral")
    )

    data_graph.ainvoke.assert_awaited_once()
    agentic_graph.ainvoke.assert_not_awaited()
    assert record.answer == "canned answer"


@pytest.mark.asyncio
async def test_conversation_id_round_trips_via_store(tmp_path: Any) -> None:
    """When a request carries `conversation_id`, the supervisor must:
    1. Set `record.conversation_id` for downstream telemetry.
    2. Append the turn to the conversation store so the next call sees it.
    """

    store = InMemoryConversationStore()
    data_graph = AsyncMock()
    data_graph.ainvoke = AsyncMock(return_value={"answer": "first answer", "_events": []})
    supervisor = _build_supervisor(
        tmp_path,
        data_graph=data_graph,
        llm_router=_scripted_llm_router("DATA_QUERY"),
        conversation_store=store,
    )
    record = await supervisor.run(
        UserRequest(
            message="q1",
            tenant_id="orion",
            conversation_id="conv-supervisor-1",
        )
    )
    assert record.conversation_id == "conv-supervisor-1"

    history = store.get("conv-supervisor-1")
    assert history is not None
    assert history.turns[-1] == ConversationTurn(user_message="q1", assistant_answer="first answer")


@pytest.mark.asyncio
async def test_backward_compatibility_when_llm_router_not_provided(tmp_path: Any) -> None:
    """Existing call sites that pass only the keyword router must still work."""

    data_graph = AsyncMock()
    data_graph.ainvoke = AsyncMock(return_value={"answer": "via keyword", "_events": []})
    # No llm_router, no agentic_graph, no meta_model — the original Plan 12 surface.
    # The core router ships no built-in vocabulary; route on the neutral
    # FakeProvider profile keywords.
    supervisor = HarnessSupervisor(
        router=IntentRouter(data_keywords=FAKE_PROFILE.router_keywords),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        data_graph=data_graph,
    )
    # A "fakesource" keyword triggers DATA_QUERY in the keyword router.
    record = await supervisor.run(
        UserRequest(message="fakesource fleet status", tenant_id="acme")
    )
    data_graph.ainvoke.assert_awaited_once()
    assert record.answer == "via keyword"


# --- Conversation memory hydration (E5 read-half) ---


@pytest.mark.asyncio
async def test_supervisor_hydrates_prior_messages_into_data_graph_state(
    tmp_path: Any,
) -> None:
    """Two `/runs` calls with the same `conversation_id`: turn-2's graph
    receives `initial_state["prior_messages"]` carrying turn-1's user
    + assistant messages.

    The read-half of `ConversationStore`. Without it, multi-turn chats
    silently lose context — the agent on turn 2 has no idea what
    "tell me more about that" refers to.
    """

    from langchain_core.messages import AIMessage, HumanMessage

    store = InMemoryConversationStore()
    data_graph = AsyncMock()
    data_graph.ainvoke = AsyncMock(
        return_value={"answer": "first-turn answer", "_events": []}
    )
    supervisor = _build_supervisor(
        tmp_path,
        data_graph=data_graph,
        llm_router=_scripted_llm_router("DATA_QUERY"),
        conversation_store=store,
    )

    # Turn 1: nothing in the store yet → prior_messages should be empty.
    await supervisor.run(
        UserRequest(
            message="estado del coordinador",
            tenant_id="orion",
            conversation_id="conv-hydrate-1",
        )
    )
    turn1_state = data_graph.ainvoke.call_args[0][0]
    assert turn1_state.get("prior_messages") == []

    # Turn 2: the store now has turn-1's append → prior_messages must
    # carry [HumanMessage("estado del coordinador"), AIMessage("first-turn answer")].
    data_graph.ainvoke.reset_mock()
    data_graph.ainvoke = AsyncMock(
        return_value={"answer": "second-turn answer", "_events": []}
    )
    supervisor.data_graph = data_graph
    # New scripted LLM router response so the second run's "auto" mode
    # still classifies as DATA_QUERY.
    supervisor.llm_router = _scripted_llm_router("DATA_QUERY")
    await supervisor.run(
        UserRequest(
            message="tell me more about that",
            tenant_id="orion",
            conversation_id="conv-hydrate-1",
        )
    )
    turn2_state = data_graph.ainvoke.call_args[0][0]
    prior = turn2_state.get("prior_messages")
    assert prior is not None and len(prior) == 2
    assert isinstance(prior[0], HumanMessage)
    assert prior[0].content == "estado del coordinador"
    assert isinstance(prior[1], AIMessage)
    assert prior[1].content == "first-turn answer"


@pytest.mark.asyncio
async def test_meta_agent_sees_prior_turn_via_history(
    tmp_path: Any,
    monkeypatch: pytest.MonkeyPatch,
    request: pytest.FixtureRequest,
) -> None:
    """A meta-mode follow-up has access to the previous turn's messages
    via the supervisor's hydration + `meta_agent_node(..., prior_messages=)`
    kwarg. Captures the messages list passed to `meta_model.ainvoke` and
    asserts turn-1's HumanMessage content is present in turn-2's prompt.
    """

    from langchain_core.messages import HumanMessage

    from miot_harness.config import get_settings

    # Force the legacy ainvoke path so the recorder below intercepts.
    # The streaming code path goes through astream_events which the
    # FakeListChatModel doesn't surface to a simple ainvoke override.
    monkeypatch.setenv("MIOT_HARNESS_AGENTS_SYNTHESIZER_STREAM", "0")
    get_settings.cache_clear()
    # Re-clear after the test body so the cached settings (which still
    # reflect MIOT_HARNESS_AGENTS_SYNTHESIZER_STREAM=0) don't leak into
    # the next test. monkeypatch reverts the env var on teardown but
    # doesn't know about the lru_cache; without this finalizer the
    # next get_settings() call would hand back the stale, stream=False
    # settings even though the env is back to normal.
    request.addfinalizer(get_settings.cache_clear)

    captured_messages: list[list[Any]] = []

    class _RecordingMetaModel(FakeListChatModel):
        async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
            captured_messages.append(list(input))
            return await super().ainvoke(input, *args, **kwargs)

    store = InMemoryConversationStore()
    meta_model = _RecordingMetaModel(
        responses=["primer-answer-turn-1", "primer-answer-turn-2"]
    )
    supervisor = _build_supervisor(
        tmp_path,
        llm_router=_scripted_llm_router("DIRECT"),
        meta_model=meta_model,
        conversation_store=store,
    )

    # Turn 1
    await supervisor.run(
        UserRequest(
            message="what data is available?",
            tenant_id="gama",
            user_id="alice",
            mode="meta",
            conversation_id="conv-meta-1",
        )
    )
    # Turn 2 — follow-up that should see turn 1 in its prompt
    await supervisor.run(
        UserRequest(
            message="and where does it come from?",
            tenant_id="gama",
            user_id="alice",
            mode="meta",
            conversation_id="conv-meta-1",
        )
    )

    assert len(captured_messages) == 2
    # Turn-1 prompt is exactly [System, Human(turn1)] — no prior turns yet.
    turn1_human = [m for m in captured_messages[0] if isinstance(m, HumanMessage)]
    assert [m.content for m in turn1_human] == ["what data is available?"]

    # Turn-2 prompt must include both turn-1's HumanMessage (hydrated)
    # and turn-2's HumanMessage (current question).
    turn2_human = [m for m in captured_messages[1] if isinstance(m, HumanMessage)]
    assert "what data is available?" in [m.content for m in turn2_human]
    assert "and where does it come from?" in [m.content for m in turn2_human]


# --- Event seq monotonicity (Phase A step 1) ---


@pytest.mark.asyncio
async def test_run_record_events_have_contiguous_monotonic_seq(tmp_path: Any) -> None:
    """Every event in `record.events` carries a monotonically-increasing
    `seq` starting from 0, including events drained from the graph's
    `_events` channel (which arrive with the default `seq=0`).

    This is the ordering primitive the streaming-SSE endpoint will use
    for `Last-Event-ID` replay — without contiguous seq, reconnecting
    clients can't deterministically pick up after a known point.
    """

    from miot_harness.runtime.events import HarnessEvent

    # Graph emits 3 events with default seq=0 — graphs don't know record state.
    graph_events = [
        HarnessEvent(run_id="ignored", type="plan.created", message="planned"),
        HarnessEvent(run_id="ignored", type="agent.turn", message="planner"),
        HarnessEvent(run_id="ignored", type="tool.completed", message="done"),
    ]
    data_graph = AsyncMock()
    data_graph.ainvoke = AsyncMock(
        return_value={"answer": "result", "_events": graph_events}
    )
    supervisor = _build_supervisor(
        tmp_path,
        data_graph=data_graph,
        llm_router=_scripted_llm_router("DATA_QUERY"),
    )

    record = await supervisor.run(
        UserRequest(message="q", tenant_id="orion")
    )

    seqs = [e.seq for e in record.events]
    assert seqs == list(range(len(seqs))), (
        f"expected contiguous seq from 0, got {seqs}"
    )
    # Sanity: at least run.started + route.selected + 3 graph events +
    # run.completed = 6 events on the happy DATA_QUERY path.
    assert len(seqs) >= 6


@pytest.mark.asyncio
async def test_seq_monotonic_across_agentic_path(tmp_path: Any) -> None:
    """Same contract on the DATA_AGENTIC drain — events from the agentic
    graph also get stamped with monotonic seq when appended.
    """

    from miot_harness.runtime.events import HarnessEvent

    graph_events = [
        HarnessEvent(run_id="ignored", type="agent.turn", message="explorer"),
        HarnessEvent(run_id="ignored", type="tool.completed", message="probe"),
    ]
    agentic_graph = AsyncMock()
    agentic_graph.ainvoke = AsyncMock(
        return_value={"answer": "explored", "_events": graph_events}
    )
    supervisor = _build_supervisor(
        tmp_path,
        agentic_graph=agentic_graph,
        llm_router=_scripted_llm_router("DIRECT"),
    )

    record = await supervisor.run(
        UserRequest(message="explore", tenant_id="orion", mode="agentic")
    )

    seqs = [e.seq for e in record.events]
    assert seqs == list(range(len(seqs))), (
        f"expected contiguous seq from 0, got {seqs}"
    )


# --- _emit helper extraction (Phase A step 2) ---


def test_emit_stamps_seq_and_appends_to_record(tmp_path: Any) -> None:
    """`HarnessSupervisor._emit(record, event)` is the single funnel
    responsible for stamping seq + appending to record.events. Direct
    unit-test of the helper so future refactors of the funnel are caught
    independently of the full `run()` integration tests.
    """

    from miot_harness.runtime.events import HarnessEvent
    from miot_harness.runtime.run_store import HarnessRunRecord

    supervisor = _build_supervisor(tmp_path)
    record = HarnessRunRecord(run_id="run_x", status="running")
    e1 = HarnessEvent(run_id="run_x", type="run.started", message="hi")
    e2 = HarnessEvent(run_id="run_x", type="route.selected", message="r")

    supervisor._emit(record, e1)
    supervisor._emit(record, e2)

    assert [e.seq for e in record.events] == [0, 1]
    assert record.events == [e1, e2]


@pytest.mark.asyncio
async def test_agentic_graph_events_emit_live_per_node(tmp_path: Any) -> None:
    """A graph exposing a real `astream` (as compiled LangGraph does) has its
    `_events` landed on the record per state snapshot — the live-SSE contract —
    not drained after the run. Events repeated across snapshots (append-channel
    semantics) emit exactly once. Regression for the "route.selected, then ~40s
    of silence, then one flush" stream observed on agentic runs."""

    from miot_harness.runtime.events import HarnessEvent

    e1 = HarnessEvent(run_id="", type="agent.started", message="planner in")
    e2 = HarnessEvent(run_id="", type="tool.started", message="acs_query")

    class _RecordingBus:
        def __init__(self) -> None:
            self.published: list[str] = []

        def publish(self, run_id: str, event: HarnessEvent) -> None:
            self.published.append(event.id)

        def close(self, run_id: str) -> None:  # supervisor closes at run end
            pass

    bus = _RecordingBus()

    class _StreamingGraph:
        """Async-generator astream double; captures what the bus had already
        seen when control resumed between snapshots (the liveness probe)."""

        def __init__(self) -> None:
            self.bus_ids_mid_run: list[str] | None = None

        async def astream(
            self, initial_state: dict[str, Any], stream_mode: str = "values"
        ) -> Any:
            assert stream_mode == "values"
            yield {"_events": [e1]}
            # Control resumes only after the supervisor consumed snapshot 1:
            # e1 must ALREADY have been published (live), not deferred.
            self.bus_ids_mid_run = list(bus.published)
            yield {"_events": [e1, e2], "answer": "streamed"}

    graph = _StreamingGraph()
    supervisor = HarnessSupervisor(
        router=IntentRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        llm_router=_scripted_llm_router("DIRECT"),
        agentic_graph=graph,
        event_bus=bus,  # type: ignore[arg-type]
        tenant_lock="orion",
    )

    record = await supervisor.run(
        UserRequest(message="explore", tenant_id="orion", mode="agentic")
    )

    assert record.answer == "streamed"
    # Liveness: e1 was published before the graph produced its second snapshot.
    assert graph.bus_ids_mid_run is not None
    assert e1.id in graph.bus_ids_mid_run
    assert e2.id not in graph.bus_ids_mid_run
    # Dedup: e1 appeared in both snapshots but landed exactly once.
    assert [ev.id for ev in record.events].count(e1.id) == 1
    assert [ev.id for ev in record.events].count(e2.id) == 1


def test_langgraph_astream_is_async_generator_function() -> None:
    """`_invoke_graph_emitting` detects real compiled graphs via
    `inspect.isasyncgenfunction(graph.astream)`. If a langgraph upgrade ever
    turns `astream` into a plain method returning an async iterator, the
    supervisor would silently fall back to post-run emission and live SSE
    would die undetected — pin the assumption here instead."""

    import inspect

    from langgraph.pregel import Pregel

    assert inspect.isasyncgenfunction(Pregel.astream)
