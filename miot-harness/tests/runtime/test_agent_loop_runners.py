"""One agent loop runner per conversation model, built on first use."""

from __future__ import annotations

from typing import Any

import pytest
from langchain_core.messages import AIMessage

from miot_harness.config import HarnessSettings
from miot_harness.runtime.agent_loop import AgentLoopRunners
from miot_harness.runtime.context import UserRequest
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.runtime.test_agent_loop import ScriptedModel
from tests.test_native_tools import _registry


def _runners(built: list[str]) -> AgentLoopRunners:
    def build(name: str) -> Any:
        built.append(name)
        return ScriptedModel([AIMessage(content=f"from {name}")])

    return AgentLoopRunners(
        default_model="claude-opus-4-8",
        models=["claude-sonnet-4-6", "claude-opus-4-8"],
        build_model=build,
        registry=_registry(),
        settings=HarnessSettings(agents_agentic_max_turns=3),
        profile=FAKE_PROFILE,
    )


def test_allowlist_is_default_plus_models_without_duplicates() -> None:
    runners = _runners([])
    assert runners.models == ("claude-opus-4-8", "claude-sonnet-4-6")
    assert runners.allowed(None)
    assert runners.allowed("claude-sonnet-4-6")
    assert not runners.allowed("claude-haiku-4-5")


@pytest.mark.asyncio
async def test_run_dispatches_on_the_context_model_and_builds_once() -> None:
    built: list[str] = []
    runners = _runners(built)
    ctx = UserRequest(message="q", tenant_id="acme", model="claude-sonnet-4-6").to_context()
    delta = await runners.run(user_message="q", ctx=ctx, prior_messages=[], progress=lambda e: None)
    assert delta["answer"] == "from claude-sonnet-4-6"
    assert built == ["claude-sonnet-4-6"]
    assert runners.runner_for("claude-sonnet-4-6") is runners.runner_for("claude-sonnet-4-6")
    assert built == ["claude-sonnet-4-6"]
    assert runners.runner_for(None) is runners.runner_for("claude-opus-4-8")
    assert built == ["claude-sonnet-4-6", "claude-opus-4-8"]


def test_unknown_model_is_refused_even_by_a_direct_caller() -> None:
    with pytest.raises(ValueError, match="allowlist"):
        _runners([]).runner_for("claude-haiku-4-5")


def test_empty_model_name_is_refused_not_defaulted() -> None:
    with pytest.raises(ValueError, match="allowlist"):
        _runners([]).runner_for("")
