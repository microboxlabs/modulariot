"""Task 4 — HarnessSupervisor._finalize_answer wires render_answer into run().

Tests drive the _finalize_answer helper directly (unit) rather than
spinning up a full run, so they are fast and deterministic.
"""

from __future__ import annotations

from miot_harness.runtime.run_store import HarnessRunRecord


def test_finalize_answer_renders_record_and_sets_format():
    from miot_harness.runtime.supervisor import HarnessSupervisor

    rec = HarnessRunRecord(run_id="run_1", answer="# Hi\n\nthere")

    class _Ctx:
        answer_format = "yaml"

    # _finalize_answer is a pure method (no instance state used); call unbound.
    HarnessSupervisor._finalize_answer(object.__new__(HarnessSupervisor), rec, _Ctx())

    import yaml

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
