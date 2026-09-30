"""Files attached to a chat message reach the model; memory keeps a marker."""

from __future__ import annotations

import base64
from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import ValidationError

from miot_harness.runtime.agent_loop import (
    _compose_human,
    _lead_with_reminders,
    _plain_messages,
    _with_tail_marker,
)
from miot_harness.runtime.attachments import MAX_ATTACHMENT_BYTES, Attachment, content_block
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.conversation import InMemoryConversationStore
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.registry import ToolRegistry
from tests.runtime.test_agent_loop import ScriptedModel, _runner

PNG = base64.b64encode(b"\x89PNG fake").decode()
PDF = base64.b64encode(b"%PDF-1.4 fake").decode()
CSV = base64.b64encode(b"plate,km\nAB12,300\n").decode()


def _image() -> Attachment:
    return Attachment(mime="image/png", name="chart.png", data=PNG)


def _pdf() -> Attachment:
    return Attachment(mime="application/pdf", name="report.pdf", data=PDF)


def _text() -> Attachment:
    return Attachment(mime="text/csv", name="trips.csv", data=CSV)


def _anthropic_payload(messages: list[Any]) -> list[dict[str, Any]]:
    from langchain_anthropic import ChatAnthropic

    model = ChatAnthropic(model_name="claude-sonnet-4-6", api_key="test-key")  # type: ignore[call-arg]
    return model._get_request_payload(messages)["messages"]


def _openai_payload(messages: list[Any]) -> list[dict[str, Any]]:
    from langchain_openai import ChatOpenAI

    model = ChatOpenAI(model="gpt-4o", api_key="test-key")  # type: ignore[arg-type]
    return model._get_request_payload(messages)["messages"]


def test_unsupported_type_is_rejected() -> None:
    with pytest.raises(ValidationError, match="unsupported attachment type"):
        Attachment(mime="application/zip", name="x.zip", data=PNG)


def test_json_is_read_as_text() -> None:
    data = base64.b64encode(b'{"a": 1}').decode()
    block = content_block(Attachment(mime="application/json", name="a.json", data=data))
    assert block["type"] == "text"
    assert '{"a": 1}' in block["text"]


def test_invalid_base64_is_rejected() -> None:
    with pytest.raises(ValidationError, match="not valid base64"):
        Attachment(mime="image/png", name="x.png", data="not base64!")


def test_a_file_over_the_size_cap_is_rejected() -> None:
    data = base64.b64encode(b"x" * (MAX_ATTACHMENT_BYTES + 1)).decode()
    with pytest.raises(ValidationError):
        Attachment(mime="image/png", name="big.png", data=data)


def test_more_than_five_attachments_are_rejected() -> None:
    six = [_image()] * 6
    with pytest.raises(ValidationError):
        UserRequest(message="q", tenant_id="acme", attachments=six)


def test_mime_parameters_are_dropped() -> None:
    assert Attachment(mime="text/plain; charset=utf-8", data=CSV).mime == "text/plain"


def test_attachment_bytes_stay_out_of_repr_and_dumps() -> None:
    request = UserRequest(message="q", tenant_id="acme", attachments=[_image()])
    ctx = request.to_context()
    assert PNG not in repr(request)
    assert PNG not in repr(ctx)
    assert "attachments" not in ctx.model_dump()


def test_compose_without_attachments_stays_a_string() -> None:
    assert _compose_human("q").content == "q"


def test_compose_puts_files_first_and_the_text_last() -> None:
    composed = _compose_human("what is this?", [_image(), _pdf(), _text()])
    [msg] = _lead_with_reminders([composed], ["be brief"], cache=False)
    kinds = [b["type"] for b in msg.content]
    assert kinds == ["text", "image", "file", "text", "text"]
    assert "<system-reminder>" in msg.content[0]["text"]
    assert "plate,km" in msg.content[3]["text"]
    assert 'name="trips.csv"' in msg.content[3]["text"]
    assert msg.content[-1]["text"] == "what is this?"


