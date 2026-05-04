from typing import Any

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.tool import HarnessTool, Progress
from miot_harness.tools.dashboard import (
    apply_dashboard_patch_tool,
    create_dashboard_widget_draft_tool,
    get_dashboard_context_tool,
)
from miot_harness.tools.delivery_metrics import get_delivery_compliance_metrics_tool
from miot_harness.tools.storytelling import create_story_draft_tool
from miot_harness.tools.workflow_events import get_workflow_bottlenecks_tool


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, HarnessTool[Any, Any]] = {}

    def register(self, tool: HarnessTool[Any, Any]) -> None:
        if tool.name in self._tools:
            raise ValueError(f"Tool already registered: {tool.name}")
        self._tools[tool.name] = tool

    def get(self, name: str) -> HarnessTool[Any, Any]:
        return self._tools[name]

    def names(self) -> list[str]:
        return sorted(self._tools.keys())

    async def invoke(
        self,
        name: str,
        ctx: HarnessContext,
        raw_input: dict[str, object],
        progress: Progress,
    ) -> object:
        return await self.get(name).invoke(ctx, raw_input, progress)


def build_default_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(get_delivery_compliance_metrics_tool())
    registry.register(get_workflow_bottlenecks_tool())
    registry.register(get_dashboard_context_tool())
    registry.register(create_story_draft_tool())
    registry.register(create_dashboard_widget_draft_tool())
    registry.register(apply_dashboard_patch_tool())
    return registry
