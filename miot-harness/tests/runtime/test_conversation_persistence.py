"""Conversation memory survives a restart: saved after each run, loaded back."""

from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx
import pytest
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage

from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.conversation import (
    ConversationHistory,
    ConversationTurn,
    InMemoryConversationStore,
)
from miot_harness.runtime.conversation_backend import (
    ModulithConversationBackend,
    doc_to_history,
    history_to_doc,
)
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.registry import ToolRegistry

_KEY = "orion/demo-user/conv"


def _tool_turn() -> tuple[BaseMessage, ...]:
    return (
        HumanMessage(content="trips today?"),
        AIMessage(
            content="",
            tool_calls=[{"name": "acs_query", "args": {"sql": "select count(*)"}, "id": "t1"}],
        ),
        ToolMessage(content='{"rows_returned": 1, "output": [{"count": 41}]}', tool_call_id="t1"),
        AIMessage(content="41 trips"),
    )


def test_a_history_round_trips_through_its_document() -> None:
    history = ConversationHistory(
        conversation_id=_KEY,
        turns=[ConversationTurn("trips today?", "41 trips", _tool_turn())],
        summary="the user counts trips",
    )
    doc = json.loads(json.dumps(history_to_doc(history)))

    back = doc_to_history(_KEY, doc)

    assert back.summary == "the user counts trips"
    assert back.turns[0].assistant_answer == "41 trips"
    messages = back.turns[0].messages
    assert isinstance(messages[1], AIMessage)
    assert messages[1].tool_calls[0]["args"] == {"sql": "select count(*)"}
    assert isinstance(messages[2], ToolMessage) and messages[2].tool_call_id == "t1"


class _Backend:
    def __init__(self) -> None:
        self.docs: dict[str, dict[str, Any]] = {}
        self.meta: dict[str, dict[str, Any]] = {}
        self.fail_load = False

    async def load(self, key: str) -> dict[str, Any] | None:
        if self.fail_load:
            raise RuntimeError("modulith down")
        return self.docs.get(key)

    async def save(self, key: str, doc: dict[str, Any], *, meta: dict[str, Any]) -> None:
        self.docs[key] = json.loads(json.dumps(doc))
        self.meta[key] = meta


class _Loop:
    """Answers with one tool round trip and records the prior messages."""

    default_model = "llmgateway:deepseek-v4-flash"

    def __init__(self) -> None:
        self.priors: list[list[BaseMessage]] = []

    async def run(self, *, user_message, ctx, prior_messages, progress) -> dict[str, Any]:
        self.priors.append(list(prior_messages))
        return {"answer": "41 trips", "messages": list(_tool_turn())}


def _supervisor(tmp_path: Any, backend: _Backend) -> tuple[HarnessSupervisor, _Loop]:
    loop = _Loop()
    supervisor = HarnessSupervisor(
        tools=ToolRegistry(),
        run_store=JsonRunStore(tmp_path),
        agent_loop=loop,
        conversation_store=InMemoryConversationStore(),
        tenant_lock="orion",
    )
    supervisor.conversation_backend = backend
    return supervisor, loop


def _request(message: str) -> UserRequest:
    return UserRequest(message=message, tenant_id="orion", conversation_id="conv")


@pytest.mark.asyncio
async def test_a_restarted_harness_picks_up_the_tool_history(tmp_path: Any) -> None:
    backend = _Backend()
    first, _ = _supervisor(tmp_path, backend)
    await first.run(_request("trips today?"))
    await first.drain_saves()

    assert backend.meta[_KEY] == {
        "tenantId": "orion",
        "userId": "demo-user",
        "conversationId": "conv",
        "model": "llmgateway:deepseek-v4-flash",
    }

    restarted, loop = _supervisor(tmp_path, backend)
    await restarted.run(_request("what SQL did you run?"))

    prior = loop.priors[0]
    calls = [m for m in prior if isinstance(m, AIMessage) and m.tool_calls]
    assert calls and calls[0].tool_calls[0]["args"] == {"sql": "select count(*)"}
    assert any(isinstance(m, ToolMessage) for m in prior)


@pytest.mark.asyncio
async def test_a_failed_load_falls_back_to_the_replay(tmp_path: Any) -> None:
    backend = _Backend()
    backend.fail_load = True
    supervisor, _ = _supervisor(tmp_path, backend)
    record = await supervisor.run(_request("hello"))
    assert record.status == "completed"


@pytest.mark.asyncio
async def test_saves_for_one_conversation_land_in_order(tmp_path: Any) -> None:
    order: list[int] = []

    class _SlowFirst(_Backend):
        async def save(self, key: str, doc: dict[str, Any], *, meta: dict[str, Any]) -> None:
            turns = len(doc["turns"])
            if turns == 1:
                await asyncio.sleep(0.05)
            order.append(turns)
            await super().save(key, doc, meta=meta)

    backend = _SlowFirst()
    supervisor, _ = _supervisor(tmp_path, backend)
    await supervisor.run(_request("one"))
    await supervisor.run(_request("two"))
    await supervisor.drain_saves()

    assert order == [1, 2]
    assert len(backend.docs[_KEY]["turns"]) == 2


@pytest.mark.asyncio
async def test_the_modulith_backend_speaks_the_internal_endpoint() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.method == "GET":
            if request.url.params["key"] == "missing":
                return httpx.Response(404, json={"error": "no memory"})
            return httpx.Response(200, json={"key": "k", "memory": {"summary": "s", "turns": []}})
        return httpx.Response(200, json={"stored": True})

    backend = ModulithConversationBackend(
        "http://modulith:8080/", "secret", transport=httpx.MockTransport(handler)
    )
    assert await backend.load("missing") is None
    assert await backend.load("k") == {"summary": "s", "turns": []}
    await backend.save("k", {"turns": []}, meta={"tenantId": "orion", "conversationId": "c"})

    put = seen[-1]
    assert str(put.url) == "http://modulith:8080/internal/harness-conversations"
    assert put.headers["x-miot-harness-key"] == "secret"
    assert json.loads(put.content) == {
        "key": "k",
        "memory": {"turns": []},
        "tenantId": "orion",
        "conversationId": "c",
    }
