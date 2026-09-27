"""`/compact` and `/context`: answered by the harness, never stored as turns."""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from langchain_core.messages import AIMessage

from miot_harness.config import HarnessSettings
from miot_harness.runtime.agent_loop import AgentLoopRunners
from miot_harness.runtime.commands import parse_command
from miot_harness.runtime.context import ConversationTurnInput, UserRequest
from miot_harness.runtime.conversation import InMemoryConversationStore
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.runtime.test_agent_loop import ScriptedModel
from tests.test_native_tools import _registry

_KEY = "orion/demo-user/conv"


def test_only_known_commands_at_the_start_are_commands() -> None:
    assert parse_command("/compact") is not None
    compact = parse_command("  /compact keep the trip counts ")
    assert compact is not None and compact.argument == "keep the trip counts"
    context = parse_command("/context")
    assert context is not None and context.name == "context"
    assert parse_command("/compacted") is None
    assert parse_command("please /compact") is None
    assert parse_command("/pending-deliveries today") is None
    tab = parse_command("/compact\tkeep the counts")
    assert tab is not None and tab.argument == "keep the counts"
    newline = parse_command("/compact\nkeep\nthe counts")
    assert newline is not None and newline.argument == "keep\nthe counts"


@pytest.mark.asyncio
async def test_a_cancelled_compact_is_recorded_as_failed(tmp_path: Any) -> None:
    store = InMemoryConversationStore()
    supervisor = _supervisor(tmp_path, store)
    started = asyncio.Event()

    async def summarizer(history: Any) -> str:
        started.set()
        await asyncio.Event().wait()
        return "never"

    supervisor.conversation_summarizer = summarizer
    await supervisor.run(_request("q1"))
    task = asyncio.create_task(supervisor.run(_request("/compact"), run_id_override="run_cancel"))
    await started.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    record = supervisor.run_store.load("run_cancel")
    assert record.status == "failed"
    assert record.events[-1].type == "run.failed"
    history = store.get(_KEY)
    assert history is not None and len(history.turns) == 1


def _loop() -> AgentLoopRunners:
    return AgentLoopRunners(
        default_model="claude-sonnet-4-6",
        models=[],
        build_model=lambda _name: ScriptedModel([AIMessage(content=f"a{n}") for n in range(5)]),
        registry=_registry(),
        settings=HarnessSettings(),
        profile=FAKE_PROFILE,
    )


def _supervisor(tmp_path: Any, store: InMemoryConversationStore) -> HarnessSupervisor:
    return HarnessSupervisor(
        tools=ToolRegistry(),
        run_store=JsonRunStore(tmp_path),
        agent_loop=_loop(),
        conversation_store=store,
        tenant_lock="orion",
    )


def _request(message: str, **kwargs: Any) -> UserRequest:
    return UserRequest(message=message, tenant_id="orion", conversation_id="conv", **kwargs)


@pytest.mark.asyncio
async def test_compact_folds_every_turn_and_returns_the_summary(tmp_path: Any) -> None:
    store = InMemoryConversationStore()
    supervisor = _supervisor(tmp_path, store)
    focuses: list[str | None] = []

    async def summarizer(history: Any, *, focus: str | None = None) -> str:
        focuses.append(focus)
        return "user asked " + ",".join(t.user_message for t in history.turns)

    supervisor.conversation_summarizer = summarizer
    for q in ("q1", "q2"):
        await supervisor.run(_request(q))

    record = await supervisor.run(_request("/compact keep the counts"))

    assert record.status == "completed"
    assert record.answer is not None
    assert record.answer.startswith("Compacted 2 turns into a summary")
    assert "> user asked q1,q2" in record.answer
    assert record.conversation_summary == "user asked q1,q2"
    assert focuses == ["keep the counts"]
    history = store.get(_KEY)
    assert history is not None and history.turns == []


@pytest.mark.asyncio
async def test_compact_with_nothing_to_fold_says_so(tmp_path: Any) -> None:
    supervisor = _supervisor(tmp_path, InMemoryConversationStore())

    async def summarizer(history: Any) -> str:
        raise AssertionError("must not be called")

    supervisor.conversation_summarizer = summarizer
    record = await supervisor.run(_request("/compact"))
    assert record.answer == "Nothing to compact yet."


@pytest.mark.asyncio
async def test_a_failed_compaction_keeps_the_history(tmp_path: Any) -> None:
    store = InMemoryConversationStore()
    supervisor = _supervisor(tmp_path, store)

    async def summarizer(history: Any) -> str:
        raise RuntimeError("model down")

    supervisor.conversation_summarizer = summarizer
    await supervisor.run(_request("q1"))
    record = await supervisor.run(_request("/compact"))
    assert record.answer == "Compaction failed and the history is unchanged. Try again."
    history = store.get(_KEY)
    assert history is not None and len(history.turns) == 1


@pytest.mark.asyncio
async def test_context_reports_the_window_and_is_not_stored(tmp_path: Any) -> None:
    store = InMemoryConversationStore()
    supervisor = _supervisor(tmp_path, store)
    await supervisor.run(_request("q1"))

    record = await supervisor.run(_request("/context"))

    assert record.answer is not None
    assert "**claude-sonnet-4-6**" in record.answer
    assert "| History (1 turns) |" in record.answer
    report = record.artifacts[-1]
    assert report["type"] == "context"
    assert report["window"] == 200_000
    assert report["history"] > 0
    assert report["used"] == sum(report[k] for k in ("system", "tools", "summary", "history"))
    history = store.get(_KEY)
    assert history is not None
    assert [t.user_message for t in history.turns] == ["q1"]


@pytest.mark.asyncio
async def test_command_turns_in_a_replay_are_not_seeded(tmp_path: Any) -> None:
    store = InMemoryConversationStore()
    supervisor = _supervisor(tmp_path, store)
    await supervisor.run(
        _request(
            "q3",
            conversation_history=[
                ConversationTurnInput(user_message="q1", assistant_answer="a"),
                ConversationTurnInput(user_message="/context", assistant_answer="table"),
            ],
        )
    )
    history = store.get(_KEY)
    assert history is not None
    assert [t.user_message for t in history.turns] == ["q1", "q3"]
