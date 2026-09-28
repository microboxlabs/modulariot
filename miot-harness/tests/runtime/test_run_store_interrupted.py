from __future__ import annotations

from pathlib import Path

from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.run_store import HarnessRunRecord, JsonRunStore


def _record(run_id: str, status: str) -> HarnessRunRecord:
    return HarnessRunRecord(
        run_id=run_id,
        status=status,
        events=[HarnessEvent(run_id=run_id, seq=0, type="run.started", message="Run started")],
    )


def test_unfinished_runs_are_failed_as_interrupted(tmp_path: Path) -> None:
    store = JsonRunStore(tmp_path)
    for run_id, status in [
        ("run_a", "running"),
        ("run_b", "created"),
        ("run_c", "completed"),
        ("run_d", "failed"),
    ]:
        store.save(_record(run_id, status))

    marked = store.mark_interrupted()

    assert sorted(marked) == ["run_a", "run_b"]
    for run_id in ("run_a", "run_b"):
        record = store.load(run_id)
        assert record.status == "failed"
        last = record.events[-1]
        assert last.type == "run.failed"
        assert last.seq == 1
        assert last.data["reason"] == "interrupted"
    assert store.load("run_c").status == "completed"
    assert store.load("run_c").events[-1].type == "run.started"
    assert store.load("run_d").status == "failed"


def test_a_file_it_cannot_read_is_skipped(tmp_path: Path) -> None:
    store = JsonRunStore(tmp_path)
    (store.runs_dir / "run_bad.json").write_text('{"run_id": "run_bad", "status": "running", ')
    store.save(_record("run_ok", "running"))

    assert store.mark_interrupted() == ["run_ok"]
