"""Provenance log for composable Nexo primitive calls (plan 13, E4).

Every call to `nexo_select` / `nexo_grep` / `nexo_explain` writes one
JSONL line under `evals/provenance/YYYY-MM-DD.jsonl`. The weekly
`scripts/provenance-curate.py` pass reads these to surface candidates:

- Repeated `(table, where_pattern)` combos → new curated `fn_dx_*` candidate.
- Cross-tenant volume → multi-tenant indexing candidate.
- Plan-cost outliers → index or denial candidate.

Self-contained, no DB dependency — just a JSONL writer keyed by UTC
date. Long-term archival is out of scope (the log is committed weekly
by an external job).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path


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

    def append(self, entry: ProvenanceEntry, *, now: datetime | None = None) -> None:
        if not self._enabled:
            return
        when = now or datetime.now(UTC)
        if when.tzinfo is None:
            when = when.replace(tzinfo=UTC)
        else:
            when = when.astimezone(UTC)
        self._root.mkdir(parents=True, exist_ok=True)
        path = self._root / f"{when.date().isoformat()}.jsonl"
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
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(payload, ensure_ascii=False))
            fh.write("\n")
