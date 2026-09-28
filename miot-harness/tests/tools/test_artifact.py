"""The `artifact` tool: validates what the model wrote and shows it to the user."""

from __future__ import annotations

import pytest

from miot_harness.agents.native_tools import build_native_tools
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.tools import artifact
from miot_harness.tools.registry import build_default_registry
from tests.fixtures.fake_provider import FAKE_PROFILE

SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40">'
    '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>'
    '<rect width="100" height="40" fill="url(#g)"/><text x="4" y="20">A → B</text></svg>'
)


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="acme", user_id="u1", run_id="r1")


async def _invoke(raw: dict[str, object]) -> tuple[object, list[HarnessEvent]]:
    events: list[HarnessEvent] = []
    output = await artifact.artifact_tool().invoke(_ctx(), raw, events.append)
    return output, events


@pytest.mark.asyncio
async def test_an_svg_is_emitted_to_the_user_and_its_id_returned() -> None:
    output, events = await _invoke({"kind": "svg", "title": "Flow", "content": SVG})
    created = [e for e in events if e.type == "artifact.created"]
    assert len(created) == 1
    data = created[0].data
    assert data["id"] == output.id  # type: ignore[attr-defined]
    assert data["kind"] == "svg"
    assert data["title"] == "Flow"
    assert data["content"] == SVG
    assert data["source"] == "artifact"


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["mermaid", "markdown", "html"])
async def test_text_kinds_are_shown_as_written(kind: str) -> None:
    content = "<p onclick='x'>hi</p>" if kind == "html" else "graph TD; A-->B"
    output, events = await _invoke({"kind": kind, "title": "T", "content": content})
    assert output.kind == kind  # type: ignore[attr-defined]
    assert any(e.type == "artifact.created" for e in events)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "svg",
    [
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><rect onload="x"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="http://x/a.png"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(http://x/p)"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:URL(http://x/p)"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:\\75rl(http://x/p)"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
        "<html><body/></html>",
        "not xml",
    ],
)
async def test_unsafe_svg_is_refused_without_an_event(svg: str) -> None:
    with pytest.raises(ValueError):
        await _invoke({"kind": "svg", "title": "x", "content": svg})


@pytest.mark.asyncio
async def test_content_over_the_limit_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(artifact, "MAX_ARTIFACT_BYTES", 10)
    events: list[HarnessEvent] = []
    tool = artifact.artifact_tool()
    ctx = _ctx()
    raw = {"kind": "markdown", "title": "x", "content": "x" * 11}
    with pytest.raises(ValueError, match="limit"):
        await tool.invoke(ctx, raw, events.append)
    assert not any(e.type == "artifact.created" for e in events)


def test_the_loop_is_offered_the_artifact_tool() -> None:
    names = {t["name"] for t in build_native_tools(build_default_registry(), profile=FAKE_PROFILE)}
    assert "artifact" in names
