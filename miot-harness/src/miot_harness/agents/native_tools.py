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


_NAME_MAPS = ("$defs", "definitions")
_DATA_KEYWORDS = ("default", "examples", "const", "enum")
_NULL = {"type": "null"}


def compact_schema(node: Any) -> Any:
    """`node` without `title` keywords, `default: null`, or the null branch of
    an optional property's two-way `anyOf`: pydantic output the model does not
    need, about a sixth of the tool tokens. The pydantic input model still
    validates, and still accepts an explicit null. A required property keeps
    its null branch, and defaults and examples are data, left as they are."""
    if isinstance(node, list):
        return [compact_schema(item) for item in node]
    if not isinstance(node, dict):
        return node
    required = set(node.get("required") or ())
    return {
        key: _compact_keyword(key, value, required)
        for key, value in node.items()
        if not (key == "title" and isinstance(value, str))
        and not (key == "default" and value is None)
    }


def _compact_keyword(key: str, value: Any, required: set[str]) -> Any:
    if key in _DATA_KEYWORDS:
        return value
    if key == "properties" and isinstance(value, dict):
        props = {name: compact_schema(sub) for name, sub in value.items()}
        return {name: sub if name in required else _optional(sub) for name, sub in props.items()}
    if key in _NAME_MAPS and isinstance(value, dict):
        return {name: compact_schema(sub) for name, sub in value.items()}
    return compact_schema(value)


def _optional(schema: Any) -> Any:
    """An omittable property's schema without its null branch."""
    if not isinstance(schema, dict):
        return schema
    branches = schema.get("anyOf")
    if not (isinstance(branches, list) and len(branches) == 2 and _NULL in branches):
        return schema
    other = next(b for b in branches if b != _NULL)
    if not isinstance(other, dict):
        return schema
    rest = {k: v for k, v in schema.items() if k != "anyOf"}
    return {**other, **rest}
