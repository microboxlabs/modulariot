"""Multi-provider chat model factory.

Dispatches model name → BaseChatModel:
  - claude-* → langchain_anthropic.ChatAnthropic
  - gpt-*    → langchain_openai.ChatOpenAI

Provider API keys are read from HarnessSettings (which honors the
plain ANTHROPIC_API_KEY / OPENAI_API_KEY env vars).
"""

from __future__ import annotations

from typing import Literal

from langchain_core.language_models import BaseChatModel
from pydantic import SecretStr

from miot_harness.config import get_settings

# Anthropic `output_config.effort` levels (Opus 4.7+). "high" is the model's
# natural default (a no-op); "xhigh"/"max" actually deepen reasoning at a
# latency/cost premium. See ChatAnthropic.effort.
Effort = Literal["low", "medium", "high", "xhigh", "max"]
_EFFORT_LEVELS: frozenset[str] = frozenset(("low", "medium", "high", "xhigh", "max"))


def get_chat_model(
    name: str,
    *,
    thinking_budget_tokens: int | None = None,
    effort: Effort | None = None,
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
    providers ignore both params.
    """

    settings = get_settings()

    if name.startswith("claude-"):
        from langchain_anthropic import ChatAnthropic

        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set; cannot construct Claude chat model")
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
            "model_name": name,
            "api_key": SecretStr(settings.anthropic_api_key),
            "timeout": 60,
            "stop": None,
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

    if name.startswith("gpt-") or name.startswith("o1-") or name.startswith("o3-"):
        from langchain_openai import ChatOpenAI

        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set; cannot construct OpenAI chat model")
        return ChatOpenAI(model=name, api_key=SecretStr(settings.openai_api_key))

    raise ValueError(
        f"Unsupported chat model name: {name!r}. Expected a claude-* / gpt-* / o1-* / o3-* prefix."
    )
