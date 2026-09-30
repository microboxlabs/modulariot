"""One agent loop runner per conversation model, built on first use."""

from __future__ import annotations

from typing import Any

import pytest
from langchain_core.messages import AIMessage

from miot_harness.agents.model_providers import ModelSpec, Provider, ProviderRegistry
from miot_harness.config import HarnessSettings, ModelNotConfiguredError
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
        settings=HarnessSettings(agents_agent_loop_max_turns=3),
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


def test_without_a_default_a_run_that_names_no_model_fails() -> None:
    runners = AgentLoopRunners(
        default_model=None,
        models=["claude-sonnet-4-6"],
        build_model=lambda name: ScriptedModel([AIMessage(content=name)]),
        registry=_registry(),
        settings=HarnessSettings(agents_agent_loop_max_turns=3),
        profile=FAKE_PROFILE,
    )
    assert runners.default_model is None
    assert runners.models == ("claude-sonnet-4-6",)
    with pytest.raises(ModelNotConfiguredError, match="MIOT_HARNESS_AGENTS_AGENT_LOOP_MODEL"):
        runners.runner_for(None)
    assert runners.runner_for("claude-sonnet-4-6") is not None


def test_an_empty_configured_default_counts_as_unset() -> None:
    runners = AgentLoopRunners(
        default_model="",
        models=[],
        build_model=lambda name: ScriptedModel([AIMessage(content=name)]),
        registry=_registry(),
        settings=HarnessSettings(agents_agent_loop_max_turns=3),
        profile=FAKE_PROFILE,
    )
    assert runners.default_model is None
    assert runners.models == ()
    with pytest.raises(ModelNotConfiguredError, match="MIOT_HARNESS_AGENTS_AGENT_LOOP_MODEL"):
        runners.runner_for(None)


def test_the_platform_default_model_serves_runs_that_name_none() -> None:
    offered = ProviderRegistry(
        [
            Provider(
                "deepseek",
                "openai_compatible",
                "sk-x",
                models=(ModelSpec("deepseek-chat", default=True),),
            )
        ]
    )
    runners = AgentLoopRunners(
        default_model=None,
        models=[],
        build_model=lambda name: ScriptedModel([AIMessage(content=name)]),
        registry=_registry(),
        settings=HarnessSettings(agents_agent_loop_max_turns=3),
        profile=FAKE_PROFILE,
        providers=lambda: offered,
    )
    assert runners.default_model == "deepseek:deepseek-chat"
    assert runners.runner_for(None) is runners.runner_for("deepseek:deepseek-chat")


def test_empty_model_name_is_refused_not_defaulted() -> None:
    with pytest.raises(ValueError, match="allowlist"):
        _runners([]).runner_for("")


@pytest.mark.asyncio
async def test_run_effort_builds_its_own_runner() -> None:
    built: list[tuple[str, str | None]] = []

    def build(name: str, effort: str | None = None) -> Any:
        built.append((name, effort))
        return ScriptedModel([AIMessage(content=f"from {name} at {effort}")])

    runners = AgentLoopRunners(
        default_model="claude-opus-4-8",
        models=["claude-opus-4-8"],
        build_model=build,
        registry=_registry(),
        settings=HarnessSettings(agents_agent_loop_max_turns=3),
        profile=FAKE_PROFILE,
    )
    ctx = UserRequest(message="q", tenant_id="acme", effort="low").to_context()
    assert ctx.effort == "low"
    delta = await runners.run(user_message="q", ctx=ctx, prior_messages=[], progress=lambda e: None)
    assert delta["answer"] == "from claude-opus-4-8 at low"
    assert runners.runner_for(None) is not runners.runner_for(None, "low")
    assert built == [("claude-opus-4-8", "low"), ("claude-opus-4-8", None)]


def test_unknown_effort_is_rejected_at_the_request() -> None:
    with pytest.raises(ValueError):
        UserRequest(message="q", tenant_id="acme", effort="extreme")
