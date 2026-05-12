"""Run-level span context manager.

The supervisor opens a ``nexo.run`` root span around the whole graph
invocation (see ``runtime/supervisor.py``). LangGraph node bodies do not
wrap themselves in ``agent_span`` — instead, the per-agent
``NexoTelemetryCallback`` emits one ``nexo.<agent>`` span per LLM call
(in ``observability/callbacks.py``). Both layers share the
``modular.run_id`` attribute so Langfuse can regroup spans even when
LangGraph's parallel branches break OTel context propagation.

This helper exists for cases where deterministic (non-LLM) work needs a
named span — currently only the supervisor's root span. Future tool
invocations may use it; the callback layer covers LLM spans.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from opentelemetry import trace
from opentelemetry.trace import Span

_TRACER_NAME = "miot_harness"


@contextmanager
def agent_span(
    name: str,
    *,
    run_id: str,
    tenant_id: str | None = None,
    mode: str | None = None,
) -> Iterator[Span]:
    """Open a ``nexo.<name>`` span carrying the run/tenant/mode attribution."""

    tracer = trace.get_tracer(_TRACER_NAME)
    attributes: dict[str, str] = {
        "gen_ai.operation.name": f"nexo.{name}",
        "modular.run_id": run_id,
    }
    if tenant_id is not None:
        attributes["modular.tenant_id"] = tenant_id
    if mode is not None:
        attributes["modular.mode"] = mode

    with tracer.start_as_current_span(f"nexo.{name}", attributes=attributes) as span:
        yield span
