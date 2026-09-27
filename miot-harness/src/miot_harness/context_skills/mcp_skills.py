"""Skills whose tools live on an MCP server.

A playbook with an `mcp` block offers the tools of that server. The
model's tool list is frozen for the prompt cache, so those tools are not
registered one by one: loading the skill lists them (name, description,
arguments) under the playbook body, and the model calls them through the
single `mcp_call` tool.

Every request to the server carries the bearer token of the user who
started the run, so the server applies that user's permissions. The tool
list is the same for everyone, so it is fetched once per server, with
the first caller's token, and kept.

The organization argument is never the model's to choose: the harness
fills it with the organization the run came through.
"""

from __future__ import annotations

import json
import logging
import os
import re
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from datetime import UTC, datetime
from typing import Any, Protocol

from pydantic import BaseModel, Field

from miot_harness.context_skills.skill_models import McpServer, PlaybookSkill
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress

logger = logging.getLogger(__name__)

MCP_CALL_TOOL = "mcp_call"

_ENV_PREFIX_RE = re.compile(r"^\$\{([A-Z_][A-Z0-9_]*)\}")


class McpTool(BaseModel):
    """What the harness keeps of one tool the server lists."""

    name: str
    title: str = ""
    description: str = ""
    input_schema: dict[str, Any] = Field(default_factory=dict)
    read_only: bool = False


class McpToolResult(BaseModel):
    """A tool's answer: its structured content when it has one, else its text."""

    is_error: bool = False
    text: str = ""
    structured: Any = None


class McpSession(Protocol):
    async def list_tools(self) -> list[McpTool]: ...

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> McpToolResult: ...


OpenSession = Callable[[str, str], AbstractAsyncContextManager[McpSession]]


class McpCallInput(BaseModel):
    skill_id: str = Field(description="The id of the loaded skill the tool belongs to.")
    tool: str = Field(description="The tool's name, as listed when the skill was loaded.")
    arguments: dict[str, Any] = Field(
        default_factory=dict, description="The tool's arguments, as its schema describes."
    )


class McpCallOutput(BaseModel):
    tool: str
    result: Any = None
    source: str = ""
    refreshed_at: datetime | None = None


def resolve_url(server: McpServer) -> str:
    """The server URL with a leading ${ENV_VAR} filled in.

    Raises ValueError when the variable is unset or the result is not an
    absolute http(s) URL, so the loader can skip the skill.
    """
    url = server.url
    match = _ENV_PREFIX_RE.match(url)
    if match is not None:
        value = os.environ.get(match.group(1), "").strip()
        if not value:
            raise ValueError(f"MCP server url needs ${{{match.group(1)}}}, which is not set")
        url = value.rstrip("/") + url[match.end() :]
    if not url.startswith(("http://", "https://")):
        raise ValueError(f"MCP server url must be absolute http(s): {url!r}")
    return url


def offers(server: McpServer, tool_name: str) -> bool:
    """Whether the skill's `tools` list lets the model call this tool."""
    if not server.tools:
        return True
    for pattern in server.tools:
        if pattern.endswith("*"):
            if tool_name.startswith(pattern[:-1]):
                return True
        elif tool_name == pattern:
            return True
    return False


class McpSkills:
    """Lists and calls the tools of the MCP servers skills name."""

    def __init__(self, open_session: OpenSession | None = None) -> None:
        self._open = open_session or open_streamable_session
        self._tools: dict[str, list[McpTool]] = {}

    async def tools(self, server: McpServer, token: str | None) -> list[McpTool]:
        """The skill's tools. Fetched from the server the first time only."""
        if server.url not in self._tools:
            if not token:
                raise RuntimeError(
                    "this run carries no user token; MCP skills work only for runs "
                    "started through the organization's API"
                )
            async with self._open(server.url, token) as session:
                self._tools[server.url] = await session.list_tools()
        return [t for t in self._tools[server.url] if offers(server, t.name)]

    async def describe(self, skill: PlaybookSkill, ctx: HarnessContext) -> str:
        """The Markdown listing appended to the skill's body when it is loaded."""
        assert skill.mcp is not None
        try:
            tools = await self.tools(skill.mcp, ctx.caller_token)
        except Exception as exc:  # noqa: BLE001 — the model is told, the run goes on
            logger.warning("MCP skill %s: could not list tools: %s", skill.id, exc)
            return f"## Tools\n\nThe tools of this skill could not be listed: {exc}"
        hidden = skill.mcp.organization_arg
        lines = [
            "## Tools",
            "",
            f'Call these with `{MCP_CALL_TOOL}`, passing `skill_id: "{skill.id}"`, the '
            "tool's name and its arguments.",
        ]
        if hidden:
            lines.append(f"The `{hidden}` argument is filled in for you; leave it out.")
        for tool in tools:
            kind = "read-only" if tool.read_only else "changes data, asks the user first"
            lines += [
                "",
                f"### {tool.name} ({kind})",
                tool.description or tool.title,
                "Arguments: " + json.dumps(_without(tool.input_schema, hidden), ensure_ascii=False),
            ]
        return "\n".join(lines)

    async def call(
        self, skill: PlaybookSkill, ctx: HarnessContext, tool: str, arguments: dict[str, Any]
    ) -> McpToolResult:
        assert skill.mcp is not None
        if not ctx.caller_token:
            raise RuntimeError("this run carries no user token to call the MCP server with")
        args = dict(arguments)
        hidden = skill.mcp.organization_arg
        if hidden:
            if not ctx.organization:
                raise RuntimeError("this run did not come through an organization")
            args[hidden] = ctx.organization
        async with self._open(skill.mcp.url, ctx.caller_token) as session:
            return await session.call_tool(tool, args)


