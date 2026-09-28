"""Anthropic-format tool definitions for the single-agent loop.

The tool list is part of the prompt-cache prefix (tools render before
system), so it must be byte-stable across requests: the datasource's
`tool_prefix` functions, the exploration primitives, and `mcp_call` when a
skill names an MCP server, sorted by name, schemas derived from the
pydantic input models and compacted (see `compact_schema`).
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
        in_scope = name.startswith(profile.tool_prefix) or tool.kind in (
            "primitive",
            "mcp",
            "utility",
        )
        if not in_scope:
            continue
        if tool.available is not None and not tool.available():
            continue
        tools.append(
            {
                "name": name,
                "description": tool.description,
                "input_schema": compact_schema(tool.input_model.model_json_schema()),
            }
        )
    return tools


_NAME_MAPS = ("properties", "$defs", "definitions")
_NULL = {"type": "null"}


def compact_schema(node: Any) -> Any:
    """`node` without `title` keywords, `default: null`, or the null branch of
    a two-way `anyOf`: pydantic output the model does not need, about a sixth
    of the tool tokens. The pydantic input model still validates, and still
    accepts an explicit null."""
    if isinstance(node, list):
        return [compact_schema(item) for item in node]
    if not isinstance(node, dict):
        return node
    out: dict[str, Any] = {}
    for key, value in node.items():
        if key in _NAME_MAPS and isinstance(value, dict):
            out[key] = {name: compact_schema(sub) for name, sub in value.items()}
        elif (key == "title" and isinstance(value, str)) or (key == "default" and value is None):
            continue
        else:
            out[key] = compact_schema(value)
    branches = out.get("anyOf")
    if isinstance(branches, list) and len(branches) == 2 and _NULL in branches:
        other = next(b for b in branches if b != _NULL)
        if isinstance(other, dict):
            del out["anyOf"]
            out = {**other, **out}
    return out
