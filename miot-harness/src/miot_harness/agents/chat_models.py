"""Multi-provider chat model factory.

Dispatches model name → BaseChatModel:
  - claude-* → langchain_anthropic.ChatAnthropic
  - gpt-*    → langchain_openai.ChatOpenAI

Provider API keys are read from HarnessSettings (which honors the
plain ANTHROPIC_API_KEY / OPENAI_API_KEY env vars).
"""

from __future__ import annotations

from langchain_core.language_models import BaseChatModel
from pydantic import SecretStr

from miot_harness.config import get_settings


def get_chat_model(
    name: str,
    *,
    thinking_budget_tokens: int | None = None,
) -> BaseChatModel:
    """Multi-provider chat-model factory.

    When `thinking_budget_tokens` > 0 on a `claude-*` model, forwards
    `thinking={"type": "enabled", "budget_tokens": ...}` to the Anthropic
    SDK and bumps `max_tokens` to `budget + 4096` (Anthropic requires
    max_tokens > budget_tokens). Non-Claude providers ignore the param.
    """

    settings = get_settings()

    if name.startswith("claude-"):
        from langchain_anthropic import ChatAnthropic

        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set; cannot construct Claude chat model")
        kwargs: dict[str, object] = {
            "model_name": name,
            "api_key": SecretStr(settings.anthropic_api_key),
            "timeout": 60,
            "stop": None,
        }
        if thinking_budget_tokens is not None and thinking_budget_tokens > 0:
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
