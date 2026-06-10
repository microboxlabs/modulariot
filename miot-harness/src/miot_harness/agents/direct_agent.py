"""Direct-response agent (cheapest tier).

Composes the answer for DIRECT / OTHER routes — greetings, small talk,
and anything the intent router can't map to a data path. Before #628
the supervisor left ``answer`` null here ("client renders"), but no
client ever implemented that side of the contract, so users saw
"(no answer recorded)". The harness now owns the reply.

No primer, no catalog, no tools — the system prompt is intentionally
tiny so the call costs almost nothing. Capability questions route to
DATA_META (which carries the primer + catalog); this agent only needs
to respond conversationally and point there.
"""

from __future__ import annotations

from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from miot_harness.agents.llm_streaming import stream_llm_with_thinking
from miot_harness.runtime.tool import Progress

_DIRECT_SYSTEM_PROMPT = """You are the ModularIoT assistant for fleet \
coordination data. The user said something conversational (a greeting, \
thanks, small talk) or something outside your data scope.

Reply in the user's language, briefly and warmly (1-3 sentences). If it \
fits naturally, mention you can answer questions about the fleet data \
(services, ETAs, critical queues) or explain what data is available. \
Do not invent data or capabilities. No headings, no lists.
"""

# Deterministic fallback when no model is wired (mirrors the meta
# path's disabled branch, but a greeting must still greet). Bilingual
# because the deployment serves Spanish-first users.
FALLBACK_DIRECT_ANSWER = (
    "Hola — soy el asistente de ModularIoT. Puedo responder preguntas "
    "sobre los datos de la flota o explicarte qué datos existen. / "
    "Hi — I'm the ModularIoT assistant. Ask me about the fleet data or "
    "what data is available."
)


async def direct_agent_node(
    state: dict[str, Any],
    *,
    model: BaseChatModel,
    prior_messages: list[BaseMessage] | None = None,
    progress: Progress | None = None,
    stream: bool = False,
    run_id: str | None = None,
) -> dict[str, Any]:
    """Answer a DIRECT/OTHER turn; return ``{"answer": str}`` delta.

    Mirrors ``meta_agent_node``'s contract (prior-message splicing,
    optional ``stream_llm_with_thinking`` streaming) minus the primer
    and catalog — see the module docstring for why it stays tiny.
    """
    messages: list[BaseMessage] = [SystemMessage(content=_DIRECT_SYSTEM_PROMPT)]
    if prior_messages:
        messages.extend(prior_messages)
    messages.append(HumanMessage(content=state.get("user_message", "")))

    if stream and progress is not None and run_id is not None:
        text = await stream_llm_with_thinking(
            model=model,
            messages=messages,
            progress=progress,
            run_id=run_id,
            agent_name="direct_agent",
        )
        return {"answer": text or "(no answer)"}

    response = await model.ainvoke(messages)
    raw_content = response.content if hasattr(response, "content") else str(response)
    return {"answer": raw_content if isinstance(raw_content, str) else str(raw_content)}
