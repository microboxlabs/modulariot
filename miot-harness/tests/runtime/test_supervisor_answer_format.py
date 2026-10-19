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


# --- The no-model answer is rendered in the requested format too ---


@pytest.mark.asyncio
async def test_no_model_answer_is_finalized_as_yaml(tmp_path):
    from miot_harness.runtime.context import UserRequest
    from miot_harness.runtime.run_store import JsonRunStore
    from miot_harness.runtime.supervisor import HarnessSupervisor
    from miot_harness.tools.registry import ToolRegistry

    sup = HarnessSupervisor(tools=ToolRegistry(), run_store=JsonRunStore(tmp_path))

    record = await sup.run(
        UserRequest(message="show me the data", tenant_id="other-tenant", answer_format="yaml")
    )

    assert record.status == "completed"
    assert record.answer_format == "yaml"
    parsed = yaml.safe_load(record.answer)
    assert isinstance(parsed, dict)
    assert "answer" in parsed
