import json
from typing import Any

import pytest
from langchain_core.messages import AIMessage, AIMessageChunk, ToolMessage

import miot_harness.runtime.agent_loop as agent_loop_mod
from miot_harness.config import HarnessSettings
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.context_skills.skill_models import LoadedSkill, PlaybookSkill
from miot_harness.runtime.agent_loop import AgentLoopRunner
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.plan import DataEvidence
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.test_native_tools import _registry


class ScriptedModel:
    """Stands in for ChatAnthropic: bind_tools returns self; ainvoke pops
    scripted AIMessages and records the exact message lists it was sent."""

    def __init__(self, responses: list[AIMessage]) -> None:
        self.responses = list(responses)
        self.calls: list[list[Any]] = []
        self.bound_tools: list[dict] | None = None

    def bind_tools(self, tools: Any, **kwargs: Any) -> "ScriptedModel":
        self.bound_tools = list(tools)
        return self

    def with_config(self, **kwargs: Any) -> "ScriptedModel":
        return self

    async def ainvoke(self, messages: Any, **kwargs: Any) -> AIMessage:
        self.calls.append(list(messages))
        return self.responses.pop(0)

    async def astream(self, messages: Any, **kwargs: Any) -> Any:
        """One chunk per scripted message, the way a real model streams a
        turn: text as a chunk, tool calls as tool_call_chunks."""
        msg = await self.ainvoke(messages)
        yield AIMessageChunk(
            content=msg.content,
            tool_call_chunks=[
                {
                    "name": c["name"],
                    "args": json.dumps(c["args"]),
                    "id": c["id"],
                    "index": i,
                    "type": "tool_call_chunk",
                }
                for i, c in enumerate(msg.tool_calls)
            ],
        )


def _evidence(tool: str = "fake_kpi_summary") -> DataEvidence:
    return DataEvidence(
        step_id="s1",
        tool=tool,
        source="FakeSource",
        refreshed_at=None,
        output={"rows": [{"k": 1}]},
        sample_size=1,
    )


def _ctx():
    return UserRequest(message="q", tenant_id="acme", mode="agentic").to_context()


def _settings() -> HarnessSettings:
    return HarnessSettings(agents_agentic_max_turns=3)


def _runner(model: ScriptedModel) -> AgentLoopRunner:
    return AgentLoopRunner(
        model=model,
        registry=_registry(),
        settings=_settings(),
        profile=FAKE_PROFILE,
        provenance_log=None,
    )


_SKILL_BODY = "1. Query the tasks.\n2. Join per-service variables."


_OTHER_CONN_BODY = "Secrets of another connection."


def _skills_bundle() -> ContextSkillsBundle:
    return ContextSkillsBundle(
        playbook_skills=(
            LoadedSkill(
                skill=PlaybookSkill(
                    kind="playbook",
                    id="pending-deliveries",
                    name="Pending Deliveries",
                    when_to_use="Which services are pending delivery.",
                    tools=("fake_kpi_summary",),
                ),
                playbook_body=_SKILL_BODY,
                source_path="/skills/pending-deliveries/SKILL.md",
            ),
            # Bound to a different connection than FAKE_PROFILE ("fake"):
            # never indexed, and must not be loadable by a guessed id.
            LoadedSkill(
                skill=PlaybookSkill(
                    kind="playbook",
                    id="other-conn-skill",
                    name="Other Connection",
                    when_to_use="Never for this profile.",
                    connection="not-fake",
                ),
                playbook_body=_OTHER_CONN_BODY,
                source_path="/skills/other-conn-skill/SKILL.md",
            ),
        )
    )


def _skilled_runner(model: ScriptedModel) -> AgentLoopRunner:
    return AgentLoopRunner(
        model=model,
        registry=_registry(),
        settings=_settings(),
        profile=FAKE_PROFILE,
        provenance_log=None,
        context_skills=_skills_bundle(),
    )


def _text(msg: ToolMessage) -> str:
    """Message text, tolerating the request-time cache-marker block form."""
    if isinstance(msg.content, str):
        return msg.content
    return "".join(b.get("text", "") for b in msg.content if isinstance(b, dict))


def _load_skill_msg(skill_id: str, call_id: str) -> AIMessage:
    return AIMessage(
        content="",
        tool_calls=[
            {
                "name": "load_skill",
                "args": {"skill_id": skill_id},
                "id": call_id,
                "type": "tool_call",
            }
        ],
    )


