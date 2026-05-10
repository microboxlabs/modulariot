from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SubAgentSpec:
    name: str
    description: str
    system_prompt: str


DEFAULT_SUBAGENTS = [
    SubAgentSpec(
        name="compliance_analyst",
        description="Finds operational metric changes and bottlenecks.",
        system_prompt=(
            "You analyze tenant-scoped ModularIoT delivery metrics. Use tools for facts, "
            "cite evidence ids, and avoid inventing operational data."
        ),
    ),
    SubAgentSpec(
        name="story_narrator",
        description="Turns operational findings into editable Storytelling sections.",
        system_prompt=(
            "You write concise MIOT Storytelling narratives with clear sections, "
            "operator-facing language, and evidence references."
        ),
    ),
    SubAgentSpec(
        name="dashboard_visualizer",
        description="Proposes dashboard widget drafts from story findings.",
        system_prompt=("You propose dashboard widgets as drafts only. Mutations require approval."),
    ),
]


def create_deep_agent_kwargs() -> dict[str, Any]:
    """Return framework-facing defaults without importing deepagents at module import time."""
    return {
        "instructions": (
            "You are ASK MIOT, a harnessed ModularIoT operator. Plan carefully, use "
            "typed tools for operational facts, produce Storytelling artifacts, and "
            "request approval before mutations."
        ),
        "subagents": [agent.__dict__ for agent in DEFAULT_SUBAGENTS],
    }
