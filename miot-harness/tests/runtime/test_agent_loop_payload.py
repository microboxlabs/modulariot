import json

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from miot_harness.agents.native_tools import build_native_tools
from miot_harness.runtime.agent_loop import (
    _compose_human,
    _split_prior,
    _with_tail_marker,
)
from miot_harness.runtime.agent_prompt import (
    build_agent_system_prompt,
    cached_system_message,
)
from tests.fixtures.fake_provider import FAKE_PROFILE


def _payload(messages, tools):
    from langchain_anthropic import ChatAnthropic

    model = ChatAnthropic(model_name="claude-sonnet-4-6", api_key="test-key")
    bound = model.bind_tools(tools)
    # _get_request_payload builds the wire dict without any network call.
    return bound.bound._get_request_payload(messages, **bound.kwargs)


def _count_markers(payload) -> int:
    return json.dumps(payload).count('"cache_control"')


def test_split_prior_extracts_system_messages():
    prior = [
        SystemMessage(content="# Active skill: x\nbody"),
        HumanMessage(content="q1"),
        AIMessage(content="a1"),
    ]
    history, reminders = _split_prior(prior)
    assert [type(m) for m in history] == [HumanMessage, AIMessage]
    assert reminders == ["# Active skill: x\nbody"]


def test_compose_human_wraps_reminders():
    msg = _compose_human("the question", ["do X"])
    text = json.dumps(msg.content)
    assert "<system-reminder>" in text
    assert "the question" in text


def test_request_has_exactly_two_breakpoints_and_stable_prefix():
    from tests.test_native_tools import _registry

    tools = build_native_tools(_registry(), profile=FAKE_PROFILE)
    system = cached_system_message(build_agent_system_prompt(FAKE_PROFILE))
    messages = [system, _compose_human("q", [])]
    payload = _payload(_with_tail_marker(messages), tools)

    assert _count_markers(payload) == 2  # system block + tail marker, never more
    # Prefix layout: tools first, then system with the ephemeral marker.
    assert [t["name"] for t in payload["tools"]] == sorted(
        t["name"] for t in payload["tools"]
    )
    assert payload["system"][-1]["cache_control"] == {"type": "ephemeral"}


def test_tail_marker_lands_on_valid_top_level_block():
    from tests.test_native_tools import _registry

    tools = build_native_tools(_registry(), profile=FAKE_PROFILE)
    system = cached_system_message(build_agent_system_prompt(FAKE_PROFILE))
    messages = [
        system,
        _compose_human("q", []),
        AIMessage(
            content="",
            tool_calls=[{"name": "fake_kpi_summary", "args": {}, "id": "c1", "type": "tool_call"}],
        ),
        ToolMessage(content='{"rows": []}', tool_call_id="c1"),
    ]
    payload = _payload(_with_tail_marker(messages), tools)
    assert _count_markers(payload) == 2
    last_block = payload["messages"][-1]["content"][-1]
    # The marker must sit ON a top-level content block (tool_result / text),
    # never nested inside tool_result.content (the API rejects that).
    assert last_block.get("cache_control") == {"type": "ephemeral"}


def test_stored_history_stays_unmarked():
    messages = [cached_system_message("s"), _compose_human("q", [])]
    _with_tail_marker(messages)
    assert "cache_control" not in json.dumps(messages[-1].content)


def test_stored_history_stays_unmarked_list_content():
    tail = HumanMessage(content=[{"type": "text", "text": "q"}])
    messages = [cached_system_message("s"), tail]
    marked = _with_tail_marker(messages)
    # the returned copy carries the marker...
    assert "cache_control" in json.dumps(marked[-1].content)
    # ...but the caller's stored message object must stay untouched
    assert "cache_control" not in json.dumps(tail.content)
