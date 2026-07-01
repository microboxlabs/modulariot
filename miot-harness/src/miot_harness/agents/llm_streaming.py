"""Shared streaming-with-thinking helper for agents that produce the
final user-visible answer (canned synthesizer, agentic synthesizer,
meta agent).

Walks LangChain v2 `astream_events` from a ChatAnthropic model
configured with `thinking={"type": "enabled", ...}`:

- Each thinking chunk → emits a `thinking.delta` HarnessEvent tagged
  with the agent name so SSE consumers can render reasoning in real
  time and the TUI can scope the dimmed block under the owning agent.
- On `on_chat_model_end` → emits a single `thinking.completed` with
  a best-effort token count from `usage_metadata`.
- Final assistant text is accumulated and returned.

Non-Anthropic providers (OpenAI) and Claude models without thinking
enabled stream plain-string content; this helper still works there
and simply emits no thinking events.
"""

from __future__ import annotations

from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage

from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.tool import Progress


async def stream_llm_with_thinking(
    *,
    model: BaseChatModel,
    messages: list[BaseMessage],
    progress: Progress,
    run_id: str,
    agent_name: str,
) -> str:
    """Run an LLM call via `astream_events`, emitting thinking events.

    Returns the final assistant text (already `.strip()`-ed). Callers
    typically follow up with an `answer.completed` HarnessEvent of
    their own.
    """

    thinking_parts: list[str] = []
    text_parts: list[str] = []
    thinking_index = 0
    answer_index = 0
    thinking_emitted = False

    async for event in model.astream_events(messages, version="v2"):
        kind = event.get("event")
        if kind == "on_chat_model_stream":
            chunk = (event.get("data") or {}).get("chunk")
            if chunk is None:
                continue
            content = getattr(chunk, "content", None)
            if isinstance(content, str):
                if content:
                    text_parts.append(content)
                    progress(
                        HarnessEvent(
                            run_id=run_id,
                            type="answer.delta",
                            message="",
                            data={
                                "agent": agent_name,
                                "delta": content,
                                "index": answer_index,
                            },
                        )
                    )
                    answer_index += 1
                continue
            if not isinstance(content, list):
                continue
            for block in content:
                if not isinstance(block, dict):
                    continue
                btype = block.get("type")
                if btype == "thinking":
                    delta = block.get("thinking") or ""
                    if not delta:
                        continue
                    thinking_parts.append(delta)
                    progress(
                        HarnessEvent(
                            run_id=run_id,
                            type="thinking.delta",
                            message="",
                            data={
                                "agent": agent_name,
                                "delta": delta,
                                "index": thinking_index,
                            },
                        )
                    )
                    thinking_index += 1
                elif btype == "text":
                    delta = block.get("text") or ""
                    if delta:
                        text_parts.append(delta)
                        progress(
                            HarnessEvent(
                                run_id=run_id,
                                type="answer.delta",
                                message="",
                                data={
                                    "agent": agent_name,
                                    "delta": delta,
                                    "index": answer_index,
                                },
                            )
                        )
                        answer_index += 1
        elif kind == "on_chat_model_end" and thinking_parts and not thinking_emitted:
            full_thinking = "".join(thinking_parts)
            progress(
                HarnessEvent(
                    run_id=run_id,
                    type="thinking.completed",
                    message=f"{agent_name} thinking done",
                    data={
                        "agent": agent_name,
                        "tokens": _thinking_token_estimate(event, full_thinking),
                        "length": len(full_thinking),
                    },
                )
            )
            thinking_emitted = True

    return "".join(text_parts).strip()


def _thinking_token_estimate(event: Any, full_thinking: str) -> int:
    """Pull thinking-token count from on_chat_model_end usage_metadata;
    fall back to a ~4-chars-per-token heuristic.

    `event` is typed `Any` because langchain's `astream_events` yields
    `StandardStreamEvent | CustomStreamEvent` (TypedDict union), which
    doesn't structurally match `dict[str, Any]` to mypy. The body
    treats it defensively (`.get`, `getattr`) under a try/except, so
    any shape that doesn't expose the expected keys falls through to
    the char-count fallback.
    """
    try:
        data = event.get("data") or {}
        output = data.get("output")
        usage = getattr(output, "usage_metadata", None) or {}
        details = usage.get("output_token_details") or usage.get("input_token_details") or {}
        thinking_tokens = details.get("thinking") or details.get("output_thinking")
        if thinking_tokens is not None:
            return int(thinking_tokens)
    except Exception:
        pass
    return max(1, len(full_thinking) // 4)
