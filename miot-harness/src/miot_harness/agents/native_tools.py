"""Anthropic-format tool definitions for the single-agent loop.

The tool list is part of the prompt-cache prefix (tools render before
system), so it must be byte-stable across requests: the datasource's
`tool_prefix` functions, the exploration primitives, and `mcp_call` when a
skill names an MCP server, sorted by name, schemas derived from the
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
        # `mcp` is the one tool MCP-backed skills are called through.
        in_scope = name.startswith(profile.tool_prefix) or tool.kind in ("primitive", "mcp")
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
