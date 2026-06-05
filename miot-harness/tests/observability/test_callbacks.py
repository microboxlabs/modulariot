"""NexoTelemetryCallback span emission (A2)."""

from __future__ import annotations

from uuid import uuid4

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.outputs import ChatGeneration, LLMResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from miot_harness.observability.callbacks import NexoTelemetryCallback


def _serialized_anthropic(model: str = "claude-haiku-4-5") -> dict[str, object]:
    return {
        "lc": 1,
        "type": "constructor",
        "id": ["langchain", "chat_models", "anthropic", "ChatAnthropic"],
        "kwargs": {"model": model},
        "name": "ChatAnthropic",
    }


def _llm_result(
    *,
    input_tokens: int = 100,
    output_tokens: int = 40,
    cache_read: int = 0,
    cache_creation: int = 0,
) -> LLMResult:
    usage_metadata = {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "input_token_details": {
            "cache_read": cache_read,
            "cache_creation": cache_creation,
        },
    }
    message = AIMessage(content="ok", usage_metadata=usage_metadata)
    generation = ChatGeneration(message=message)
    return LLMResult(generations=[[generation]], llm_output={"model_name": "claude-haiku-4-5"})


def test_callback_opens_and_closes_span_with_token_attrs(
    memory_exporter: InMemorySpanExporter,
) -> None:
    cb = NexoTelemetryCallback(agent_name="filter_expert", run_id="root-1", tenant_id="mintral")
    rid = uuid4()
    cb.on_chat_model_start(_serialized_anthropic(), [[HumanMessage(content="hi")]], run_id=rid)
    cb.on_llm_end(_llm_result(input_tokens=200, output_tokens=80), run_id=rid)

    spans = memory_exporter.get_finished_spans()
    assert len(spans) == 1
    span = spans[0]
    assert span.name == "nexo.filter_expert"
    attrs = dict(span.attributes)
    assert attrs["gen_ai.operation.name"] == "nexo.filter_expert"
    assert attrs["gen_ai.system"] == "anthropic"
    assert attrs["gen_ai.request.model"] == "claude-haiku-4-5"
    assert attrs["gen_ai.usage.input_tokens"] == 200
    assert attrs["gen_ai.usage.output_tokens"] == 80
    assert attrs["modular.agent"] == "filter_expert"
    assert attrs["modular.run_id"] == "root-1"
    assert attrs["modular.tenant_id"] == "mintral"
    # Cost is recorded at run-time (float seconds-since pricing.compute_cost).
    assert attrs["gen_ai.usage.cost_usd"] > 0


def test_callback_emits_cache_token_attrs_when_present(
    memory_exporter: InMemorySpanExporter,
) -> None:
    cb = NexoTelemetryCallback(agent_name="domain_analyst", run_id="root-2")
    rid = uuid4()
    cb.on_chat_model_start(_serialized_anthropic(), [[HumanMessage(content="hi")]], run_id=rid)
    cb.on_llm_end(
        _llm_result(input_tokens=10, output_tokens=4, cache_read=500, cache_creation=200),
        run_id=rid,
    )

    span = memory_exporter.get_finished_spans()[0]
    attrs = dict(span.attributes)
    assert attrs["gen_ai.usage.cache_read.input_tokens"] == 500
    assert attrs["gen_ai.usage.cache_creation.input_tokens"] == 200


def test_callback_handles_multiple_concurrent_runs(
    memory_exporter: InMemorySpanExporter,
) -> None:
    """Each run_id gets its own span — no cross-talk between concurrent calls."""

    cb = NexoTelemetryCallback(agent_name="executor", run_id="root-3")
    a, b = uuid4(), uuid4()
    cb.on_chat_model_start(_serialized_anthropic(), [[HumanMessage(content="a")]], run_id=a)
    cb.on_chat_model_start(_serialized_anthropic(), [[HumanMessage(content="b")]], run_id=b)
    cb.on_llm_end(_llm_result(input_tokens=1, output_tokens=1), run_id=b)
    cb.on_llm_end(_llm_result(input_tokens=2, output_tokens=2), run_id=a)

    spans = memory_exporter.get_finished_spans()
    assert len(spans) == 2
    # Both spans have the same agent attribution; only token counts differ.
    token_counts = sorted(int(s.attributes["gen_ai.usage.input_tokens"]) for s in spans)
    assert token_counts == [1, 2]


def test_callback_records_error_status_on_llm_error(
    memory_exporter: InMemorySpanExporter,
) -> None:
    from opentelemetry.trace import StatusCode

    cb = NexoTelemetryCallback(agent_name="critic", run_id="root-4")
    rid = uuid4()
    cb.on_chat_model_start(_serialized_anthropic(), [[HumanMessage(content="x")]], run_id=rid)
    cb.on_llm_error(RuntimeError("provider 5xx"), run_id=rid)

    span = memory_exporter.get_finished_spans()[0]
    assert span.status.status_code == StatusCode.ERROR
    assert "provider 5xx" in (span.status.description or "")


def test_callback_infers_openai_provider_from_model_name(
    memory_exporter: InMemorySpanExporter,
) -> None:
    cb = NexoTelemetryCallback(agent_name="meta_agent", run_id="root-5")
    rid = uuid4()
    serialized = {
        "lc": 1,
        "type": "constructor",
        "id": ["langchain", "chat_models", "openai", "ChatOpenAI"],
        "kwargs": {"model": "gpt-4o-mini"},
        "name": "ChatOpenAI",
    }
    cb.on_chat_model_start(serialized, [[HumanMessage(content="x")]], run_id=rid)
    cb.on_llm_end(_llm_result(input_tokens=5, output_tokens=2), run_id=rid)

    attrs = dict(memory_exporter.get_finished_spans()[0].attributes)
    assert attrs["gen_ai.system"] == "openai"
    assert attrs["gen_ai.request.model"] == "gpt-4o-mini"


def test_callback_span_prefix_overrides_nexo_default(
    memory_exporter: InMemorySpanExporter,
) -> None:
    """When span_prefix='fake', emitted span names start with 'fake.' not 'nexo.'."""
    cb = NexoTelemetryCallback(agent_name="filter_expert", run_id="root-6", span_prefix="fake")
    rid = uuid4()
    cb.on_chat_model_start(_serialized_anthropic(), [[HumanMessage(content="hi")]], run_id=rid)
    cb.on_llm_end(_llm_result(input_tokens=10, output_tokens=5), run_id=rid)

    spans = memory_exporter.get_finished_spans()
    assert len(spans) == 1
    span = spans[0]
    assert span.name == "fake.filter_expert"
    attrs = dict(span.attributes)
    assert attrs["gen_ai.operation.name"] == "fake.filter_expert"
