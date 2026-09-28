"""Multi-provider chat model factory.

A model name resolves to a provider (see `model_providers`):
  - Anthropic models → langchain_anthropic.ChatAnthropic
  - every other provider → langchain_openai.ChatOpenAI on the provider's
    base URL (OpenAI, OpenRouter, DeepSeek, Qwen, Kimi, GLM)
"""

from __future__ import annotations

import re
from typing import Any, Literal

from langchain_core.language_models import BaseChatModel
from pydantic import SecretStr

from miot_harness.agents.model_providers import (
    ProviderRegistry,
    is_anthropic,
    registry_from_settings,
    split_model,
)
from miot_harness.config import get_settings
from miot_harness.runtime.context import RunEffort


def response_text(response: Any) -> str:
    """Extract plain text from a chat-model response.

    Anthropic models with extended/adaptive thinking enabled (the Opus 4.7+
    `effort` path) return ``message.content`` as a LIST of content blocks — a
    ``thinking`` block plus a ``text`` block — not a plain string. A naive
    ``str(content)`` then yields a Python-repr of the list (not the model's
    text), which silently breaks any caller that JSON-parses the answer (e.g.
    the advisor seat). This concatenates the ``text`` blocks and
    drops thinking, handling the plain-string case too.
    """
    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text" and isinstance(block.get("text"), str):
                    parts.append(block["text"])
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return str(content)


# Anthropic `output_config.effort` levels (Opus 4.7+). "high" is the model's
# natural default (a no-op); "xhigh"/"max" actually deepen reasoning at a
# latency/cost premium. See ChatAnthropic.effort.
Effort = Literal["low", "medium", "high", "xhigh", "max"]
_EFFORT_LEVELS: frozenset[str] = frozenset(("low", "medium", "high", "xhigh", "max"))

# Models on the Opus 4.7+ adaptive-thinking path (`effort`). Everything else on
# `claude-*` takes the pre-4.7 `thinking_budget_tokens` path.
_EFFORT_MODELS_RE = re.compile(r"^claude-(opus-4-(7|8|9)|(opus|sonnet|haiku|fable|mythos)-[5-9])")


def supports_effort(name: str) -> bool:
    return _EFFORT_MODELS_RE.match(name) is not None


def get_chat_model(
    name: str,
    *,
    thinking_budget_tokens: int | None = None,
    effort: Effort | None = None,
    reasoning_effort: str | None = None,
    timeout: int | None = None,
) -> BaseChatModel:
    """Multi-provider chat-model factory.

    Two mutually-exclusive reasoning controls on `claude-*` models:

    - `thinking_budget_tokens` > 0 — the **pre-4.7** path: forwards
      `thinking={"type": "enabled", "budget_tokens": ...}` and bumps
      `max_tokens` to `budget + 4096` (Anthropic requires
      max_tokens > budget_tokens). Use for Sonnet 4.6 etc.
    - `effort` — the **Opus 4.7+** path: forwards `thinking={"type": "adaptive"}`
      + `output_config.effort` (via ChatAnthropic's `effort` shorthand). Opus 4.8
      removed `budget_tokens` and *rejects* `thinking.type=enabled` (the 400 we
      hit when synth ran on Opus), so effort is the only knob there. `max_tokens`
      auto-defaults from the model profile — adaptive thinking tokens count
      against it, so we leave it at the model's full output budget.

    Passing both raises (they target different model generations). Non-Claude
    providers ignore both params; `reasoning_effort` is their knob instead.
    """

    provider, model_id = provider_registry().resolve(name)

    if provider.kind == "anthropic":
        from langchain_anthropic import ChatAnthropic

        budget_on = thinking_budget_tokens is not None and thinking_budget_tokens > 0
        if effort is not None and budget_on:
            raise ValueError(
                "get_chat_model: pass either `effort` (Opus 4.7+ adaptive) or "
                "`thinking_budget_tokens` (pre-4.7), not both"
            )
        if effort is not None and effort not in _EFFORT_LEVELS:
            raise ValueError(
                f"get_chat_model: invalid effort {effort!r}; "
                f"expected one of {sorted(_EFFORT_LEVELS)}"
            )
        kwargs: dict[str, object] = {
            "model_name": model_id,
            "api_key": SecretStr(provider.api_key),
            # 60s suits single-shot seats; the agent loop passes a longer
            # budget because an adaptive-thinking turn that plans several
            # tool calls can legitimately exceed a minute.
            "timeout": timeout if timeout is not None else 60,
            "stop": None,
            "metadata": _billing_metadata(provider.name, model_id),
        }
        if effort is not None:
            kwargs["thinking"] = {"type": "adaptive"}
            kwargs["effort"] = effort
        elif thinking_budget_tokens is not None and thinking_budget_tokens > 0:
            kwargs["thinking"] = {
                "type": "enabled",
                "budget_tokens": thinking_budget_tokens,
            }
            # Anthropic constraint: max_tokens must exceed budget_tokens.
            # Reserve 4096 tokens for the final answer text on top of
            # the thinking budget.
            kwargs["max_tokens"] = thinking_budget_tokens + 4096
        return ChatAnthropic(**kwargs)  # type: ignore[arg-type]

    from langchain_openai import ChatOpenAI

    # Thinking and effort are Anthropic controls; the others ignore them.
    return ChatOpenAI(
        model=model_id,
        reasoning_effort=reasoning_effort,
        api_key=SecretStr(provider.api_key),
        base_url=provider.base_url,
        timeout=timeout if timeout is not None else 60,
        # Token counts on streamed turns, for usage and billing.
        stream_usage=True,
        metadata=_billing_metadata(provider.name, model_id),
    )


