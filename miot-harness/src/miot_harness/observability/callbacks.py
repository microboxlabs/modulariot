"""LangChain callback that emits per-agent OTel GenAI spans for each LLM call.

Bound to each LangGraph node in ``runtime/nexo_graph.py`` (A3) via the
``callbacks`` field of ``RunnableConfig``. One callback instance per node
invocation; the instance tracks per-run-id span handles so concurrent LLM
calls under the same node do not cross-talk.

Emits Langfuse first-class fields (plan 13 §E10) alongside the OTel GenAI
semconv attrs so the Langfuse UI's filter sidebar (User ID / Session ID
/ Tags) is populated for per-client cost rollups.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any
from uuid import UUID

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import BaseMessage
from langchain_core.outputs import LLMResult
from opentelemetry import trace
from opentelemetry.trace import Span, Status, StatusCode

from miot_harness.observability.pricing import (
    PRICING,
    TokenUsage,
    UnknownModelError,
    compute_cost,
)

_TRACER_NAME = "miot_harness"


def _provider_from_serialized(serialized: dict[str, Any]) -> str:
    """Map LangChain's `serialized.id` lineage to an OTel GenAI system label."""

    lineage = serialized.get("id") or []
    if any("anthropic" in str(part).lower() for part in lineage):
        return "anthropic"
    if any("openai" in str(part).lower() for part in lineage):
        return "openai"
    name = (serialized.get("name") or "").lower()
    if "anthropic" in name:
        return "anthropic"
    if "openai" in name:
        return "openai"
    return "unknown"


def _model_from_serialized(serialized: dict[str, Any]) -> str:
    kwargs = serialized.get("kwargs") or {}
    model = kwargs.get("model") or kwargs.get("model_name")
    return str(model) if model is not None else ""


def _model_from_llm_output(llm_output: dict[str, Any] | None) -> str:
    if not llm_output:
        return ""
    model = llm_output.get("model_name") or llm_output.get("model")
    return str(model) if model is not None else ""


def _extract_usage(response: LLMResult) -> TokenUsage:
    """Pull a normalized TokenUsage out of LangChain's response shapes.

    LangChain reports `usage_metadata.input_tokens` as the *total* input
    (including cache reads/creation). The Anthropic-style buckets we use
    downstream require splitting that total back into raw vs cache.
    """

    for generation_list in response.generations:
        for generation in generation_list:
            usage_metadata = getattr(getattr(generation, "message", None), "usage_metadata", None)
            if not usage_metadata:
                continue
            details = usage_metadata.get("input_token_details") or {}
            cache_read = int(details.get("cache_read", 0) or 0)
            cache_creation = int(details.get("cache_creation", 0) or 0)
            total_input = int(usage_metadata.get("input_tokens", 0) or 0)
            return TokenUsage(
                input_tokens=max(total_input - cache_read - cache_creation, 0),
                output_tokens=int(usage_metadata.get("output_tokens", 0) or 0),
                cache_read_input_tokens=cache_read,
                cache_creation_input_tokens=cache_creation,
            )

    # Fallback: legacy `llm_output.usage` dict (older providers / non-chat models).
    llm_output = response.llm_output or {}
    usage = llm_output.get("usage") or {}
    return TokenUsage(
        input_tokens=int(usage.get("input_tokens", 0) or usage.get("prompt_tokens", 0) or 0),
        output_tokens=int(usage.get("output_tokens", 0) or usage.get("completion_tokens", 0) or 0),
        cache_read_input_tokens=int(usage.get("cache_read_input_tokens", 0) or 0),
        cache_creation_input_tokens=int(usage.get("cache_creation_input_tokens", 0) or 0),
    )


class NexoTelemetryCallback(BaseCallbackHandler):
    """Emits one OTel span per LLM call, attributed to the owning agent."""

    def __init__(
        self,
        agent_name: str,
        *,
        run_id: str,
        tenant_id: str | None = None,
        mode: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        tags: Sequence[str] | None = None,
        environment: str | None = None,
    ) -> None:
        self._agent_name = agent_name
        self._run_id = run_id
        self._tenant_id = tenant_id
        self._mode = mode
        self._user_id = user_id
        self._session_id = session_id
        self._tags = list(tags) if tags else None
        self._environment = environment
        self._tracer = trace.get_tracer(_TRACER_NAME)
        self._open_spans: dict[UUID, _CallState] = {}

    def on_chat_model_start(
        self,
        serialized: dict[str, Any],
        messages: list[list[BaseMessage]],
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        span = self._tracer.start_span(f"nexo.{self._agent_name}")
        provider = _provider_from_serialized(serialized)
        model = _model_from_serialized(serialized)
        span.set_attribute("gen_ai.operation.name", f"nexo.{self._agent_name}")
        span.set_attribute("gen_ai.system", provider)
        if model:
            span.set_attribute("gen_ai.request.model", model)
        span.set_attribute("modular.agent", self._agent_name)
        span.set_attribute("modular.run_id", self._run_id)
        if self._tenant_id is not None:
            span.set_attribute("modular.tenant_id", self._tenant_id)
        if self._mode is not None:
            span.set_attribute("modular.mode", self._mode)
        # Langfuse first-class fields (E10) — promoted from OTel attrs to
        # filter columns in the Tracing UI for per-client cost rollups.
        if self._user_id is not None:
            span.set_attribute("langfuse.user.id", self._user_id)
        if self._session_id is not None:
            span.set_attribute("langfuse.session.id", self._session_id)
        if self._environment is not None:
            span.set_attribute("langfuse.environment", self._environment)
        if self._tags:
            span.set_attribute("langfuse.tags", json.dumps(self._tags))
        self._open_spans[run_id] = _CallState(span=span, model=model)

    def on_llm_end(
        self,
        response: LLMResult,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        state = self._open_spans.pop(run_id, None)
        if state is None:
            return
        usage = _extract_usage(response)
        model = state.model or _model_from_llm_output(response.llm_output)
        if model:
            state.span.set_attribute("gen_ai.request.model", model)
        state.span.set_attribute("gen_ai.usage.input_tokens", usage.input_tokens)
        state.span.set_attribute("gen_ai.usage.output_tokens", usage.output_tokens)
        if usage.cache_read_input_tokens:
            state.span.set_attribute(
                "gen_ai.usage.cache_read.input_tokens", usage.cache_read_input_tokens
            )
        if usage.cache_creation_input_tokens:
            state.span.set_attribute(
                "gen_ai.usage.cache_creation.input_tokens", usage.cache_creation_input_tokens
            )
        if model and model in PRICING:
            try:
                cost = compute_cost(model, usage)
                state.span.set_attribute("gen_ai.usage.cost_usd", float(cost))
            except UnknownModelError:
                pass
        state.span.end()

    def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        state = self._open_spans.pop(run_id, None)
        if state is None:
            return
        state.span.set_status(Status(StatusCode.ERROR, description=str(error)))
        state.span.record_exception(error)
        state.span.end()


class _CallState:
    __slots__ = ("model", "span")

    def __init__(self, *, span: Span, model: str) -> None:
        self.span = span
        self.model = model
