"""Meta-question agent (Haiku tier).

Answers schema/primer/introspection questions from a cached catalog +
the active datasource's primer text. No SQL, no tool invocation —
the structural guarantee lives in the function signature (no
``registry`` / ``tools`` / ``pool`` parameter; nothing to call).

Cheap path for "what data do you have?", "what does function X
return?", "how is metric Y calculated?". Falls through to DATA_QUERY
upstream if the intent router confused a data question with a meta one.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from miot_harness.agents.llm_streaming import stream_llm_with_thinking
from miot_harness.runtime.tool import Progress

_META_SYSTEM_TEMPLATE = """You are the ModularIoT meta-question agent.

You answer questions about *what data is available* and *what each
function does* — never the data itself. You have NO database access
and NO tools. If the question requires querying data, say so and stop:
the user can re-ask in agentic or canned mode.

# Datasource primer
{primer}

# Curated catalog (each row is one curated function)
{catalog}

Be concise. Cite function names by their exact identifier. If the
answer is in the primer, quote the relevant clause. If neither primer
nor catalog covers the question, say so.
"""


@dataclass(frozen=True, slots=True)
class MetaAgentCatalogEntry:
    """Minimal projection of `FunctionDescriptor` for the meta system prompt.

    Kept narrow so callers can build it from either the live introspection
    cache (production) or a hand-crafted fixture (tests).
    """

    name: str
    layer: str
    title: str
    body: str


def _format_catalog(entries: list[MetaAgentCatalogEntry]) -> str:
    if not entries:
        return "(catalog is empty)"
    return "\n".join(
        f"- `{e.name}` [Layer {e.layer}] {e.title}\n  {e.body}" for e in entries
    )


async def meta_agent_node(
    state: dict[str, Any],
    *,
    model: BaseChatModel,
    primer: str,
    catalog: list[MetaAgentCatalogEntry],
    prior_messages: list[BaseMessage] | None = None,
    progress: Progress | None = None,
    stream: bool = False,
    run_id: str | None = None,
) -> dict[str, Any]:
    """LangGraph node: answer a meta question; return ``{"answer": str}`` delta.

    When ``prior_messages`` is populated (multi-turn meta chat with a
    `conversation_id`), the prior turns are spliced between the system
    prompt and the current user message so meta follow-ups like
    "you mentioned fn_dx_X earlier, what about Y?" resolve correctly
    (plan 13 §E5 hydration).

    When ``stream`` is True (and ``progress`` + ``run_id`` are wired in),
    the call runs as a streaming ``astream_events`` loop and emits
    ``thinking.delta`` / ``thinking.completed`` events tagged with
    ``agent="meta_agent"`` so SSE clients see Haiku's reasoning unfold.
    Requires the underlying model to be constructed with
    ``thinking_budget_tokens`` for thinking to actually appear; otherwise
    only plain text streams (no thinking events).
    """

    system = _META_SYSTEM_TEMPLATE.format(primer=primer, catalog=_format_catalog(catalog))
    messages: list[BaseMessage] = [SystemMessage(content=system)]
    if prior_messages:
        messages.extend(prior_messages)
    messages.append(HumanMessage(content=state.get("user_message", "")))

    if stream and progress is not None and run_id is not None:
        text = await stream_llm_with_thinking(
            model=model,
            messages=messages,
            progress=progress,
            run_id=run_id,
            agent_name="meta_agent",
        )
        return {"answer": text or "(no answer)"}

    response = await model.ainvoke(messages)
    # New variable name (not `text`) so mypy doesn't try to assign
    # response.content's `str | list[...]` shape into the `text: str`
    # narrowed by the streaming branch above.
    raw_content = response.content if hasattr(response, "content") else str(response)
    return {"answer": raw_content if isinstance(raw_content, str) else str(raw_content)}
