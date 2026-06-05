"""`agent_span` context manager attributes (A2)."""

from __future__ import annotations

from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from miot_harness.observability.spans import agent_span


def test_agent_span_emits_required_attributes(
    memory_exporter: InMemorySpanExporter,
) -> None:
    with agent_span(
        "filter_expert",
        run_id="run-123",
        tenant_id="acme",
        mode="agentic",
    ):
        pass

    finished = memory_exporter.get_finished_spans()
    assert len(finished) == 1
    span = finished[0]
    # No span_prefix passed → the neutral "datasource" default.
    assert span.name == "datasource.filter_expert"
    assert span.attributes["gen_ai.operation.name"] == "datasource.filter_expert"
    assert span.attributes["modular.run_id"] == "run-123"
    assert span.attributes["modular.tenant_id"] == "acme"
    assert span.attributes["modular.mode"] == "agentic"


def test_agent_span_omits_optional_attrs_when_unset(
    memory_exporter: InMemorySpanExporter,
) -> None:
    with agent_span("synthesizer", run_id="run-9"):
        pass
    finished = memory_exporter.get_finished_spans()
    assert finished[0].name == "datasource.synthesizer"
    attrs = dict(finished[0].attributes)
    assert "modular.tenant_id" not in attrs
    assert "modular.mode" not in attrs
    assert attrs["modular.run_id"] == "run-9"


def test_agent_span_nests_under_parent(memory_exporter: InMemorySpanExporter) -> None:
    """Child spans inherit the parent context so traces form a tree."""

    with agent_span("supervisor", run_id="r1"):
        with agent_span("filter_expert", run_id="r1"):
            pass

    spans = memory_exporter.get_finished_spans()
    # SimpleSpanProcessor emits in finish order: child first, then parent.
    child = next(s for s in spans if s.name == "datasource.filter_expert")
    parent = next(s for s in spans if s.name == "datasource.supervisor")
    assert child.parent is not None
    assert child.parent.span_id == parent.context.span_id