def _tool_call_msg(name: str = "fake_kpi_summary", call_id: str = "c1") -> AIMessage:
    return AIMessage(
        content="", tool_calls=[{"name": name, "args": {}, "id": call_id, "type": "tool_call"}]
    )


@pytest.mark.asyncio
async def test_direct_answer_no_tools():
    model = ScriptedModel([AIMessage(content="the answer")])
    delta = await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    assert delta["answer"] == "the answer"
    assert delta["evidence"] == []
    # tools bound once, sorted
    assert [t["name"] for t in model.bound_tools] == sorted(t["name"] for t in model.bound_tools)


@pytest.mark.asyncio
async def test_tool_call_produces_evidence_and_tool_message(monkeypatch):
    async def fake_invoke_step(step, **kwargs):
        assert step.tool == "fake_kpi_summary"
        return {"evidence": [_evidence()]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    model = ScriptedModel([_tool_call_msg(), AIMessage(content="done: 1 row")])
    delta = await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    assert delta["answer"] == "done: 1 row"
    assert len(delta["evidence"]) == 1
    # 2nd call saw: system, human, ai(tool_call), tool_result
    second = model.calls[1]
    assert isinstance(second[-1], ToolMessage)
    assert second[-1].tool_call_id == "c1"
    assert "rows" in str(second[-1].content)


@pytest.mark.asyncio
async def test_tool_failure_becomes_error_tool_message(monkeypatch):
    async def fake_invoke_step(step, **kwargs):
        return {"failure": "boom", "error": "boom", "error_type": "RuntimeError"}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    model = ScriptedModel([_tool_call_msg(), AIMessage(content="could not fetch")])
    delta = await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    assert delta["answer"] == "could not fetch"
    tm = model.calls[1][-1]
    assert isinstance(tm, ToolMessage)
    assert tm.status == "error"
    assert "boom" in str(tm.content)


@pytest.mark.asyncio
async def test_parallel_tool_calls_all_executed(monkeypatch):
    seen: list[str] = []

    async def fake_invoke_step(step, **kwargs):
        seen.append(step.tool)
        return {"evidence": [_evidence(step.tool)]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    multi = AIMessage(
        content="",
        tool_calls=[
            {"name": "fake_kpi_summary", "args": {}, "id": "c1", "type": "tool_call"},
            {"name": "fake_alpha_query", "args": {}, "id": "c2", "type": "tool_call"},
        ],
    )
    model = ScriptedModel([multi, AIMessage(content="both done")])
    delta = await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    assert seen == ["fake_kpi_summary", "fake_alpha_query"]
    assert len(delta["evidence"]) == 2
    tool_messages = [m for m in model.calls[1] if isinstance(m, ToolMessage)]
    assert {m.tool_call_id for m in tool_messages} == {"c1", "c2"}


@pytest.mark.asyncio
async def test_turn_cap_forces_final_answer(monkeypatch):
    async def fake_invoke_step(step, **kwargs):
        return {"evidence": [_evidence()]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    # max_turns=3: three tool rounds, then the forced no-more-tools turn.
    model = ScriptedModel(
        [
            _tool_call_msg(call_id="c1"),
            _tool_call_msg(call_id="c2"),
            _tool_call_msg(call_id="c3"),
            AIMessage(content="partial answer from evidence"),
        ]
    )
    delta = await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    assert delta["answer"] == "partial answer from evidence"
    # The forced turn told the model to stop calling tools.
    final_call = model.calls[-1]
    assert "Turn cap reached" in str(final_call[-1].content)


@pytest.mark.asyncio
async def test_tenancy_refusal_short_circuits():
    ctx = UserRequest(message="q", tenant_id="intruder", mode="agentic").to_context()
    model = ScriptedModel([])  # must never be called
    delta = await _runner(model).run(
        user_message="q", ctx=ctx, prior_messages=[], progress=lambda e: None
    )
    assert "acme" in delta["answer"].lower() or "only" in delta["answer"].lower()
    assert model.calls == []


@pytest.mark.asyncio
async def test_load_skill_bound_and_indexed_only_with_bundle():
    plain = ScriptedModel([AIMessage(content="x")])
    _runner(plain)
    assert "load_skill" not in [t["name"] for t in plain.bound_tools]

    skilled = ScriptedModel([AIMessage(content="x")])
    runner = _skilled_runner(skilled)
    names = [t["name"] for t in skilled.bound_tools]
    assert "load_skill" in names
    assert names == sorted(names)  # byte-stability contract kept
    system_text = runner.system_message.content[0]["text"]
    assert "pending-deliveries" in system_text
    assert _SKILL_BODY not in system_text  # index only, body stays lazy


@pytest.mark.asyncio
async def test_load_skill_returns_body_without_evidence():
    model = ScriptedModel([_load_skill_msg("pending-deliveries", "c1"), AIMessage(content="ok")])
    events: list[Any] = []
    delta = await _skilled_runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )
    assert delta["answer"] == "ok"
    assert delta["evidence"] == []  # guidance, not data
    tm = model.calls[1][-1]
    assert isinstance(tm, ToolMessage)
    assert tm.tool_call_id == "c1"
    assert "# Skill: Pending Deliveries" in _text(tm)
    assert _SKILL_BODY in _text(tm)
    tool_events = [e for e in events if e.type.startswith("tool.")]
    assert [e.type for e in tool_events] == ["tool.started", "tool.completed"]
    assert all(e.data["tool"] == "load_skill" for e in tool_events)


@pytest.mark.asyncio
async def test_load_skill_unknown_id_is_error_feedback():
    model = ScriptedModel([_load_skill_msg("nope", "c1"), AIMessage(content="answered anyway")])
    events: list[Any] = []
    delta = await _skilled_runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )
    assert delta["answer"] == "answered anyway"
    tm = model.calls[1][-1]
    assert tm.status == "error"
    assert "Unknown or bodyless skill 'nope'" in _text(tm)
    assert "tool.failed" in [e.type for e in events]


@pytest.mark.asyncio
async def test_load_skill_refuses_skill_bound_to_another_connection():
    # The index never advertised it; a guessed id must not smuggle the body in.
    model = ScriptedModel(
        [_load_skill_msg("other-conn-skill", "c1"), AIMessage(content="moved on")]
    )
    runner = _skilled_runner(model)
    assert "other-conn-skill" not in runner.system_message.content[0]["text"]
    await runner.run(user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None)
    tm = model.calls[1][-1]
    assert tm.status == "error"
    assert _OTHER_CONN_BODY not in _text(tm)
    assert "Unknown or bodyless skill 'other-conn-skill'" in _text(tm)


@pytest.mark.asyncio
async def test_load_skill_duplicate_returns_pointer_not_body():
    model = ScriptedModel(
        [
            _load_skill_msg("pending-deliveries", "c1"),
            _load_skill_msg("pending-deliveries", "c2"),
            AIMessage(content="done"),
        ]
    )
    delta = await _skilled_runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    assert delta["answer"] == "done"
    second = model.calls[2][-1]
    assert isinstance(second, ToolMessage)
    assert "already loaded" in _text(second)
    assert _SKILL_BODY not in _text(second)


@pytest.mark.asyncio
async def test_events_emitted(monkeypatch):
    async def fake_invoke_step(step, **kwargs):
        return {"evidence": [_evidence()]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    events: list[Any] = []
    model = ScriptedModel([_tool_call_msg(), AIMessage(content="ok")])
    await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )
    types = [e.type for e in events]
    assert "agent.started" in types
    assert "agent.completed" in types
    assert "answer.completed" in types


class ChunkedModel(ScriptedModel):
    """Streams each scripted turn as the given chunks, the way the API splits
    thinking, text and tool-call arguments across frames."""

    def __init__(self, turns: list[list[AIMessageChunk]]) -> None:
        super().__init__([])
        self.turns = list(turns)

    async def astream(self, messages: Any, **kwargs: Any) -> Any:
        self.calls.append(list(messages))
        for chunk in self.turns.pop(0):
            yield chunk


def _tc_chunk(index: int, *, name: str | None = None, args: str, call_id: str | None = None):
    return AIMessageChunk(
        content="",
        tool_call_chunks=[
            {"name": name, "args": args, "id": call_id, "index": index, "type": "tool_call_chunk"}
        ],
    )


@pytest.mark.asyncio
async def test_answer_is_streamed_and_narration_becomes_thinking(monkeypatch):
    async def fake_invoke_step(step, **kwargs):
        return {"evidence": [_evidence()]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    events: list[Any] = []
    first = AIMessage(
        content="Looking that up.",
        tool_calls=[{"name": "fake_kpi_summary", "args": {}, "id": "c1", "type": "tool_call"}],
    )
    model = ScriptedModel([first, AIMessage(content="the answer")])
    delta = await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )
    assert delta["answer"] == "the answer"
    answer_deltas = [e.data["delta"] for e in events if e.type == "answer.delta"]
    assert answer_deltas == ["the answer"]
    thinking = [e.data["delta"] for e in events if e.type == "thinking.delta"]
    assert thinking == ["Looking that up."]
    # The transcript carries the aggregated turn with its tool call.
    second_call = model.calls[1]
    assert second_call[-2].tool_calls[0]["name"] == "fake_kpi_summary"


@pytest.mark.asyncio
async def test_tool_result_excerpt_keeps_counts_and_names_the_cut(monkeypatch):
    rows = [{"name": f"fn_{i}", "summary": "x" * 80} for i in range(50)]

    async def fake_invoke_step(step, **kwargs):
        ev = _evidence()
        ev = ev.model_copy(update={"output": {"rows": rows, "total": 58}, "sample_size": 50})
        return {"evidence": [ev]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    model = ScriptedModel([_tool_call_msg(), AIMessage(content="ok")])
    await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    tool_msg = next(m for m in model.calls[1] if isinstance(m, ToolMessage))
    payload = json.loads(_text(tool_msg))
    assert payload["rows_returned"] == 50
    assert payload["output"]["total"] == 58
    assert len(payload["output"]["rows"]) == 5
    assert payload["excerpt"] == "first 5 of 50 rows"


@pytest.mark.asyncio
async def test_multi_chunk_turn_aggregates_thinking_text_and_split_tool_args(monkeypatch):
    seen: list[Any] = []

    async def fake_invoke_step(step, **kwargs):
        seen.append(step)
        return {"evidence": [_evidence()]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    first_turn = [
        AIMessageChunk(content=[{"type": "thinking", "thinking": "Need the ", "index": 0}]),
        AIMessageChunk(content=[{"type": "thinking", "thinking": "summary.", "index": 0}]),
        AIMessageChunk(content=[{"type": "text", "text": "Looking ", "index": 1}]),
        AIMessageChunk(content=[{"type": "text", "text": "it up.", "index": 1}]),
        _tc_chunk(2, name="fake_kpi_summary", args="", call_id="c1"),
        _tc_chunk(2, args='{"per'),
        _tc_chunk(2, args='iod": "week"}'),
    ]
    second_turn = [AIMessageChunk(content="the "), AIMessageChunk(content="answer")]
    model = ChunkedModel([first_turn, second_turn])
    events: list[Any] = []
    delta = await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )
    assert delta["answer"] == "the answer"
    # Split arguments were merged before the tool ran.
    assert seen[0].args == {"period": "week"}
    thinking = [e.data["delta"] for e in events if e.type == "thinking.delta"]
    assert thinking == ["Need the ", "summary.", "Looking it up."]
    completed = [e for e in events if e.type == "thinking.completed"]
    assert len(completed) == 1 and completed[0].data["length"] == len("Need the summary.") + len(
        "Looking it up."
    )
    # Narration was never emitted as answer text; the answer replays its chunks.
    answer_deltas = [e.data["delta"] for e in events if e.type == "answer.delta"]
    assert answer_deltas == ["the ", "answer"]


@pytest.mark.asyncio
async def test_tool_result_never_exceeds_the_cap_and_stays_json(monkeypatch):
    rows = [{"name": f"fn_{i}", "body": "x" * 900} for i in range(50)]

    async def fake_invoke_step(step, **kwargs):
        ev = _evidence()
        ev = ev.model_copy(update={"output": {"rows": rows, "total": 58}, "sample_size": 50})
        return {"evidence": [ev]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    for cap in (6000, 1200, 500, 300, 200):
        model = ScriptedModel([_tool_call_msg(), AIMessage(content="ok")])
        runner = AgentLoopRunner(
            model=model,
            registry=_registry(),
            settings=HarnessSettings(
                agents_agentic_max_turns=3, agents_agent_loop_tool_result_max_chars=cap
            ),
            profile=FAKE_PROFILE,
            provenance_log=None,
        )
        await runner.run(user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None)
        text = _text(next(m for m in model.calls[1] if isinstance(m, ToolMessage)))
        assert len(text) <= cap, cap
        payload = json.loads(text)
        assert payload["rows_returned"] == 50
        assert payload["total"] == 58, cap
        assert "excerpt" in payload
    # A char-cut excerpt travels as a string, so the message parses.
    assert isinstance(payload["output"], (str, type(None)))


@pytest.mark.asyncio
async def test_long_answer_streams_while_generating_and_short_narration_does_not(monkeypatch):
    async def fake_invoke_step(step, **kwargs):
        return {"evidence": [_evidence()]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    long_text = ["word " * 30] * 4  # 600 chars, past the hold
    turns = [
        [
            AIMessageChunk(content="Short note."),
            _tc_chunk(1, name="fake_kpi_summary", args="{}", call_id="c1"),
        ],
        [AIMessageChunk(content=part) for part in long_text],
    ]
    model = ChunkedModel(turns)
    events: list[Any] = []
    await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )
    answer_deltas = [e.data["delta"] for e in events if e.type == "answer.delta"]
    assert answer_deltas == long_text
    # Past the hold, deltas are emitted as they arrive: every answer delta
    # precedes the turn's `agent.completed`.
    order = [e.type for e in events]
    last_answer = len(order) - 1 - order[::-1].index("answer.delta")
    assert last_answer < len(order) - 1 - order[::-1].index("agent.completed")
    assert [e.data["delta"] for e in events if e.type == "thinking.delta"] == ["Short note."]
    completed = [e for e in events if e.type == "thinking.completed"]
    assert len(completed) == 1 and completed[0].data["tokens"] >= 1


@pytest.mark.asyncio
async def test_text_past_the_hold_is_not_replayed_when_a_tool_call_follows(monkeypatch):
    async def fake_invoke_step(step, **kwargs):
        return {"evidence": [_evidence()]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    long_text = ["word " * 30] * 4  # 600 chars, past the hold
    turns = [
        [
            *(AIMessageChunk(content=part) for part in long_text),
            _tc_chunk(1, name="fake_kpi_summary", args="{}", call_id="c1"),
        ],
        [AIMessageChunk(content="done")],
    ]
    model = ChunkedModel(turns)
    events: list[Any] = []
    delta = await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )
    assert delta["answer"] == "done"
    # The streamed text went out once, as answer deltas, and the late tool
    # call did not replay it as thinking.
    answer_deltas = [e.data["delta"] for e in events if e.type == "answer.delta"]
    assert answer_deltas == [*long_text, "done"]
    assert [e for e in events if e.type == "thinking.delta"] == []
    assert [e for e in events if e.type == "thinking.completed"] == []


@pytest.mark.asyncio
async def test_tool_capped_rows_are_reported_as_an_excerpt_with_the_exact_total(monkeypatch):
    # Nexo table tools keep five rows and report `truncated` and `total_count`.
    async def fake_invoke_step(step, **kwargs):
        ev = _evidence()
        ev = ev.model_copy(
            update={
                "output": {
                    "rows": [{"k": i} for i in range(5)],
                    "total_count": 58,
                    "truncated": True,
                },
                "sample_size": 5,
            }
        )
        return {"evidence": [ev]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    model = ScriptedModel([_tool_call_msg(), AIMessage(content="ok")])
    await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    payload = json.loads(_text(next(m for m in model.calls[1] if isinstance(m, ToolMessage))))
    assert payload["rows_returned"] == 5
    assert payload["total"] == 58
    assert payload["excerpt"] == "first 5 of 58 rows"
    assert len(payload["output"]["rows"]) == 5


@pytest.mark.asyncio
async def test_text_sharing_a_frame_with_a_tool_call_chunk_still_streams(monkeypatch):
    async def fake_invoke_step(step, **kwargs):
        return {"evidence": [_evidence()]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    long_text = ["word " * 30] * 4  # 600 chars, past the hold
    mixed = AIMessageChunk(
        content=[{"type": "text", "text": "tail.", "index": 0}],
        tool_call_chunks=[
            {"name": "fake_kpi_summary", "args": "{}", "id": "c1", "index": 1,
             "type": "tool_call_chunk"}
        ],
    )
    turns = [
        [*(AIMessageChunk(content=part) for part in long_text), mixed],
        [AIMessageChunk(content="done")],
    ]
    model = ChunkedModel(turns)
    events: list[Any] = []
    await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )
    answer_deltas = [e.data["delta"] for e in events if e.type == "answer.delta"]
    assert answer_deltas == [*long_text, "tail.", "done"]
    assert [e for e in events if e.type == "thinking.delta"] == []