def _without(schema: dict[str, Any], hidden: str | None) -> dict[str, Any]:
    """The input schema minus the argument the harness fills in."""
    if not hidden:
        return schema
    out = dict(schema)
    props = dict(out.get("properties") or {})
    props.pop(hidden, None)
    out["properties"] = props
    if "required" in out:
        out["required"] = [r for r in out["required"] if r != hidden]
    return out


def build_mcp_call_tool(
    find_skill: Callable[[str, str], PlaybookSkill | None], mcp: McpSkills
) -> HarnessTool[McpCallInput, McpCallOutput]:
    """The one tool the model calls an MCP skill's tools through.

    `find_skill(tenant_id, skill_id)` returns the MCP skill the tenant can
    see, or None. A read-only tool runs straight away; any other asks the
    user first, like every tool that changes data.
    """

    async def check_permission(ctx: HarnessContext, inp: McpCallInput) -> PermissionResult:
        skill = find_skill(ctx.tenant_id, inp.skill_id)
        if skill is None or skill.mcp is None:
            return PermissionResult.deny(f"no MCP skill {inp.skill_id!r}")
        try:
            tools = await mcp.tools(skill.mcp, ctx.caller_token)
        except Exception as exc:  # noqa: BLE001 — surfaced as a denial the model sees
            return PermissionResult.deny(f"could not list the tools of {inp.skill_id!r}: {exc}")
        tool = next((t for t in tools if t.name == inp.tool), None)
        if tool is None:
            return PermissionResult.deny(f"skill {inp.skill_id!r} offers no tool {inp.tool!r}")
        if tool.read_only:
            return PermissionResult.allow(f"read-only MCP tool {inp.tool}")
        return PermissionResult.ask(
            f"{inp.tool} changes data in {ctx.organization}; approval required"
        )

    async def call(ctx: HarnessContext, inp: McpCallInput, progress: Progress) -> McpCallOutput:
        skill = find_skill(ctx.tenant_id, inp.skill_id)
        assert skill is not None  # check_permission refused otherwise
        result = await mcp.call(skill, ctx, inp.tool, inp.arguments)
        if result.is_error:
            raise RuntimeError(result.text or f"{inp.tool} failed")
        return McpCallOutput(
            tool=inp.tool,
            result=result.structured if result.structured is not None else result.text,
            source=f"mcp:{inp.skill_id}",
            refreshed_at=datetime.now(UTC),
        )

    return HarnessTool(
        name=MCP_CALL_TOOL,
        description=(
            "Call a tool of a loaded skill that is backed by an MCP server. Load the skill "
            "first: loading it lists its tools and their arguments."
        ),
        input_model=McpCallInput,
        output_model=McpCallOutput,
        read_only=False,
        destructive=True,
        kind="mcp",
        source="mcp",
        check_permission=check_permission,
        call=call,
    )


class _StreamableSession:
    def __init__(self, client: Any) -> None:
        self._client = client

    async def list_tools(self) -> list[McpTool]:
        tools: list[McpTool] = []
        cursor: str | None = None
        while True:
            page = await self._client.list_tools(cursor=cursor)
            for t in page.tools:
                annotations = t.annotations
                tools.append(
                    McpTool(
                        name=t.name,
                        title=t.title or (annotations.title if annotations else None) or "",
                        description=t.description or "",
                        input_schema=dict(t.input_schema or {}),
                        read_only=bool(annotations and annotations.read_only_hint),
                    )
                )
            cursor = page.next_cursor
            if not cursor:
                return tools

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> McpToolResult:
        result = await self._client.call_tool(name, arguments)
        text = "\n".join(
            c.text for c in (result.content or []) if getattr(c, "type", None) == "text"
        )
        return McpToolResult(
            is_error=bool(result.is_error), text=text, structured=result.structured_content
        )


@asynccontextmanager
async def open_streamable_session(url: str, token: str) -> AsyncIterator[McpSession]:
    """An MCP session over Streamable HTTP, as the token's user."""
    import httpx2
    from mcp import Client
    from mcp.client.streamable_http import streamable_http_client

    try:
        async with httpx2.AsyncClient(
            headers={"Authorization": f"Bearer {token}"}, timeout=30.0
        ) as http:
            # No response cache: tool results are per user. "legacy" is the
            # initialize handshake every server of the 2025 spec speaks.
            async with Client(
                streamable_http_client(url, http_client=http), mode="legacy", cache=None
            ) as client:
                yield _StreamableSession(client)
    except BaseExceptionGroup as group:
        # The transport's task group wraps the one real failure; its own
        # message ("unhandled errors in a TaskGroup") tells nobody anything.
        cause = _innermost(group)
        raise RuntimeError(f"MCP server {url}: {cause}") from cause


def _innermost(group: BaseExceptionGroup[BaseException]) -> BaseException:
    error: BaseException = group
    while isinstance(error, BaseExceptionGroup):
        error = error.exceptions[0]
    return error
