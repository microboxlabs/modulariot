"""Anthropic-format tool definitions for the single-agent loop.

The tool list is part of the prompt-cache prefix (tools render before
system), so it must be byte-stable across requests: same scope rules as
the legacy planner catalog (curated `tool_prefix` functions + exploration
primitives), sorted by name, schemas derived deterministically from the
pydantic input models.
"""

from __future__ import annotations

from typing import Any

from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.tools.registry import ToolRegistry


def build_native_tools(
    registry: ToolRegistry, *, profile: DataSourceProfile
) -> list[dict[str, Any]]:
    tools: list[dict[str, Any]] = []
    for name in registry.names():  # .names() is already sorted
        tool = registry.get(name)
        in_scope = name.startswith(profile.tool_prefix) or tool.kind == "primitive"
        if not in_scope:
            continue
        tools.append(
            {
                "name": name,
                "description": tool.description,
                "input_schema": tool.input_model.model_json_schema(),
            }
        )
    return tools
