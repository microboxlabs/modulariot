"""Provenance log for composable datasource primitive calls (plan 13, E4).

Every call to a datasource's composable primitives (e.g. select / grep /
explain) writes one JSONL line under `evals/provenance/YYYY-MM-DD.jsonl`.
The weekly `scripts/provenance-curate.py` pass reads these to surface
candidates:

- Repeated `(table, where_pattern)` combos → new curated function candidate.
- Cross-tenant volume → multi-tenant indexing candidate.
- Plan-cost outliers → index or denial candidate.

Self-contained, no DB dependency — just a JSONL writer keyed by UTC
date. Long-term archival is out of scope (the log is committed weekly
by an external job).
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class ProvenanceEntry:
    """One composable-primitive invocation, as written to the JSONL log."""

    question: str
    sql: str
    plan_cost: float
    rows_returned: int
    refreshed_at: datetime | None
    run_id: str
    tenant_id: str


class ProvenanceLog:
    """Append-only JSONL log partitioned by UTC date.

    `enabled=False` makes every call a no-op so production can flip the
    log off without untangling call sites.
    """

    def __init__(self, root: Path, *, enabled: bool = True) -> None:
        self._root = Path(root)
        self._enabled = enabled
        # Latches True after the first unwritable-filesystem error so we
        # don't retry the syscall (or re-log the warning) on every step.
        self._write_disabled = False

    def append(self, entry: ProvenanceEntry, *, now: datetime | None = None) -> None:
        if not self._enabled or self._write_disabled:
            return
        when = now or datetime.now(UTC)
        if when.tzinfo is None:
            when = when.replace(tzinfo=UTC)
        else:
            when = when.astimezone(UTC)
        payload = {
            "logged_at": when.isoformat(),
            "question": entry.question,
            "sql": entry.sql,
            "plan_cost": entry.plan_cost,
            "rows_returned": entry.rows_returned,
            "refreshed_at": entry.refreshed_at.isoformat() if entry.refreshed_at else None,
            "run_id": entry.run_id,
            "tenant_id": entry.tenant_id,
        }
        try:
            self._root.mkdir(parents=True, exist_ok=True)
            path = self._root / f"{when.date().isoformat()}.jsonl"
            with path.open("a", encoding="utf-8") as fh:
                # Single write so concurrent appends from other processes
                # can't slip a record between the JSON body and its newline.
                fh.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except OSError as exc:
            # Provenance is a best-effort telemetry side-channel — it must
            # never break a user-facing run. In production the harness runs
            # on a read-only filesystem (EROFS) or without write permission
            # (EACCES); log once, latch off, and let the request return an
            # answer. Point MIOT_HARNESS_PROVENANCE_LOG_DIR at a writable
            # path, or set MIOT_HARNESS_PROVENANCE_LOG_ENABLED=false, to
            # silence this.
            self._write_disabled = True
            logger.warning(
                "Provenance log disabled: cannot write to %s (%s). "
                "Set MIOT_HARNESS_PROVENANCE_LOG_DIR to a writable path or "
                "MIOT_HARNESS_PROVENANCE_LOG_ENABLED=false to silence this.",
                self._root,
                exc,
            )
