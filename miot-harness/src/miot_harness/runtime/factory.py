from pathlib import Path

from miot_harness.config import get_settings
from miot_harness.runtime.approvals import ApprovalRegistry
from miot_harness.runtime.conversation import InMemoryConversationStore
from miot_harness.runtime.event_bus import RunEventBus
from miot_harness.runtime.router import IntentRouter
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import build_default_registry


def build_harness(workspace_dir: Path) -> HarnessSupervisor:
    """Build the base supervisor with the always-on dependencies.

    Phase-E modules that require LIVE Nexo boot — `LLMIntentRouter`,
    `agentic_graph`, `meta_model`, `meta_catalog`, and `tenant_lock` —
    are wired by the FastAPI lifespan (`api/server.py`) once the Nexo
    integration is up; they remain `None` here so unit tests and
    Nexo-disabled deploys keep working.

    `conversation_store` is always-on because it's pure memory.
    `conversation_token_budget` reads from settings so operators can tune
    multi-turn memory depth via `MIOT_HARNESS_CONVERSATION_TOKEN_BUDGET`.
    """

    settings = get_settings()
    return HarnessSupervisor(
        router=IntentRouter(),
        tools=build_default_registry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(workspace_dir),
        conversation_store=InMemoryConversationStore(),
        conversation_token_budget=settings.conversation_token_budget,
        # Always-on event bus: zero cost when no subscribers (publish
        # iterates an empty list). The SSE endpoint reads this bus to
        # stream live events while a run is in-flight.
        event_bus=RunEventBus(),
        # Always-on approval registry: process-local map of pending
        # human-in-the-loop approvals. The /runs/{id}/approvals/{aid}
        # endpoint resolves entries here to unblock awaiting tools.
        approval_registry=ApprovalRegistry(),
    )