def test_anthropic_gets_image_and_document_blocks_with_the_cache_marker_on_text() -> None:
    msg = _compose_human("q", [_image(), _pdf()])
    [user] = _anthropic_payload(_with_tail_marker([msg]))
    image, document, text = user["content"]
    assert image["type"] == "image"
    assert image["source"] == {"type": "base64", "media_type": "image/png", "data": PNG}
    assert document["type"] == "document"
    assert document["source"]["media_type"] == "application/pdf"
    assert text["type"] == "text"
    assert "cache_control" in text


def test_openai_gets_image_url_and_file_parts() -> None:
    msg = _compose_human("q", [_image(), _pdf()])
    [user] = _openai_payload(_plain_messages([msg]))
    image, file, text = user["content"]
    assert image == {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{PNG}"}}
    assert file["type"] == "file"
    assert file["file"]["file_data"] == f"data:application/pdf;base64,{PDF}"
    assert file["file"]["filename"] == "report.pdf"
    assert text == {"type": "text", "text": "q"}


def test_plain_messages_keep_media_but_still_flatten_text_only_lists() -> None:
    media = _with_tail_marker([_compose_human("q", [_image()])])[0]
    text_only = AIMessage(content=[{"type": "text", "text": "a"}, {"type": "thinking"}])
    plain_media, plain_text = _plain_messages([media, text_only])
    assert [b["type"] for b in plain_media.content] == ["image", "text"]
    assert not any("cache_control" in b for b in plain_media.content)
    assert plain_text.content == "a"


@pytest.mark.asyncio
async def test_the_loop_sends_the_files_and_stores_only_markers() -> None:
    model = ScriptedModel([AIMessage(content="a truck")])
    ctx = UserRequest(
        message="what is this?", tenant_id="acme", attachments=[_image(), _pdf()]
    ).to_context()
    delta = await _runner(model).run(
        user_message="what is this?", ctx=ctx, prior_messages=[], progress=lambda e: None
    )
    sent = model.calls[0][-1]
    assert isinstance(sent, HumanMessage)
    assert [b["type"] for b in sent.content] == ["image", "file", "text"]
    stored = delta["messages"][0]
    assert stored.content == "[image: chart.png]\n[pdf: report.pdf]\nwhat is this?"


class _Loop:
    def __init__(self) -> None:
        self.attachments: list[list[Attachment]] = []

    async def run(self, *, user_message, ctx, prior_messages, progress) -> dict[str, Any]:
        self.attachments.append(list(ctx.attachments))
        return {"answer": "ok", "messages": [AIMessage(content="ok")]}


@pytest.mark.asyncio
async def test_conversation_memory_keeps_a_marker_not_the_bytes(tmp_path: Any) -> None:
    store = InMemoryConversationStore()
    loop = _Loop()
    supervisor = HarnessSupervisor(
        tools=ToolRegistry(),
        run_store=JsonRunStore(tmp_path),
        agent_loop=loop,
        conversation_store=store,
        tenant_lock="orion",
    )
    await supervisor.run(
        UserRequest(
            message="read this", tenant_id="orion", conversation_id="c1", attachments=[_text()]
        )
    )
    assert [a.name for a in loop.attachments[0]] == ["trips.csv"]
    history = store.get("orion/demo-user/c1")
    assert history is not None
    assert history.turns[0].user_message == "[file: trips.csv]\nread this"
    assert CSV not in "".join(str(p.read_text()) for p in tmp_path.rglob("*") if p.is_file())


def test_a_message_that_is_only_files_has_no_empty_text_block() -> None:
    msg = _compose_human("", [_image()])
    assert [b["type"] for b in msg.content] == ["image"]
    [user] = _anthropic_payload(_with_tail_marker([msg]))
    assert [b["type"] for b in user["content"]] == ["image"]
