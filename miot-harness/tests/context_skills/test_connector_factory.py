from __future__ import annotations

import httpx
import pytest

from miot_harness.context_skills.connector_factory import build_http_tool
from miot_harness.context_skills.skill_models import HttpConnectorSkill
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionDecision


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


def _client(handler: object) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_readonly_get_executes_and_binds_placeholder(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"ok": True})

    skill = HttpConnectorSkill(
        kind="http",
        id="s",
        tool_name="ping",
        method="GET",
        url="https://api.example/items/{item_id}",
        read_only=True,
        input_schema={
            "type": "object",
            "properties": {"item_id": {"type": "string"}},
            "required": ["item_id"],
        },
        headers={"Authorization": "${PING_TOKEN}"},
    )
    tool = build_http_tool(
        skill, name="skill_ping", source_label="skill:s", http_client=_client(handler)
    )

    # read-only → no approval gate
    perm = await tool.check_permission(_ctx(), tool.input_model(item_id="x"))
    assert perm.decision == PermissionDecision.ALLOW

    monkeypatch.setenv("PING_TOKEN", "secret-123")
    events: list[HarnessEvent] = []
    output = await tool.invoke(_ctx(), {"item_id": "42"}, events.append)

    assert captured["url"] == "https://api.example/items/42"
    assert captured["auth"] == "secret-123"
    assert output.status_code == 200
    assert output.body == {"ok": True}
    assert any(e.type == "tool.completed" for e in events)


@pytest.mark.asyncio
async def test_mutating_connector_requires_approval() -> None:
    skill = HttpConnectorSkill(
        kind="http", id="s", tool_name="push", method="POST",
        url="https://api.example/push", read_only=False,
    )
    tool = build_http_tool(skill, name="skill_push", source_label="skill:s")
    perm = await tool.check_permission(_ctx(), tool.input_model())
    assert perm.decision == PermissionDecision.ASK


def test_sensitive_literal_header_rejected() -> None:
    skill = HttpConnectorSkill(
        kind="http", id="s", tool_name="x", url="https://api.example/x",
        headers={"Authorization": "Bearer hunter2"},
    )
    with pytest.raises(ValueError, match="sensitive"):
        build_http_tool(skill, name="skill_x", source_label="skill:s")


def test_non_absolute_url_rejected() -> None:
    skill = HttpConnectorSkill(
        kind="http", id="s", tool_name="x", url="/relative/path"
    )
    with pytest.raises(ValueError, match="absolute"):
        build_http_tool(skill, name="skill_x", source_label="skill:s")


def test_non_http_scheme_rejected() -> None:
    skill = HttpConnectorSkill(
        kind="http", id="s", tool_name="x", url="file://etc/passwd"
    )
    with pytest.raises(ValueError, match="http or https"):
        build_http_tool(skill, name="skill_x", source_label="skill:s")


def test_sensitive_header_mixed_content_rejected() -> None:
    # A literal prefix next to a ${VAR} ref must not slip a plaintext
    # secret through; the whole value has to be a single ${VAR} reference.
    skill = HttpConnectorSkill(
        kind="http", id="s", tool_name="x", url="https://api.example/x",
        headers={"Authorization": "leaked-secret ${TOKEN}"},
    )
    with pytest.raises(ValueError, match="sensitive"):
        build_http_tool(skill, name="skill_x", source_label="skill:s")


@pytest.mark.asyncio
async def test_ssrf_guard_blocks_host_placeholder() -> None:
    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        return httpx.Response(200, json={})

    skill = HttpConnectorSkill(
        kind="http", id="s", tool_name="x", url="https://{host}/x",
        input_schema={
            "type": "object",
            "properties": {"host": {"type": "string"}},
            "required": ["host"],
        },
    )
    tool = build_http_tool(
        skill, name="skill_x", source_label="skill:s", http_client=_client(handler)
    )
    with pytest.raises(RuntimeError, match="SSRF"):
        await tool.invoke(_ctx(), {"host": "evil.example"}, lambda e: None)
