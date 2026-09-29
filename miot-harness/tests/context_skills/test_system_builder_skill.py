"""The packaged `system-builder` skill: it loads, the analyst names it, it
offers only the connections_* tools, and a write asks the user first."""

from __future__ import annotations

import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import pytest

import miot_harness.context_skills as context_skills_pkg
from miot_harness.context_skills.file_source import FileSkillSource
from miot_harness.context_skills.mcp_skills import (
    McpCallInput,
    McpSession,
    McpSkills,
    McpTool,
    McpToolResult,
    build_mcp_call_tool,
)
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.context_skills.skill_models import LoadedSkill, PlaybookSkill
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionDecision
from miot_harness.tools.registry import build_default_registry

_SKILLS_DIR = Path(context_skills_pkg.__file__).parent / "defaults" / "skills"
URL = "https://api.example/api/v1/mcp"


def _schema(*props: str) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {p: {"type": "string"} for p in ("organization", *props)},
        "required": ["organization"],
    }


class FakeModulith:
    def __init__(self) -> None:
        self.tools = [
            McpTool(name="connections_list", input_schema=_schema(), read_only=True),
            McpTool(name="connections_get", input_schema=_schema("connectionId"), read_only=True),
            McpTool(name="connections_templates", input_schema=_schema(), read_only=True),
            McpTool(
                name="connections_create",
                input_schema=_schema("name", "templateId", "baseUrl", "credentialProfileId"),
            ),
            McpTool(name="connections_test", input_schema=_schema("connectionId")),
            McpTool(name="stories_list", input_schema=_schema(), read_only=True),
        ]
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def open(self, url: str, token: str) -> Any:
        server = self

        @asynccontextmanager
        async def session() -> AsyncIterator[McpSession]:
            class _Session:
                async def list_tools(self) -> list[McpTool]:
                    return list(server.tools)

                async def call_tool(self, name: str, arguments: dict[str, Any]) -> McpToolResult:
                    server.calls.append((name, arguments))
                    return McpToolResult(structured={"id": "c1"})

            yield _Session()

        return session()


def _loaded() -> LoadedSkill:
    result = FileSkillSource(_SKILLS_DIR).load()
    assert not [d for d in result.diagnostics if d.level == "error"]
    found = [s for s in result.skills if s.skill.id == "system-builder"]
    assert len(found) == 1
    return found[0]


def _bundle(server: FakeModulith) -> ContextSkillsBundle:
    loaded = _loaded()
    skill = loaded.skill
    assert isinstance(skill, PlaybookSkill)
    assert skill.mcp is not None
    resolved = skill.model_copy(update={"mcp": skill.mcp.model_copy(update={"url": URL})})
    return ContextSkillsBundle(
        playbook_skills=(loaded.model_copy(update={"skill": resolved}),),
        mcp=McpSkills(open_session=server.open),
    )


def _ctx() -> HarnessContext:
    return HarnessContext(
        thread_id="t",
        tenant_id="tenant-a",
        user_id="u",
        caller_token="user-token",
        organization="acme",
    )


def test_the_skill_offers_the_connections_tools_and_the_analyst_names_it() -> None:
    skill = _loaded().skill
    assert isinstance(skill, PlaybookSkill)
    assert skill.mcp is not None
    assert skill.mcp.tools == ("connections_*",)
    assert skill.mcp.organization_arg == "organization"
    analyst = (_SKILLS_DIR / "miot-analyst" / "SKILL.md").read_text()
    assert "`system-builder`" in analyst


@pytest.mark.asyncio
async def test_loading_lists_only_the_connections_tools_without_the_organization() -> None:
    _, body = await _bundle(FakeModulith()).activate_skill_for_run(_ctx(), "system-builder") or (
        "",
        "",
    )

    listed = re.findall(r"^### (\w+) \(([^)]*)\)", body, re.MULTILINE)
    assert [name for name, _ in listed] == [
        "connections_list",
        "connections_get",
        "connections_templates",
        "connections_create",
        "connections_test",
    ]
    assert dict(listed)["connections_create"] == "changes data, asks the user first"
    assert '"organization"' not in body


@pytest.mark.asyncio
async def test_reads_run_straight_away_and_writes_ask_first() -> None:
    server = FakeModulith()
    bundle = _bundle(server)
    assert bundle.mcp is not None
    tool = build_mcp_call_tool(bundle.find_mcp_skill, bundle.mcp)
    assert tool.check_permission is not None

    def call(name: str) -> McpCallInput:
        return McpCallInput(skill_id="system-builder", tool=name)

    read = await tool.check_permission(_ctx(), call("connections_list"))
    write = await tool.check_permission(_ctx(), call("connections_create"))
    other = await tool.check_permission(_ctx(), call("stories_list"))

    assert read.decision == PermissionDecision.ALLOW
    assert write.decision == PermissionDecision.ASK
    assert other.decision == PermissionDecision.DENY, "the skill offers only connections_* tools"

    skill = bundle.find_mcp_skill("tenant-a", "system-builder")
    assert skill is not None
    await bundle.mcp.call(
        skill, _ctx(), "connections_create", {"name": "Orders", "organization": "other"}
    )
    assert server.calls == [("connections_create", {"name": "Orders", "organization": "acme"})]


def test_the_dashboard_guidance_names_the_tool_the_harness_offers() -> None:
    body = (_SKILLS_DIR / "system-builder" / "SKILL.md").read_text()
    assert "`dashboard_draft`" in body
    assert "dashboard_draft" in build_default_registry().names()
