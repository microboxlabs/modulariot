"""Task 4 — HarnessSupervisor._finalize_answer wires render_answer into run().

Tests drive the _finalize_answer helper directly (unit) rather than
spinning up a full run, so they are fast and deterministic.
"""

from __future__ import annotations

import pytest
import yaml

from miot_harness.runtime.run_store import HarnessRunRecord


def test_finalize_answer_renders_record_and_sets_format():
    from miot_harness.runtime.supervisor import HarnessSupervisor

    rec = HarnessRunRecord(run_id="run_1", answer="# Hi\n\nthere")

    class _Ctx:
        answer_format = "yaml"

    # _finalize_answer is a pure method (no instance state used); call unbound.
    HarnessSupervisor._finalize_answer(object.__new__(HarnessSupervisor), rec, _Ctx())

    assert rec.answer_format == "yaml"
    assert yaml.safe_load(rec.answer) == {"answer": "# Hi\n\nthere"}


def test_finalize_answer_is_none_safe():
    from miot_harness.runtime.supervisor import HarnessSupervisor

    rec = HarnessRunRecord(run_id="run_2", answer=None)

    class _Ctx:
        answer_format = "html"

    HarnessSupervisor._finalize_answer(object.__new__(HarnessSupervisor), rec, _Ctx())
    assert rec.answer is None
    assert rec.answer_format == "html"


def test_finalize_answer_echo_is_effective_format_on_unknown(monkeypatch):
    """When the requested format is unknown the effective format echoed back
    is 'markdown' (the actual content), not the caller-supplied value."""
    from miot_harness.runtime.supervisor import HarnessSupervisor

    rec = HarnessRunRecord(run_id="run_3", answer="# MD")

    class _Ctx:
        answer_format = "totally-bogus"

    HarnessSupervisor._finalize_answer(object.__new__(HarnessSupervisor), rec, _Ctx())
    assert rec.answer == "# MD"
    assert rec.answer_format == "markdown"


# --- Finding 2: ModeAccessDenied terminal path regression guard ---


@pytest.mark.asyncio
async def test_mode_access_denied_answer_is_finalized_as_yaml(tmp_path):
    """When _resolve_route raises ModeAccessDenied the supervisor must still
    run _finalize_answer, so the persisted record's answer is rendered in the
    requested format and answer_format is echoed correctly.

    Trigger: llm_router wired + tenant_lock set + request mode="canned" with a
    different tenant_id → mode_resolver.resolve_mode raises ModeAccessDenied
    before any LLM call is made (the mode check is first).
    """
    from unittest.mock import AsyncMock, MagicMock

    from miot_harness.runtime.context import UserRequest
    from miot_harness.runtime.intent_router import LLMIntentRouter
    from miot_harness.runtime.router import IntentRouter
    from miot_harness.runtime.run_store import JsonRunStore
    from miot_harness.runtime.supervisor import HarnessSupervisor
    from miot_harness.storytelling.module import StorytellingModule
    from miot_harness.tools.registry import ToolRegistry

    # Minimal stub model — ModeAccessDenied fires before any LLM call.
    mock_model = MagicMock()
    mock_model.ainvoke = AsyncMock(
        return_value=MagicMock(content='{"route": "DIRECT", "confidence": 0.9, "reasoning": "x"}')
    )
    llm_router = LLMIntentRouter(model=mock_model)

    sup = HarnessSupervisor(
        router=IntentRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        llm_router=llm_router,
        tenant_lock="locked-tenant",  # request's tenant_id will not match
    )

    request = UserRequest(
        message="show me the data",
        mode="canned",
        tenant_id="other-tenant",   # != tenant_lock → ModeAccessDenied
        answer_format="yaml",
    )

    record = await sup.run(request)

    # The run must complete (not raise)
    assert record.status == "completed"
    # answer must be non-null — it is set from str(exc) before finalize
    assert record.answer is not None
    # answer_format must be echoed as "yaml" since str(exc) is Markdown-ish text
    assert record.answer_format == "yaml"
    # answer must be valid YAML and parse successfully
    parsed = yaml.safe_load(record.answer)
    assert isinstance(parsed, dict)
    assert "answer" in parsed
