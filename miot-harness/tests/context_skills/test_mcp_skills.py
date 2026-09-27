from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import pytest

from miot_harness.config import HarnessSettings
from miot_harness.context_skills.file_source import FileSkillSource
from miot_harness.context_skills.loader import boot_context_skills
from miot_harness.context_skills.mcp_skills import (
    MCP_CALL_TOOL,
    McpSession,
    McpSkills,
    McpTool,
    McpToolResult,
    build_mcp_call_tool,
    offers,
    resolve_url,
)
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.context_skills.skill_models import LoadedSkill, McpServer, PlaybookSkill
from miot_harness.context_skills.source import ContextLoadResult, ContextSource
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionDecision
from miot_harness.tools.registry import build_default_registry

URL = "https://api.example/api/v1/mcp"
ORG = "acme"
TOKEN = "user-token"

ORG_SCHEMA = {
    "type": "object",
    "properties": {"organization": {"type": "string"}, "key": {"type": "string"}},
    "required": ["organization", "key"],
}


class FakeServer:
    """Answers like the modulith: lists tools, echoes calls, remembers who asked."""

    def __init__(self) -> None:
        self.tools = [
            McpTool(name="selectables_get", description="One list.", input_schema=ORG_SCHEMA,
                    read_only=True),
            McpTool(name="selectables_delete", description="Deletes a list.",
                    input_schema=ORG_SCHEMA),
            McpTool(name="other_tool", description="Not offered.", read_only=True),
        ]
        self.opened: list[tuple[str, str]] = []
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.failure: str | None = None

    def open(self, url: str, token: str) -> Any:
        server = self

        @asynccontextmanager
        async def session() -> AsyncIterator[McpSession]:
            server.opened.append((url, token))

            class _Session:
                async def list_tools(self) -> list[McpTool]:
                    return list(server.tools)

                async def call_tool(self, name: str, arguments: dict[str, Any]) -> McpToolResult:
                    server.calls.append((name, arguments))
                    if server.failure:
                        return McpToolResult(is_error=True, text=server.failure)
                    return McpToolResult(structured={"key": arguments.get("key")})

            yield _Session()

        return session()


def _skill(tools: tuple[str, ...] = ("selectables_*",)) -> PlaybookSkill:
    return PlaybookSkill(
        kind="playbook", id="selectables", name="selectables",
        mcp=McpServer(url=URL, tools=tools),
    )


def _ctx(token: str | None = TOKEN, organization: str | None = ORG) -> HarnessContext:
    return HarnessContext(
        thread_id="t", tenant_id="tenant-a", user_id="u",
        caller_token=token, organization=organization,
    )


def _bundle(server: FakeServer, skill: PlaybookSkill | None = None) -> ContextSkillsBundle:
    return ContextSkillsBundle(
        playbook_skills=(LoadedSkill(skill=skill or _skill(), playbook_body="Use the lists."),),
        mcp=McpSkills(open_session=server.open),
    )


def test_the_url_may_start_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MIOT_TEST_MODULITH", "http://modulith:8180/")
    assert resolve_url(McpServer(url="${MIOT_TEST_MODULITH}/api/v1/mcp")) == (
        "http://modulith:8180/api/v1/mcp"
    )
    monkeypatch.delenv("MIOT_TEST_MODULITH")
    with pytest.raises(ValueError, match="MIOT_TEST_MODULITH"):
        resolve_url(McpServer(url="${MIOT_TEST_MODULITH}/api/v1/mcp"))
    with pytest.raises(ValueError, match="absolute"):
        resolve_url(McpServer(url="/api/v1/mcp"))


def test_a_skill_offers_the_tools_it_names() -> None:
    server = McpServer(url=URL, tools=("selectables_*", "exact"))
    assert offers(server, "selectables_list")
    assert offers(server, "exact")
    assert not offers(server, "exact_not")
    assert offers(McpServer(url=URL), "anything")


@pytest.mark.asyncio
async def test_loading_the_skill_lists_its_tools_as_the_caller_once() -> None:
    server = FakeServer()
    bundle = _bundle(server)

    name, body = await bundle.activate_skill_for_run(_ctx(), "selectables") or ("", "")
    await bundle.activate_skill_for_run(_ctx(token="someone-else"), "selectables")

    assert name == "selectables"
    assert body.startswith("Use the lists.")
    assert "### selectables_get (read-only)" in body
    assert "### selectables_delete (changes data" in body
    assert "other_tool" not in body, "only the tools the skill names"
    assert '"organization"' not in body, "the organization is filled in, not asked for"
    assert server.opened == [(URL, TOKEN)], "listed once, with the caller's token"


