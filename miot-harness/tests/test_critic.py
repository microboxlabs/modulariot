from __future__ import annotations

from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.agents.critic import critic_node
from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.context import HarnessContext


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


@pytest.mark.asyncio
async def test_critic_disabled_passes_through_without_llm():
    """Default config: agents_critic_enabled=False. The critic returns
    state delta without invoking the model."""
    state: dict[str, Any] = {
        "user_message": "?",
        "ctx": _ctx(),
        "answer": "operativo OK al 10:00 UTC",
        "evidence": [],
        "turn_count": 1,
    }
    # Empty FakeListChatModel — would raise IndexError if invoked
    model = FakeListChatModel(responses=[])

    update = await critic_node(
        state,
        settings=HarnessSettings(agents_critic_enabled=False),
        model=model,
        profile=NEXO_PROFILE,
    )

    # Pass-through: no changes
    assert update == {} or update.get("answer") == state["answer"]


@pytest.mark.asyncio
async def test_critic_enabled_runs_check_and_can_pass_answer():
    """When enabled, the critic invokes the model. A 'pass' verdict
    leaves the answer alone."""
    model = FakeListChatModel(responses=['{"verdict": "pass", "concerns": ""}'])
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "answer": "operativo OK al 10:00 UTC",
        "evidence": [],
        "turn_count": 2,
    }

    update = await critic_node(
        state,
        settings=HarnessSettings(agents_critic_enabled=True),
        model=model,
        profile=NEXO_PROFILE,
    )
    # No state change on pass
    assert update == {} or "answer" not in update or update["answer"] == state["answer"]


@pytest.mark.asyncio
async def test_critic_enabled_flags_concerns_in_state():
    """A 'fail' verdict surfaces concerns into state so the synthesizer
    or the run record can show them, but does not block the answer in v1."""
    model = FakeListChatModel(
        responses=['{"verdict": "fail", "concerns": "did not cite refreshed_at"}']
    )
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "answer": "3 ETA en riesgo.",
        "evidence": [],
        "turn_count": 2,
    }

    update = await critic_node(
        state,
        settings=HarnessSettings(agents_critic_enabled=True),
        model=model,
        profile=NEXO_PROFILE,
    )
    assert "critic_concerns" in update
    assert "refreshed_at" in update["critic_concerns"]
