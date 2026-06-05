"""Run-level span context manager.

The supervisor opens a ``<datasource>.run`` root span around the whole
graph invocation (see ``runtime/supervisor.py``). LangGraph node bodies
do not wrap themselves in ``agent_span`` — instead, the per-agent
``AgentTelemetryCallback`` emits one ``<datasource>.<agent>`` span per LLM
call (in ``observability/callbacks.py``). The span prefix is the active
datasource profile name. Both layers share the
``modular.run_id`` attribute so Langfuse can regroup spans even when
LangGraph's parallel branches break OTel context propagation.

Emits two parallel attribute namespaces on every span (plan 13 §E10):

- ``modular.*`` — internal grouping, available as OTel metadata.
- ``langfuse.*`` — promoted by Langfuse's OTel ingest to first-class
  filter columns (user_id, session_id, tags, environment) so the
  Tracing UI's filter sidebar is populated for per-client cost
  rollups.
"""

from __future__ import annotations

import json
from collections.abc import Iterator, Sequence
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
    user_id: str | None = None,
    session_id: str | None = None,
    tags: Sequence[str] | None = None,
    environment: str | None = None,
    span_prefix: str = "datasource",
) -> Iterator[Span]:
    """Open a ``<span_prefix>.<name>`` span carrying the run/tenant/mode attribution.

    ``span_prefix`` defaults to ``"datasource"`` as a neutral fallback.
    Pass ``profile.name`` when a profile is in scope to make telemetry
    datasource-agnostic.

    Optional ``user_id`` / ``session_id`` / ``tags`` / ``environment``
    arguments populate Langfuse's first-class trace fields (E10).
    """

    tracer = trace.get_tracer(_TRACER_NAME)
    # All values below are strings (run_id, tenant_id, mode, user_id,
    # session_id, environment, and the JSON-encoded tags). OTel's
    # start_as_current_span expects Mapping[str, AttributeValue] where
    # AttributeValue is `str | bool | int | float | Sequence[...]` — a
    # bare `object` value type is too loose for that contract.
    attributes: dict[str, str] = {
        "gen_ai.operation.name": f"{span_prefix}.{name}",
        "modular.run_id": run_id,
    }
    if tenant_id is not None:
        attributes["modular.tenant_id"] = tenant_id
    if mode is not None:
        attributes["modular.mode"] = mode
    if user_id is not None:
        attributes["langfuse.user.id"] = user_id
    if session_id is not None:
        attributes["langfuse.session.id"] = session_id
    if environment is not None:
        attributes["langfuse.environment"] = environment
    if tags:
        # Langfuse accepts either an array of strings OR a JSON-encoded
        # string array. OTel SDK attributes are stricter about types than
        # the Langfuse ingest, so we serialise as JSON for portability.
        attributes["langfuse.tags"] = json.dumps(list(tags))

    with tracer.start_as_current_span(f"{span_prefix}.{name}", attributes=attributes) as span:
        yield span
