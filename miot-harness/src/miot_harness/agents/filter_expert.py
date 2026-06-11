"""Filter Expert (Haiku tier).

Real Claude often wraps structured output in ```json``` fences; we
strip those before parsing. We also clear `next_action` on every
return so the supervisor doesn't re-enter filter_expert in a loop
when the analyst signals "need_more_tools" repeatedly.



One LLM call per turn. Given the user message and a catalog of the
datasource's tools (with @meta / Layer hints), emits a single
DataStep representing the next tool call. The supervisor then routes
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
import re
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from pydantic import ValidationError

from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import DataPlan, DataStep
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)


def _strip_fences(text: str) -> str:
    """Real Claude wraps structured output in ```json fences; strip them."""
    text = text.strip()
    match = _JSON_FENCE_RE.search(text)
    if match:
        return match.group(1).strip()
    return text


# {display_name} → profile.display_name, {tenant_display} → the tenant the
# datasource is locked to (profile.tenant_lock, capitalized), {tool_prefix}
# → profile.tool_prefix, {prefix_label} → the prefix with its trailing
# underscore turned into a "*" glob the way the prompt names the naming
# convention. All come straight from the active datasource profile.
_FILTER_EXPERT_SYSTEM_TEMPLATE = """\
You are the Filter Expert for {display_name} ({tenant_display} fleet operations).
You pick the SINGLE next {prefix_label} tool call to advance the user's
question. You DO NOT answer the question yourself.

Routing hints:
- L1 tools answer broad operational questions (KPI summaries).
- L2 tools group services / fleet by category.
- L3 tools drill into one service.
- VT tools support shift-handoff narratives.

Output ONLY a JSON object with this exact shape:
{{"intent": "...", "tool": "{tool_prefix}xxx", "args": {{}}, "rationale": "..."}}
- intent: one short phrase describing what you're trying to learn.
- tool: must be the exact name of one of the tools in the catalog.
- args: a JSON object of p_* parameter overrides; empty {{}} is fine
  to use the function's defaults.
- rationale: one sentence justifying this choice.

Available tools:
{catalog}
"""


def build_tool_catalog(registry: ToolRegistry, *, profile: DataSourceProfile) -> str:
    lines: list[str] = []
    for name in registry.names():
        if not name.startswith(profile.tool_prefix):
            continue
        tool = registry.get(name)
        first_line = (tool.description or "").splitlines()[0].strip()
        lines.append(f"- {name}: {first_line}")
    return (
        "\n".join(lines)
        if lines
        else f"(no {profile.display_name.lower()} tools registered)"
    )


def build_capabilities_summary(
    registry: ToolRegistry, *, profile: DataSourceProfile, max_entries: int = 15
) -> str:
    """User-facing (Spanish-context) bullet list of what the datasource can
    answer — the synthesizer's onboarding fallback when planning fails
    (Gap 4: meta-questions like '¿qué puedes hacer?' in canned mode)."""
    lines: list[str] = []
    for name in registry.names():
        if not name.startswith(profile.tool_prefix):
            continue
        if len(lines) >= max_entries:
            break
        tool = registry.get(name)
        first_line = (tool.description or "").splitlines()[0].strip()
        lines.append(f"- {name}: {first_line}")
    return "\n".join(lines)


def _parse_step(text: str) -> DataStep | None:
    cleaned = _strip_fences(text)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        # Valid JSON but not an object (e.g. "[]" or "42") — same
        # malformed-step fallback as undecodable text.
        return None
    try:
        return DataStep(
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
    profile: DataSourceProfile,
) -> dict[str, Any]:
    """LangGraph node: returns a state delta dict.

    When `state["prior_messages"]` is populated (multi-turn chat with a
    `conversation_id`), the prior turns are spliced between the system
    prompt and the current user message so references like "tell me more
    about that" can be resolved against context (plan 13 §E5 hydration).
    """
    catalog = build_tool_catalog(registry, profile=profile)
    # e.g. "<prefix>_" → "<prefix>_*" for the naming-convention phrasing.
    prefix_label = f"{profile.tool_prefix}*"
    system = _FILTER_EXPERT_SYSTEM_TEMPLATE.format(
        display_name=profile.display_name,
        tenant_display=(profile.tenant_lock or profile.display_name).capitalize(),
        tool_prefix=profile.tool_prefix,
        prefix_label=prefix_label,
        catalog=catalog,
    )

    user_message = state.get("user_message", "")
    prior_messages = state.get("prior_messages") or []
    messages: list[BaseMessage] = [SystemMessage(content=system)]
    messages.extend(prior_messages)
    messages.append(HumanMessage(content=user_message))
    response = await model.ainvoke(messages)

    text = response.content if hasattr(response, "content") else str(response)
    if not isinstance(text, str):
        text = str(text)

    step = _parse_step(text)
    if step is None:
        logger.error("filter_expert: model returned unparseable response: %r", text[:200])
        return {
            "failure": "filter_expert returned malformed step",
            "next_action": None,
        }

    if not step.tool.startswith(profile.tool_prefix):
        logger.error("filter_expert: model picked out-of-scope datasource tool %r", step.tool)
        return {
            "failure": f"filter_expert picked out-of-scope tool: {step.tool}",
            "next_action": None,
        }

    if step.tool not in registry.names():
        logger.error("filter_expert: model hallucinated tool %r (not in registry)", step.tool)
        return {
            "failure": f"filter_expert proposed unknown tool: {step.tool}",
            "next_action": None,
        }

    plan = state.get("plan")
    try:
        if plan is None:
            new_plan = DataPlan(steps=[step])
        else:
            new_plan = DataPlan(
                steps=[*plan.steps, step],
                final_format=plan.final_format,
            )
    except ValidationError as exc:
        # DataPlan caps steps at max_length=4 (review item N13).
        logger.warning("filter_expert: plan capped at max steps; routing to synth (%s)", exc)
        return {
            "failure": "plan reached max step cap; synthesizing with current evidence",
            "next_action": "ready_to_synthesize",
        }

    ctx: HarnessContext = state["ctx"]
    plan_created_event = None
    if plan is None:
        plan_created_event = HarnessEvent(
            run_id=ctx.run_id,
            type="plan.created",
            message="Initial plan created by filter_expert",
            data={"step_count": len(new_plan.steps), "first_tool": step.tool},
        )

    delta: dict[str, Any] = {
        "plan": new_plan,
        "turn_count": int(state.get("turn_count", 0)) + 1,
        # CRITICAL: clear next_action so the supervisor doesn't re-enter
        # this node when the previous turn was "need_more_tools".
        "next_action": None,
    }
    if plan_created_event is not None:
        delta["_events"] = [plan_created_event]
    return delta
