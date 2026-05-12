"""Per-agent span context manager.

The root ``nexo.run`` span is opened by the FastAPI lifespan or the
graph entry point. Each LangGraph node opens a child via ``agent_span`` so
that LLM-call spans emitted by ``NexoTelemetryCallback`` nest under the
correct agent in Langfuse.
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
