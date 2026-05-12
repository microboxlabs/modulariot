"""E10 — Langfuse first-class trace fields populated on every span.

Langfuse's OTel ingest promotes specific attribute names to the Tracing
UI's filter columns (User ID / Session ID / Tags / Environment). We
emit them on both the root `nexo.run` span and every per-agent
`nexo.<agent>` span so the per-client cost rollups don't depend on
post-hoc metadata filtering.
"""

from __future__ import annotations

import json
from uuid import uuid4

import pytest
from langchain_core.messages import HumanMessage
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from miot_harness.observability.callbacks import NexoTelemetryCallback
from miot_harness.observability.spans import agent_span


def test_agent_span_emits_langfuse_user_session_tags(
    memory_exporter: InMemorySpanExporter,
) -> None:
    with agent_span(
        "run",
        run_id="run_e10_001",
        tenant_id="mintral",
        mode="agentic",
        user_id="odtorres",
        session_id="conv-abc-123",
        tags=["tenant:mintral", "mode:agentic", "route:nexo_agentic"],
        environment="local",
    ):
        pass

    span = memory_exporter.get_finished_spans()[0]
    attrs = dict(span.attributes or {})

    assert attrs["langfuse.user.id"] == "odtorres"
    assert attrs["langfuse.session.id"] == "conv-abc-123"
    assert attrs["langfuse.environment"] == "local"
    # Tags are serialized as JSON for portability across Langfuse versions.
    assert json.loads(attrs["langfuse.tags"]) == [
        "tenant:mintral",
        "mode:agentic",
        "route:nexo_agentic",
    ]


def test_agent_span_omits_langfuse_attrs_when_unset(
    memory_exporter: InMemorySpanExporter,
) -> None:
    """Plan-12 callers that don't know about E10 still produce valid spans."""

    with agent_span("synthesizer", run_id="run_old"):
        pass

    attrs = dict(memory_exporter.get_finished_spans()[0].attributes or {})
    for key in (
        "langfuse.user.id",
        "langfuse.session.id",
        "langfuse.tags",
        "langfuse.environment",
    ):
        assert key not in attrs


def test_callback_emits_langfuse_attrs_on_llm_call(
    memory_exporter: InMemorySpanExporter,
) -> None:
    from langchain_core.outputs import ChatGeneration, LLMResult
    from langchain_core.messages import AIMessage

    cb = NexoTelemetryCallback(
        agent_name="filter_expert",
        run_id="run_e10_002",
        tenant_id="mintral",
        mode="canned",
        user_id="odtorres",
        session_id="thread-xyz",
        tags=["tenant:mintral", "mode:canned", "agent:filter_expert"],
        environment="local",
    )

    rid = uuid4()
    serialized = {
        "lc": 1,
        "type": "constructor",
        "id": ["langchain", "chat_models", "anthropic", "ChatAnthropic"],
        "kwargs": {"model": "claude-haiku-4-5"},
        "name": "ChatAnthropic",
    }
    cb.on_chat_model_start(serialized, [[HumanMessage(content="hi")]], run_id=rid)
    # Need an LLM result to close the span (the attrs are set on start).
    message = AIMessage(
        content="ok",
        usage_metadata={
            "input_tokens": 10,
            "output_tokens": 3,
            "total_tokens": 13,
            "input_token_details": {},
        },
    )
    cb.on_llm_end(
        LLMResult(
            generations=[[ChatGeneration(message=message)]],
            llm_output={"model_name": "claude-haiku-4-5"},
        ),
        run_id=rid,
    )

    span = memory_exporter.get_finished_spans()[0]
    attrs = dict(span.attributes or {})
    assert attrs["langfuse.user.id"] == "odtorres"
    assert attrs["langfuse.session.id"] == "thread-xyz"
    assert attrs["langfuse.environment"] == "local"
    assert json.loads(attrs["langfuse.tags"]) == [
        "tenant:mintral",
        "mode:canned",
        "agent:filter_expert",
    ]


def test_callback_omits_langfuse_attrs_when_not_provided(
    memory_exporter: InMemorySpanExporter,
) -> None:
    """Backward-compat: existing call sites without the E10 args still work."""

    from langchain_core.outputs import ChatGeneration, LLMResult
    from langchain_core.messages import AIMessage

    cb = NexoTelemetryCallback(
        agent_name="critic", run_id="run_old", tenant_id="mintral"
    )

    rid = uuid4()
    cb.on_chat_model_start(
        {"id": ["langchain", "chat_models", "anthropic"], "name": "x", "kwargs": {}},
        [[HumanMessage(content="hi")]],
        run_id=rid,
    )
    cb.on_llm_end(
        LLMResult(
            generations=[[ChatGeneration(message=AIMessage(content="ok"))]],
            llm_output={},
        ),
        run_id=rid,
    )

    attrs = dict(memory_exporter.get_finished_spans()[0].attributes or {})
    for key in (
        "langfuse.user.id",
        "langfuse.session.id",
        "langfuse.tags",
        "langfuse.environment",
    ):
        assert key not in attrs
