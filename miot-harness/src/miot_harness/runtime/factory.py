from pathlib import Path

from miot_harness.config import get_settings
from miot_harness.runtime.approvals import ApprovalRegistry
from miot_harness.runtime.conversation import InMemoryConversationStore
from miot_harness.runtime.conversation_policy import InMemoryConversationPolicyStore
from miot_harness.runtime.event_bus import RunEventBus
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.registry import build_default_registry


def build_harness(workspace_dir: Path) -> HarnessSupervisor:
    """The supervisor with its always-on parts.

    The agent loop, profile and tenant lock need the datasource and model
    boot, so the FastAPI lifespan (`api/server.py`) sets them.
    """

    settings = get_settings()
    return HarnessSupervisor(
        tools=build_default_registry(),
        run_store=JsonRunStore(workspace_dir),
        conversation_store=InMemoryConversationStore(
            summarize_at_turns=settings.conversation_summarize_at_turns,
            keep_recent_turns=settings.conversation_keep_recent_turns,
        ),
        conversation_tool_token_budget=settings.conversation_tool_token_budget,
        # Costs nothing without subscribers; the SSE endpoint reads it.
        event_bus=RunEventBus(),
        # Pending approvals, resolved by /runs/{id}/approvals/{aid}.
        approval_registry=ApprovalRegistry(),
        conversation_policy_store=InMemoryConversationPolicyStore(),
    )
