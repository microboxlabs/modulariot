"""The packaged `storyteller` and `session-summary` skills: they load, the
analyst names them, storyteller offers the stories_* tools, and a story is
saved with the run's organization and conversation."""

from __future__ import annotations

import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import pytest

import miot_harness.context_skills as context_skills_pkg
from miot_harness.config import HarnessSettings
from miot_harness.context_skills.file_source import FileSkillSource
from miot_harness.context_skills.loader import boot_context_skills
from miot_harness.context_skills.mcp_skills import (
    MCP_CALL_TOOL,
    McpSession,
    McpSkills,
    McpTool,
    McpToolResult,
)
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.context_skills.skill_models import LoadedSkill, PlaybookSkill
from miot_harness.context_skills.source import ContextLoadResult, ContextSource
from miot_harness.runtime.context import HarnessContext
from miot_harness.tools.registry import build_default_registry

_SKILLS_DIR = Path(context_skills_pkg.__file__).parent / "defaults" / "skills"
_DECK_TYPES = (
    Path(__file__).resolve().parents[3]
    / "turbo-repo/apps/app/src/features/storytelling/storytelling.types.ts"
)
URL = "https://api.example/api/v1/mcp"
THREAD = "8f14e45f-ceea-467a-9575-8a4a9d6b1c2e"


def _schema(*props: str) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {p: {"type": "string"} for p in ("organization", *props)},
        "required": ["organization", props[0]],
    }


class FakeStories:
    def __init__(self) -> None:
        self.tools = [
            McpTool(name="stories_list", input_schema=_schema("search"), read_only=True),
            McpTool(
                name="stories_create",
                input_schema=_schema("title", "kind", "version", "sourceThreadId"),
            ),
            McpTool(name="stories_add_version", input_schema=_schema("storyId", "version")),
            McpTool(name="stories_link", input_schema=_schema("storyId")),
            McpTool(name="selectables_get", input_schema=_schema("key"), read_only=True),
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
                    return McpToolResult(structured={"id": "s1"})

            yield _Session()

        return session()


def _playbooks() -> dict[str, LoadedSkill]:
    result = FileSkillSource(_SKILLS_DIR).load()
    assert not [d for d in result.diagnostics if d.level == "error"]
    return {s.skill.id: s for s in result.skills if isinstance(s.skill, PlaybookSkill)}


def _bundle(server: FakeStories) -> ContextSkillsBundle:
    loaded = _playbooks()["storyteller"]
    skill = loaded.skill
    assert isinstance(skill, PlaybookSkill)
    assert skill.mcp is not None
    resolved = skill.model_copy(update={"mcp": skill.mcp.model_copy(update={"url": URL})})
    return ContextSkillsBundle(
        playbook_skills=(loaded.model_copy(update={"skill": resolved}),),
        mcp=McpSkills(open_session=server.open),
    )


def _ctx(conversation_id: str = THREAD) -> HarnessContext:
    return HarnessContext(
        thread_id="t",
        tenant_id="tenant-a",
        user_id="u",
        conversation_id=conversation_id,
        caller_token="user-token",
        organization="acme",
    )


def test_the_skills_load_and_the_analyst_names_them() -> None:
    playbooks = _playbooks()
    assert {"storyteller", "session-summary"} <= set(playbooks)
    storyteller = playbooks["storyteller"].skill
    assert isinstance(storyteller, PlaybookSkill)
    assert storyteller.mcp is not None
    assert storyteller.mcp.tools == ("stories_*",)
    assert storyteller.mcp.conversation_arg == "sourceThreadId"
    analyst = (_SKILLS_DIR / "miot-analyst" / "SKILL.md").read_text()
    assert "`storyteller`" in analyst
    assert "`session-summary`" in analyst


class _NoContext(ContextSource):
    def load(self) -> ContextLoadResult:
        return ContextLoadResult()


def test_boot_offers_storyteller_when_the_modulith_is_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MIOT_HARNESS_MODULITH_URL", "http://modulith:8180")
    registry = build_default_registry()

    result = boot_context_skills(
        registry,
        HarnessSettings(),
        context_source=_NoContext(),
        skill_source=FileSkillSource(_SKILLS_DIR),
    )

    assert MCP_CALL_TOOL in registry.names()
    skill = result.bundle.find_mcp_skill("tenant-a", "storyteller")
    assert skill is not None
    assert skill.mcp is not None
    assert skill.mcp.url == "http://modulith:8180/api/v1/mcp"


@pytest.mark.asyncio
async def test_loading_storyteller_lists_only_the_stories_tools() -> None:
    _, body = await _bundle(FakeStories()).activate_skill_for_run(_ctx(), "storyteller") or ("", "")

    listed = re.findall(r"^### (\w+) ", body, re.MULTILINE)
    assert listed == ["stories_list", "stories_create", "stories_add_version", "stories_link"]
    assert '"organization"' not in body
    assert '"sourceThreadId"' not in body, "the conversation is filled in, not asked for"


@pytest.mark.asyncio
async def test_a_story_is_saved_in_the_runs_organization_and_conversation() -> None:
    server = FakeStories()
    bundle = _bundle(server)
    skill = bundle.find_mcp_skill("tenant-a", "storyteller")
    assert skill is not None
    assert bundle.mcp is not None

    await bundle.mcp.call(
        skill,
        _ctx(),
        "stories_create",
        {"title": "T", "kind": "markdown", "sourceThreadId": "other"},
    )
    await bundle.mcp.call(skill, _ctx(), "stories_link", {"storyId": "s1", "sourceThreadId": "x"})

    assert server.calls == [
        (
            "stories_create",
            {"title": "T", "kind": "markdown", "sourceThreadId": THREAD, "organization": "acme"},
        ),
        ("stories_link", {"storyId": "s1", "organization": "acme"}),
    ]


@pytest.mark.asyncio
async def test_a_conversation_id_that_is_not_a_thread_is_left_out() -> None:
    server = FakeStories()
    bundle = _bundle(server)
    skill = bundle.find_mcp_skill("tenant-a", "storyteller")
    assert skill is not None
    assert bundle.mcp is not None

    await bundle.mcp.call(skill, _ctx("eval-123"), "stories_create", {"title": "T"})

    assert server.calls == [("stories_create", {"title": "T", "organization": "acme"})]


def test_the_deck_slides_the_skill_teaches_are_the_ones_the_app_renders() -> None:
    if not _DECK_TYPES.exists():
        pytest.skip("monorepo checkout not available")
    app_types = set(re.findall(r'type: "(\w+)"', _DECK_TYPES.read_text()))
    body = (_SKILLS_DIR / "storyteller" / "SKILL.md").read_text()
    taught = set(re.findall(r'\{"type": "(\w+)"', body))
    assert app_types == {"title", "bullets", "table"}
    assert taught == app_types