def _billing_metadata(provider: str, model_id: str) -> dict[str, Any]:
    """Read by the telemetry callback, so usage is charged to the right provider."""
    return {"miot_provider": provider, "miot_model": model_id}


_registry: ProviderRegistry | None = None


def provider_registry() -> ProviderRegistry:
    """The providers models resolve against: set by `set_provider_registry`,
    else built from the environment."""
    if _registry is not None:
        return _registry
    settings = get_settings()
    return registry_from_settings(
        anthropic_api_key=settings.anthropic_api_key,
        openai_api_key=settings.openai_api_key,
        providers_json=settings.model_providers,
    )


def set_provider_registry(registry: ProviderRegistry | None) -> None:
    """Replace the providers models resolve against; None returns to the env."""
    global _registry
    _registry = registry


# Thinking budget per run effort on the pre-4.7 `claude-*` models.
_RUN_EFFORT_BUDGETS: dict[str, int] = {"low": 1024, "medium": 2048, "high": 4096, "max": 16384}
# OpenAI reasoning models take low/medium/high; `max` maps to the top.
_OPENAI_REASONING_RE = re.compile(r"^(o\d|gpt-5)")
_OPENAI_REASONING_EFFORT: dict[str, str] = {
    "low": "low",
    "medium": "medium",
    "high": "high",
    "max": "high",
}


def loop_model_kwargs(
    name: str,
    *,
    default_effort: Effort | None,
    default_thinking_budget: int,
    run_effort: RunEffort | None = None,
) -> dict[str, Any]:
    """Reasoning kwargs for `get_chat_model` on the agent loop.

    Without a run effort this is the deployment default. With one, it maps
    to the provider's knob: `effort` on the adaptive-thinking Claude models, a
    thinking budget on older Claude models, `reasoning_effort` on OpenAI
    reasoning models, and nothing where the model has no such control.
    """
    if not is_anthropic(name):
        if run_effort is None:
            return {}
        try:
            _, model_id = split_model(name)
        except ValueError:
            return {}
        if not _OPENAI_REASONING_RE.match(model_id.rsplit("/", 1)[-1]):
            return {}
        return {"reasoning_effort": _OPENAI_REASONING_EFFORT[run_effort]}
    if supports_effort(name):
        return {"effort": run_effort or default_effort}
    if run_effort is None:
        return {"thinking_budget_tokens": default_thinking_budget}
    return {"thinking_budget_tokens": _RUN_EFFORT_BUDGETS[run_effort]}
