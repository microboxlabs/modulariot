import json
from typing import Any

from miot_harness.evals.conversations import (
    DEFAULT_CASES,
    check_turn,
    load_cases,
    run_case,
    source_failures,
)


def _record(blocks: list[dict[str, Any]] | str, tools: tuple[str, ...] = ()) -> dict[str, Any]:
    return {
        "status": "completed",
        "answer": blocks if isinstance(blocks, str) else json.dumps(blocks),
        "events": [{"type": "tool.started", "data": {"tool": t}} for t in tools],
        "context": {"model": "m"},
    }


def test_the_shipped_cases_load() -> None:
    assert load_cases(DEFAULT_CASES)


def test_a_web_turn_passes_when_search_ran_and_a_link_is_cited() -> None:
    record = _record(
        [{"type": "markdown", "value": "About 40, see https://example.com/list"}],
        ("web_search",),
    )
    assert check_turn(record, {"tools": ["web_search"], "links": True}) == []


def test_a_clarifying_question_instead_of_a_search_fails() -> None:
    record = _record(
        [{"type": "intent", "value": "ask"}, {"type": "markdown", "value": "¿A qué te refieres?"}]
    )
    failures = check_turn(record, {"tools": ["web_search"], "links": True})
    assert failures == ["did not call web_search", "cites no link"]


def test_raw_block_json_inside_markdown_fails() -> None:
    leaked = 'I need to classify this.\n```json\n[{"type": "intent", "value": "ask"}]\n```'
    record = _record([{"type": "markdown", "value": leaked}])
    assert check_turn(record, {}) == ["raw block JSON shown to the user"]


def test_an_answer_that_is_not_a_block_array_fails() -> None:
    assert check_turn(_record("plain text"), {}) == ["answer is not a JSON block array"]


def test_forbidden_tools_expected_text_and_intent_are_checked() -> None:
    record = _record(
        [{"type": "intent", "value": "answer"}, {"type": "markdown", "value": "Hay 3"}],
        ("web_search",),
    )
    failures = check_turn(
        record,
        {"no_tools": ["web_search"], "contains_any": ["viajes"], "intent": "navigate"},
    )
    assert failures == [
        "called web_search",
        "answer mentions none of ['viajes']",
        "intent 'answer', expected 'navigate'",
    ]


def test_bot_blocking_statuses_count_as_existing_sources() -> None:
    failures = source_failures(
        {
            "https://a.test": 200,
            "https://b.test": 403,
            "https://c.test": 404,
            "https://d.test": "ConnectError",
        }
    )
    assert failures == [
        "source not found: https://c.test (404)",
        "source not found: https://d.test (ConnectError)",
    ]


def test_turns_share_one_conversation_and_mirror_the_chat_request() -> None:
    sent: list[dict[str, Any]] = []

    def post(body: dict[str, Any]) -> dict[str, Any]:
        sent.append(body)
        return _record([{"type": "markdown", "value": "ok"}])

    case = {"id": "c", "turns": [{"message": "one"}, {"message": "two"}]}
    results = run_case(case, post, {"skill_id": "miot-search", "answer_format": "json"})
    assert [r.passed for r in results] == [True, True]
    assert sent[0]["conversation_id"] == sent[1]["conversation_id"]
    assert [b["message"] for b in sent] == ["one", "two"]
    assert all(b["skill_id"] == "miot-search" and b["answer_format"] == "json" for b in sent)


def test_numbers_are_read_in_spanish_and_english_formats() -> None:
    from miot_harness.evals.conversations import numbers

    found = numbers("Total: 38.325,9 h; en inglés 38,325.9; sin miles 38325.9; 57,9 %")
    assert {38325.9, 57.9} <= found


def test_a_comma_and_space_end_a_number() -> None:
    from miot_harness.evals.conversations import numbers

    assert 9813 in numbers("En 2026, 9.813 servicios")
    assert {2026, 9813} <= numbers("2026 9813")
    assert 38325.9 in numbers("38 325,9 h")


def test_numbers_inside_table_blocks_are_checked() -> None:
    table = {"type": "table", "value": {"columns": ["h"], "rows": [[38325.9]]}}
    expect = {"numbers": [{"value": 38325.9, "tolerance_pct": 1}]}
    assert check_turn(_record([table]), expect) == []
    assert check_turn(_record([{"type": "table", "value": [[1.0]]}]), expect) == [
        "no number near 38325.9 (±1%)"
    ]


def test_a_number_outside_tolerance_fails() -> None:
    record = _record([{"type": "markdown", "value": "Fueron 36.000 horas"}])
    failures = check_turn(record, {"numbers": [{"value": 38325.9, "tolerance_pct": 2}]})
    assert failures == ["no number near 38325.9 (±2%)"]


def test_tool_budget_and_block_types_are_checked() -> None:
    record = _record([{"type": "markdown", "value": "ok"}], ("a", "b", "c"))
    assert check_turn(record, {"max_tools": 2, "blocks": ["chart"]}) == [
        "3 tool calls, budget 2",
        "no chart block",
    ]


def test_the_analytics_suite_loads() -> None:
    from miot_harness.evals.conversations import SUITES

    assert load_cases(SUITES["analytics"])
