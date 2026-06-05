"""Verifies AgentTelemetryCallback emits a usage.recorded SSE event when
a `progress` sink is wired (plan: SSE rich events §B5).
"""

from __future__ import annotations

from uuid import uuid4

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.outputs import ChatGeneration, LLMResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from miot_harness.observability.callbacks import AgentTelemetryCallback
from miot_harness.runtime.events import HarnessEvent


def _serialized_anthropic() -> dict[str, object]:
    return {
        "lc": 1,
        "type": "constructor",
        "id": ["langchain", "chat_models", "anthropic", "ChatAnthropic"],
        "kwargs": {"model": "claude-haiku-4-5"},
        "name": "ChatAnthropic",
    }


def _llm_result(*, input_tokens: int = 100, output_tokens: int = 40) -> LLMResult:
    message = AIMessage(
        content="ok",
        usage_metadata={
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "input_token_details": {"cache_read": 5, "cache_creation": 3},
        },
    )
    return LLMResult(
        generations=[[ChatGeneration(message=message)]],
        llm_output={"model_name": "claude-haiku-4-5"},
    )


def test_callback_emits_usage_recorded_when_progress_wired(
    memory_exporter: InMemorySpanExporter,
) -> None:
    events: list[HarnessEvent] = []
    cb = AgentTelemetryCallback(
        agent_name="filter_expert",
        run_id="run_abc",
        progress=events.append,
    )
    rid = uuid4()
    cb.on_chat_model_start(_serialized_anthropic(), [[HumanMessage(content="hi")]], run_id=rid)
    cb.on_llm_end(_llm_result(input_tokens=200, output_tokens=80), run_id=rid)

    usage_events = [e for e in events if e.type == "usage.recorded"]
    assert len(usage_events) == 1
    payload = usage_events[0].data
    # Total input (200) minus cache_read (5) minus cache_creation (3) = 192
    assert payload == {
        "agent": "filter_expert",
        "model": "claude-haiku-4-5",
        "input_tokens": 192,
        "output_tokens": 80,
        "cache_read_input_tokens": 5,
        "cache_creation_input_tokens": 3,
        "cost_usd": payload["cost_usd"],
    }
    assert payload["cost_usd"] > 0
    assert usage_events[0].run_id == "run_abc"


def test_callback_skips_usage_event_when_no_progress(
    memory_exporter: InMemorySpanExporter,
) -> None:
    cb = AgentTelemetryCallback(agent_name="critic", run_id="run_xyz")
    rid = uuid4()
    cb.on_chat_model_start(_serialized_anthropic(), [[HumanMessage(content="hi")]], run_id=rid)
    cb.on_llm_end(_llm_result(), run_id=rid)
    # Nothing to assert positively — but the lack of crash + the existing
    # span emission (already pinned by tests/observability/test_callbacks.py)
    # confirms the optional path doesn't regress.


def test_callback_swallows_progress_sink_failure(
    memory_exporter: InMemorySpanExporter,
    caplog,
) -> None:
    """A buggy progress sink must NOT tear down the LLM call. The
    callback should log the exception and keep going so observability
    can never break the user-visible path.
    """
    import logging

    def _exploding(_event: HarnessEvent) -> None:
        raise RuntimeError("event bus is on fire")

    cb = AgentTelemetryCallback(
        agent_name="filter_expert",
        run_id="run_boom",
        progress=_exploding,
    )
    rid = uuid4()
    cb.on_chat_model_start(_serialized_anthropic(), [[HumanMessage(content="hi")]], run_id=rid)
    # Must not raise — the LLM call surfaces as completed even though
    # the sink blew up.
    with caplog.at_level(logging.ERROR, logger="miot_harness.observability.callbacks"):
        cb.on_llm_end(_llm_result(), run_id=rid)
    assert any(
        "usage.recorded progress sink failed" in rec.message
        for rec in caplog.records
    )


def test_callback_omits_cost_usd_when_model_unknown(
    memory_exporter: InMemorySpanExporter,
) -> None:
    events: list[HarnessEvent] = []
    cb = AgentTelemetryCallback(
        agent_name="planner",
        run_id="run_unknown",
        progress=events.append,
    )
    rid = uuid4()
    serialized = _serialized_anthropic()
    serialized["kwargs"] = {"model": "claude-not-real-2099"}  # type: ignore[index]
    cb.on_chat_model_start(serialized, [[HumanMessage(content="hi")]], run_id=rid)
    result = _llm_result()
    result.llm_output = {"model_name": "claude-not-real-2099"}
    cb.on_llm_end(result, run_id=rid)

    usage_events = [e for e in events if e.type == "usage.recorded"]
    assert len(usage_events) == 1
    assert "cost_usd" not in usage_events[0].data
    assert usage_events[0].data["model"] == "claude-not-real-2099"
