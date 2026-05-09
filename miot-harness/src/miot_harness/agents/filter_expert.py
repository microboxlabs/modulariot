"""Filter Expert (Haiku tier).

One LLM call per turn. Given the user message and a catalog of
coordinador_* tools (with @meta / Layer hints), emits a single
NexoStep representing the next tool call. The supervisor then routes
to data_fetcher; on return, freshness_judge + domain_analyst decide
whether to ask for another step.

Output shape is parsed from the model's structured JSON response.
We don't use `with_structured_output` here because v1 needs to work
with FakeListChatModel in tests (which only emits raw strings); a
small json.loads + Pydantic parse is enough for the contract.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import ValidationError

from miot_harness.runtime.plan import NexoPlan, NexoStep
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

_FILTER_EXPERT_SYSTEM_TEMPLATE = """\
You are the Filter Expert for Coordinador (Mintral fleet operations).
You pick the SINGLE next coordinador_* tool call to advance the user's
question. You DO NOT answer the question yourself.

Routing hints:
- L1 tools answer broad operational questions (KPI summaries).
- L2 tools group services / fleet by category.
- L3 tools drill into one service.
- VT tools support shift-handoff narratives.

Output ONLY a JSON object with this exact shape:
{{"intent": "...", "tool": "coordinador_xxx", "args": {{}}, "rationale": "..."}}
- intent: one short phrase describing what you're trying to learn.
- tool: must be the exact name of one of the tools in the catalog.
- args: a JSON object of p_* parameter overrides; empty {{}} is fine
  to use the function's defaults.
- rationale: one sentence justifying this choice.

Available tools:
{catalog}
"""


def build_tool_catalog(registry: ToolRegistry) -> str:
    lines: list[str] = []
    for name in registry.names():
        if not name.startswith("coordinador_"):
            continue
        tool = registry.get(name)
        first_line = (tool.description or "").splitlines()[0].strip()
        lines.append(f"- {name}: {first_line}")
    return "\n".join(lines) if lines else "(no coordinador tools registered)"


def _parse_step(text: str) -> NexoStep | None:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return None
    try:
        return NexoStep(
            intent=payload.get("intent", ""),
            tool=payload.get("tool", ""),
            args=payload.get("args", {}) or {},
            rationale=payload.get("rationale", ""),
        )
    except ValidationError:
        return None


async def filter_expert_node(
    state: dict[str, Any],
    *,
    registry: ToolRegistry,
    model: BaseChatModel,
) -> dict[str, Any]:
    """LangGraph node: returns a state delta dict."""
    catalog = build_tool_catalog(registry)
    system = _FILTER_EXPERT_SYSTEM_TEMPLATE.format(catalog=catalog)

    user_message = state.get("user_message", "")
    response = await model.ainvoke([
        SystemMessage(content=system),
        HumanMessage(content=user_message),
    ])

    text = response.content if hasattr(response, "content") else str(response)
    if not isinstance(text, str):
        text = str(text)

    step = _parse_step(text)
    if step is None:
        logger.error("filter_expert: model returned unparseable response: %r", text[:200])
        return {"failure": "filter_expert returned malformed step"}

    if step.tool not in registry.names():
        logger.error(
            "filter_expert: model hallucinated tool %r (not in registry)", step.tool
        )
        return {
            "failure": f"filter_expert proposed unknown tool: {step.tool}",
        }

    plan = state.get("plan")
    if plan is None:
        new_plan = NexoPlan(steps=[step])
    else:
        new_plan = NexoPlan(
            steps=[*plan.steps, step],
            final_format=plan.final_format,
        )

    return {
        "plan": new_plan,
        "turn_count": int(state.get("turn_count", 0)) + 1,
    }
