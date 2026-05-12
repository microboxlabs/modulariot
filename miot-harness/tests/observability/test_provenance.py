"""E4 — provenance log writer."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from miot_harness.observability.provenance import (
    ProvenanceEntry,
    ProvenanceLog,
)


def test_provenance_entry_contains_all_required_fields(tmp_path: Path) -> None:
    log = ProvenanceLog(root=tmp_path)
    refreshed_at = datetime(2026, 5, 12, 10, 0, tzinfo=UTC)
    entry = ProvenanceEntry(
        question="show services with delta_eta_horas > 6",
        sql="SELECT * FROM nexo.dx_servicios WHERE delta_eta_horas > 6",
        plan_cost=42.5,
        rows_returned=37,
        refreshed_at=refreshed_at,
        run_id="run_abc",
        tenant_id="mintral",
    )
    log.append(entry, now=datetime(2026, 5, 12, 12, 30, tzinfo=UTC))

    written = tmp_path / "2026-05-12.jsonl"
    assert written.exists()
    line = written.read_text().strip()
    payload = json.loads(line)
    assert payload["question"] == "show services with delta_eta_horas > 6"
    assert payload["sql"].startswith("SELECT * FROM nexo.dx_servicios")
    assert payload["plan_cost"] == 42.5
    assert payload["rows_returned"] == 37
    assert payload["refreshed_at"] == refreshed_at.isoformat()
    assert payload["run_id"] == "run_abc"
    assert payload["tenant_id"] == "mintral"
    assert "logged_at" in payload


def test_provenance_log_appends_one_line_per_call(tmp_path: Path) -> None:
    log = ProvenanceLog(root=tmp_path)
    now = datetime(2026, 5, 12, 12, 0, tzinfo=UTC)
    for i in range(3):
        log.append(
            ProvenanceEntry(
                question=f"q{i}",
                sql="SELECT * FROM nexo.dx_servicios LIMIT 1",
                plan_cost=10.0 + i,
                rows_returned=i,
                refreshed_at=now,
                run_id=f"run_{i}",
                tenant_id="mintral",
            ),
            now=now,
        )
    lines = (tmp_path / "2026-05-12.jsonl").read_text().splitlines()
    assert len(lines) == 3
    parsed = [json.loads(line) for line in lines]
    assert [p["question"] for p in parsed] == ["q0", "q1", "q2"]


def test_provenance_partitions_by_date(tmp_path: Path) -> None:
    log = ProvenanceLog(root=tmp_path)
    for day, suffix in ((11, "a"), (12, "b"), (12, "c")):
        ts = datetime(2026, 5, day, 8, 0, tzinfo=UTC)
        log.append(
            ProvenanceEntry(
                question=f"q-{suffix}",
                sql="SELECT 1 FROM nexo.dx_servicios LIMIT 1",
                plan_cost=1.0,
                rows_returned=0,
                refreshed_at=ts,
                run_id=f"r-{suffix}",
                tenant_id="mintral",
            ),
            now=ts,
        )

    files = sorted(p.name for p in tmp_path.iterdir())
    assert files == ["2026-05-11.jsonl", "2026-05-12.jsonl"]
    may12 = (tmp_path / "2026-05-12.jsonl").read_text().splitlines()
    assert len(may12) == 2


def test_provenance_creates_parent_dir_if_missing(tmp_path: Path) -> None:
    root = tmp_path / "fresh" / "provenance"
    log = ProvenanceLog(root=root)
    now = datetime(2026, 5, 12, 8, 0, tzinfo=UTC)
    log.append(
        ProvenanceEntry(
            question="q",
            sql="SELECT 1 FROM nexo.dx_servicios LIMIT 1",
            plan_cost=1.0,
            rows_returned=0,
            refreshed_at=now,
            run_id="r",
            tenant_id="mintral",
        ),
        now=now,
    )
    assert root.is_dir()
    assert (root / "2026-05-12.jsonl").exists()


def test_provenance_no_op_when_disabled(tmp_path: Path) -> None:
    """When `enabled=False`, no file is created — telemetry off-switch."""

    log = ProvenanceLog(root=tmp_path, enabled=False)
    log.append(
        ProvenanceEntry(
            question="q",
            sql="SELECT 1 FROM nexo.dx_servicios LIMIT 1",
            plan_cost=1.0,
            rows_returned=0,
            refreshed_at=datetime(2026, 5, 12, tzinfo=UTC),
            run_id="r",
            tenant_id="mintral",
        ),
        now=datetime(2026, 5, 12, 9, 0, tzinfo=UTC),
    )
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("refreshed_at", [None, datetime(2026, 5, 12, tzinfo=UTC)])
def test_provenance_handles_missing_refreshed_at(
    tmp_path: Path, refreshed_at: datetime | None
) -> None:
    """`refreshed_at` may be None (provenance for queries that don't carry it)."""

    log = ProvenanceLog(root=tmp_path)
    log.append(
        ProvenanceEntry(
            question="q",
            sql="SELECT 1 FROM nexo.dx_servicios LIMIT 1",
            plan_cost=1.0,
            rows_returned=0,
            refreshed_at=refreshed_at,
            run_id="r",
            tenant_id="mintral",
        ),
        now=datetime(2026, 5, 12, 9, 0, tzinfo=UTC),
    )
    payload = json.loads((tmp_path / "2026-05-12.jsonl").read_text().strip())
    if refreshed_at is None:
        assert payload["refreshed_at"] is None
    else:
        assert payload["refreshed_at"] == refreshed_at.isoformat()
