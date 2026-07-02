from miot_harness.runtime.agent_prompt import (
    build_agent_system_prompt,
    cached_system_message,
)
from tests.fixtures.fake_provider import FAKE_PROFILE


def test_prompt_is_byte_stable():
    assert build_agent_system_prompt(FAKE_PROFILE) == build_agent_system_prompt(
        FAKE_PROFILE
    )


def test_prompt_carries_rigor_and_answer_rules():
    text = build_agent_system_prompt(FAKE_PROFILE)
    assert "FakeSource" in text
    assert FAKE_PROFILE.primer in text
    assert "fake_" in text                 # curated prefix guidance

    # Planner rigor rules
    assert "FUZZY sample" in text
    assert "ENUMERATE the actual rows" in text
    assert "join/pivot query" in text
    assert "identified as needed" in text

    # Synthesizer answer rules
    assert "do not invent rows" in text
    assert "executed_sql" in text
    assert "refreshed_at" in text
    assert "same language as the question" in text
    assert "200 words" in text
    assert "do NOT claim you fabricated them" in text


def test_prompt_has_no_dynamic_markers():
    import re

    text = build_agent_system_prompt(FAKE_PROFILE)
    # No interpolated clock/uuid/request state — these would silently
    # invalidate the prompt-cache prefix on every request.
    assert not re.search(r"\d{4}-\d{2}-\d{2}T\d{2}:", text)
    assert "{" not in text.replace("{}", "")  # no unrendered placeholders


def test_cached_system_message_has_single_ephemeral_breakpoint():
    msg = cached_system_message("hello")
    assert isinstance(msg.content, list) and len(msg.content) == 1
    block = msg.content[0]
    assert block["type"] == "text"
    assert block["text"] == "hello"
    assert block["cache_control"] == {"type": "ephemeral"}
