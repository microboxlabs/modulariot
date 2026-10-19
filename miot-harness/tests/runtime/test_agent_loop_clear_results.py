"""Past a share of the context window, older tool results are cut to stubs."""

import json
from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from miot_harness.config import HarnessSettings
from miot_harness.runtime.agent_loop import AgentLoopRunner, clear_old_tool_results
from miot_harness.runtime.events import HarnessEvent
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.runtime.test_agent_loop import _ctx
from tests.runtime.test_agent_loop_context_usage import MeteredModel
from tests.test_native_tools import _registry


def _call(call_id: str, name: str = "acs_query") -> AIMessage:
    return AIMessage(content="", tool_calls=[{"name": name, "args": {}, "id": call_id}])


def _data_result(call_id: str) -> ToolMessage:
    return ToolMessage(
        content=json.dumps(
            {
                "tool": "acs_query",
                "rows_returned": 40,
                "executed_sql": "select * from trips",
                "excerpt": "first 5 of 40 rows",
                "output": [{"id": n} for n in range(5)],
            }
        ),
        tool_call_id=call_id,
    )


def test_old_results_keep_their_header_and_lose_their_rows() -> None:
    messages = [
        HumanMessage(content="q"),
        _call("a"),
        _data_result("a"),
        _call("b"),
        _data_result("b"),
    ]
    out, cleared = clear_old_tool_results(messages, keep=1)

    assert cleared == 1
    stub = json.loads(out[2].content)
    assert stub["executed_sql"] == "select * from trips"
    assert stub["rows_returned"] == 40
    assert "output" not in stub and "excerpt" not in stub
    assert "cleared" in stub
    assert out[4] is messages[4]
    assert json.loads(messages[2].content)["output"]


def test_skill_bodies_errors_and_stubs_are_left_alone() -> None:
    messages = [
        _call("s", name="load_skill"),
        ToolMessage(content="# Skill: trips\n\nsteps", tool_call_id="s"),
        _call("e"),
        ToolMessage(content=json.dumps({"error": "bad sql"}), tool_call_id="e", status="error"),
        _call("t"),
        ToolMessage(content="plain text result", tool_call_id="t"),
        _call("n"),
        _data_result("n"),
    ]
    out, cleared = clear_old_tool_results(messages, keep=1)
    assert cleared == 1
    assert out[1].content.startswith("# Skill: trips")
    assert json.loads(out[3].content) == {"error": "bad sql"}
    assert json.loads(out[5].content)["length"] == len("plain text result")

    again, cleared_again = clear_old_tool_results(out, keep=1)
    assert cleared_again == 0
    assert [m.content for m in again] == [m.content for m in out]


def test_errors_do_not_take_a_kept_slot_and_plain_text_errors_stay() -> None:
    messages = [
        _call("a"),
        _data_result("a"),
        _call("b"),
        _data_result("b"),
        _call("e"),
        ToolMessage(content="connection reset", tool_call_id="e", status="error"),
    ]
    out, cleared = clear_old_tool_results(messages, keep=1)
    assert cleared == 1
    assert "cleared" in out[1].content
    # The newest data result is kept even though an error came after it.
    assert out[3] is messages[3]
    assert out[5].content == "connection reset"


def _runner(model: Any) -> AgentLoopRunner:
    return AgentLoopRunner(
        model=model,
        registry=_registry(),
        settings=HarnessSettings(
            agents_agent_loop_max_turns=4,
            agents_context_windows={"deepseek:deepseek-chat": 10_000},
            agents_agent_loop_clear_at_ratio=0.5,
            agents_agent_loop_clear_keep_results=1,
        ),
        profile=FAKE_PROFILE,
        provenance_log=None,
        model_name="deepseek:deepseek-chat",
    )


def _tool_turn(call_id: str) -> AIMessage:
    return AIMessage(
        content="", tool_calls=[{"name": "fake_kpi_summary", "args": {}, "id": call_id}]
    )


@pytest.mark.asyncio
async def test_the_loop_clears_once_the_window_passes_the_ratio() -> None:
    model = MeteredModel(
        [_tool_turn("t1"), _tool_turn("t2"), _tool_turn("t3"), AIMessage(content="done")],
        usage=[
            {"input": 2_000, "output": 100},
            {"input": 4_000, "output": 100},
            {"input": 6_000, "output": 100},
            {"input": 3_000, "output": 100},
        ],
    )
    events: list[HarnessEvent] = []
    await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )

    cleared = [e.data["cleared_tool_results"] for e in events if e.type == "context.usage"]
    # 2 100 and 4 100 of 10 000 stay under half; 6 100 passes it, so the
    # request after it goes out with the two older results cut.
    assert cleared == [0, 0, 0, 2]
    last_request = model.calls[-1]
    tool_results = [m for m in last_request if isinstance(m, ToolMessage)]
    assert [("cleared" in m.content) for m in tool_results] == [True, True, False]
