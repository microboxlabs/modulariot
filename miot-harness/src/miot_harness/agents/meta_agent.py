"""Meta-question agent (Haiku tier).

Answers schema/primer/introspection questions from a cached pg_proc
catalog + the Coordinador primer text. No SQL, no tool invocation —
the structural guarantee lives in the function signature (no
``registry`` / ``tools`` / ``pool`` parameter; nothing to call).

Cheap path for "what data do you have?", "what does fn_dx_eta_hoy
return?", "how is es_critico calculated?". Falls through to NEXO_QUERY
upstream if the intent router confused a data question with a meta one.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

_META_SYSTEM_TEMPLATE = """You are the ModularIoT meta-question agent.

You answer questions about *what data is available* and *what each
function does* — never the data itself. You have NO database access
and NO tools. If the question requires querying data, say so and stop:
the user can re-ask in agentic or canned mode.

# Coordinador primer
{primer}

# Curated catalog (each row is one `fn_dx_*` function)
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
) -> dict[str, Any]:
    """LangGraph node: answer a meta question; return ``{"answer": str}`` delta."""

    system = _META_SYSTEM_TEMPLATE.format(primer=primer, catalog=_format_catalog(catalog))
    response = await model.ainvoke(
        [
            SystemMessage(content=system),
            HumanMessage(content=state.get("user_message", "")),
        ]
    )
    text = response.content if hasattr(response, "content") else str(response)
    return {"answer": text if isinstance(text, str) else str(text)}