@pytest.mark.asyncio
async def test_without_a_token_the_model_is_told_the_tools_cannot_be_listed() -> None:
    server = FakeServer()

    _, body = await _bundle(server).activate_skill_for_run(_ctx(token=None), "selectables") or (
        "", "")

    assert "could not be listed" in body
    assert "no user token" in body
    assert server.opened == []


@pytest.mark.asyncio
async def test_a_read_only_tool_runs_in_the_runs_organization() -> None:
    server = FakeServer()
    bundle = _bundle(server)
    tool = build_mcp_call_tool(lambda t, s: bundle.find_mcp_skill(t, s), bundle.mcp)  # type: ignore[arg-type]

    out = await tool.invoke(
        _ctx(),
        {"skill_id": "selectables", "tool": "selectables_get",
         "arguments": {"key": "delay_reason", "organization": "someone-else"}},
        lambda _e: None,
    )

    assert out.result == {"key": "delay_reason"}
    assert out.source == "mcp:selectables"
    assert server.calls == [("selectables_get", {"key": "delay_reason", "organization": ORG})]
    assert server.opened[-1] == (URL, TOKEN)


@pytest.mark.asyncio
async def test_a_tool_that_changes_data_asks_first_and_others_are_refused() -> None:
    server = FakeServer()
    bundle = _bundle(server)
    tool = build_mcp_call_tool(lambda t, s: bundle.find_mcp_skill(t, s), bundle.mcp)  # type: ignore[arg-type]

    async def decision(tool_name: str, skill_id: str = "selectables") -> PermissionDecision:
        inp = tool.input_model(skill_id=skill_id, tool=tool_name, arguments={})
        return (await tool.check_permission(_ctx(), inp)).decision

    assert await decision("selectables_delete") == PermissionDecision.ASK
    assert await decision("other_tool") == PermissionDecision.DENY
    assert await decision("selectables_get", skill_id="nope") == PermissionDecision.DENY


@pytest.mark.asyncio
async def test_what_the_server_refuses_reaches_the_model_as_an_error() -> None:
    server = FakeServer()
    server.failure = "selectable not found: nope"
    bundle = _bundle(server)
    tool = build_mcp_call_tool(lambda t, s: bundle.find_mcp_skill(t, s), bundle.mcp)  # type: ignore[arg-type]

    with pytest.raises(RuntimeError, match="selectable not found: nope"):
        await tool.invoke(
            _ctx(),
            {"skill_id": "selectables", "tool": "selectables_get", "arguments": {"key": "nope"}},
            lambda _e: None,
        )


class _NoContext(ContextSource):
    def load(self) -> ContextLoadResult:
        return ContextLoadResult()


def _skills_dir(tmp_path: Path) -> Path:
    skill = tmp_path / "selectables"
    skill.mkdir()
    (skill / "SKILL.md").write_text(
        "---\n"
        "name: selectables\n"
        "description: Read and edit the organization's option lists.\n"
        "mcp:\n"
        "  url: ${MIOT_TEST_MODULITH}/api/v1/mcp\n"
        "  tools: [selectables_*]\n"
        "---\n"
        "Use the lists.\n",
        encoding="utf-8",
    )
    return tmp_path


def test_boot_offers_the_skill_and_mcp_call_when_the_server_is_configured(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MIOT_TEST_MODULITH", "http://modulith:8180")
    registry = build_default_registry()

    result = boot_context_skills(
        registry, HarnessSettings(), context_source=_NoContext(),
        skill_source=FileSkillSource(_skills_dir(tmp_path)),
    )

    assert MCP_CALL_TOOL in registry.names()
    assert registry.get(MCP_CALL_TOOL).kind == "mcp"
    skill = result.bundle.find_mcp_skill("tenant-a", "selectables")
    assert skill is not None and skill.mcp is not None
    assert skill.mcp.url == "http://modulith:8180/api/v1/mcp"


def test_boot_drops_the_skill_while_its_server_is_not_configured(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("MIOT_TEST_MODULITH", raising=False)
    registry = build_default_registry()

    result = boot_context_skills(
        registry, HarnessSettings(), context_source=_NoContext(),
        skill_source=FileSkillSource(_skills_dir(tmp_path)),
    )

    assert MCP_CALL_TOOL not in registry.names()
    assert result.bundle.list_skills("tenant-a") == []
    assert any("MIOT_TEST_MODULITH" in d.message for d in result.diagnostics)
