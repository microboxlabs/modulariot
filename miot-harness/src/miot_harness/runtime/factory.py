from pathlib import Path

from miot_harness.config import get_settings
from miot_harness.runtime.conversation import InMemoryConversationStore
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
    `conversation_turn_cap` reads from settings so operators can tune
    multi-turn memory depth via `MIOT_HARNESS_CONVERSATION_TURN_CAP`.
    """

    settings = get_settings()
    return HarnessSupervisor(
        router=IntentRouter(),
        tools=build_default_registry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(workspace_dir),
        conversation_store=InMemoryConversationStore(),
        conversation_turn_cap=settings.conversation_turn_cap,
    )
