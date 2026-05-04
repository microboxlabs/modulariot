from pathlib import Path

from miot_harness.runtime.router import IntentRouter
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import build_default_registry


def build_harness(workspace_dir: Path) -> HarnessSupervisor:
    return HarnessSupervisor(
        router=IntentRouter(),
        tools=build_default_registry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(workspace_dir),
    )
