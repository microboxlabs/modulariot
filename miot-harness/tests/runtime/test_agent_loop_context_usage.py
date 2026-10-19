"""The loop reports how full the model's context window is after each turn."""

from typing import Any

import pytest
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage

from miot_harness.agents.context_windows import context_window
from miot_harness.config import HarnessSettings
from miot_harness.runtime.agent_loop import AgentLoopRunner
from miot_harness.runtime.events import HarnessEvent
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.runtime.test_agent_loop import ScriptedModel, _ctx
from tests.test_native_tools import _registry


class MeteredModel(ScriptedModel):
    """Streams each scripted reply with the usage the provider would report."""

    def __init__(self, responses: list[AIMessage], usage: list[dict[str, int]]) -> None:
        super().__init__(responses)
        self.usage = list(usage)

    async def astream(self, messages: Any, **kwargs: Any) -> Any:
        msg = await self.ainvoke(messages)
        tokens = self.usage.pop(0)
        yield AIMessageChunk(
            content=msg.content,
            tool_call_chunks=[
                {
                    "name": c["name"],
                    "args": "{}",
                    "id": c["id"],
                    "index": i,
                    "type": "tool_call_chunk",
                }
                for i, c in enumerate(msg.tool_calls)
            ],
            usage_metadata={
                "input_tokens": tokens["input"],
                "output_tokens": tokens["output"],
                "total_tokens": tokens["input"] + tokens["output"],
            },
        )


def _runner(model: ScriptedModel, **settings: Any) -> AgentLoopRunner:
    return AgentLoopRunner(
        model=model,
        registry=_registry(),
        settings=HarnessSettings(agents_agent_loop_max_turns=3, **settings),
        profile=FAKE_PROFILE,
        provenance_log=None,
        model_name="deepseek:deepseek-chat",
    )


@pytest.mark.asyncio
async def test_each_turn_reports_the_provider_count_against_the_window() -> None:
    model = MeteredModel(
        [
            AIMessage(
                content="",
                tool_calls=[{"name": "fake_kpi_summary", "args": {}, "id": "t1"}],
            ),
            AIMessage(content="41 trips"),
        ],
        usage=[{"input": 9_000, "output": 200}, {"input": 12_000, "output": 300}],
    )
    events: list[HarnessEvent] = []
    result = await _runner(model, agents_context_windows={"deepseek:deepseek-chat": 100_000}).run(
        user_message="trips today?",
        ctx=_ctx(),
        prior_messages=[HumanMessage(content="earlier"), AIMessage(content="ok")],
        progress=events.append,
    )

    usage = [e.data for e in events if e.type == "context.usage"]
    assert [u["turn"] for u in usage] == [0, 1]
    assert usage[0]["used"] == 9_200
    context = result["context"]
    assert context["model"] == "deepseek:deepseek-chat"
    assert context["window"] == 100_000
    assert context["used"] == 12_300
    assert context["ratio"] == 0.123
    breakdown = context["breakdown"]
    assert set(breakdown) == {"system", "tools", "history", "message", "run"}
    assert breakdown["history"] > 0
    assert sum(breakdown.values()) == 12_300


@pytest.mark.asyncio
async def test_without_a_provider_count_the_usage_is_estimated() -> None:
    model = ScriptedModel([AIMessage(content="hello")])
    result = await _runner(model).run(
        user_message="hi", ctx=_ctx(), prior_messages=[], progress=lambda _e: None
    )
    context = result["context"]
    assert context["window"] == 128_000
    assert context["used"] > 0
    assert context["breakdown"]["history"] == 0


@pytest.mark.asyncio
async def test_a_low_provider_count_scales_the_estimates_down() -> None:
    model = MeteredModel([AIMessage(content="hi")], usage=[{"input": 90, "output": 10}])
    result = await _runner(model).run(
        user_message="hello", ctx=_ctx(), prior_messages=[], progress=lambda _e: None
    )
    context = result["context"]
    assert context["used"] == 100
    assert context["breakdown"]["run"] == 10
    assert sum(context["breakdown"].values()) == 100


@pytest.mark.asyncio
async def test_run_is_only_what_the_run_added_when_the_estimates_fall_short() -> None:
    """The first request's count fixes the size of what was there before the
    run; the four-characters-a-token estimates are only split by it."""

    model = MeteredModel(
        [
            AIMessage(
                content="",
                tool_calls=[{"name": "fake_kpi_summary", "args": {}, "id": "t1"}],
            ),
            AIMessage(content="41 trips"),
        ],
        usage=[{"input": 50_000, "output": 200}, {"input": 51_000, "output": 300}],
    )
    events: list[HarnessEvent] = []
    await _runner(model).run(
        user_message="trips today?",
        ctx=_ctx(),
        prior_messages=[HumanMessage(content="earlier"), AIMessage(content="ok")],
        progress=events.append,
    )
    first, second = [e.data["breakdown"] for e in events if e.type == "context.usage"]
    assert first["run"] == 200
    assert sum(first.values()) - first["run"] == 50_000
    assert second["run"] == 51_300 - 50_000
    assert {k: v for k, v in first.items() if k != "run"} == {
        k: v for k, v in second.items() if k != "run"
    }


def test_a_non_positive_context_window_is_refused() -> None:
    with pytest.raises(ValueError):
        HarnessSettings(agents_context_windows={"deepseek:deepseek-chat": 0})


def test_claude_models_default_to_200k_and_overrides_win() -> None:
    assert context_window("claude-sonnet-4-6", overrides={}, default=1) == 200_000
    assert context_window("qwen:qwen-max", overrides={}, default=64_000) == 64_000
    assert (
        context_window("claude-sonnet-4-6", overrides={"claude-sonnet-4-6": 1_000_000}, default=1)
        == 1_000_000
    )
