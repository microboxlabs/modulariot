"""Per-call telemetry for the models a run uses."""

from __future__ import annotations

from typing import Any

from langchain_core.language_models import BaseChatModel

from miot_harness.observability.callbacks import AgentTelemetryCallback
from miot_harness.runtime.context import HarnessContext


def instrument_model(
    model: BaseChatModel,
    agent_name: str,
    ctx: HarnessContext,
    *,
    progress: Any = None,
    span_prefix: str = "datasource",
) -> Any:
    """Wrap a chat model with a telemetry callback for this run.

    The callback emits one ``<span_prefix>.<agent>`` span per LLM call with
    GenAI semconv attributes (tokens, cache split, cost) and the
    ``langfuse.*`` attributes Langfuse filters on. When `progress` is set it
    also emits a `usage.recorded` event per call.
    """

    # One-shot requests group under their thread when there is no conversation.
    session_id = ctx.conversation_id or ctx.thread_id
    tags = [f"tenant:{ctx.tenant_id}", f"agent:{agent_name}"]
    if ctx.model:
        tags.append(f"model:{ctx.model}")
    cb = AgentTelemetryCallback(
        agent_name=agent_name,
        run_id=ctx.run_id,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        session_id=session_id,
        tags=tags,
        progress=progress,
        span_prefix=span_prefix,
    )
    return model.with_config(callbacks=[cb])
