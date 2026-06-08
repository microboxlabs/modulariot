"""Rule-based supervisor for the datasource conversational graph.

v1 ships without an LLM in this seat — `next_agent(state)` is a small
state machine that reads from the state set by the previous node and
returns the next node name. Nodes set `state.next_action` to suggest
where to go next; the supervisor enforces invariants on top:

  - turn cap (`settings.agents_max_turns`) → force synthesizer
  - failure flag → synthesizer (it renders a graceful refusal)
  - answer set → END
  - long transcript → summarizer (>10 messages)

The intent is to keep cost predictable in v1 while leaving the seat
open for an LLM-based supervisor (`agents_supervisor_mode='llm'`) once
we have observed traffic.
"""

from __future__ import annotations

from typing import Any

from miot_harness.config import HarnessSettings


def next_agent(state: dict[str, Any], settings: HarnessSettings) -> str:
    """Decide which node runs next.

    Returns one of:
      "filter_expert" | "data_fetcher" | "freshness_judge" |
      "domain_analyst" | "synthesizer" | "summarizer" | "__end__"
    """
    if state.get("answer"):
        return "__end__"

    if state.get("failure"):
        return "synthesizer"

    turn_count = int(state.get("turn_count", 0))
    if turn_count >= settings.agents_max_turns:
        return "synthesizer"

    messages = state.get("messages") or []
    if len(messages) > 10:
        return "summarizer"

    next_action = state.get("next_action")
    if next_action == "judge_freshness":
        return "freshness_judge"
    if next_action == "analyze":
        return "domain_analyst"
    if next_action == "ready_to_synthesize":
        return "synthesizer"
    if next_action == "need_more_tools":
        return "filter_expert"

    plan = state.get("plan")
    pending_idx = int(state.get("pending_step_index", 0))
    if plan is not None and pending_idx < len(plan.steps):
        return "data_fetcher"

    if plan is None:
        return "filter_expert"

    # Plan exhausted, no explicit next_action — go synthesize.
    return "synthesizer"
