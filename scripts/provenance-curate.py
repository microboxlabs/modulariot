"""Surface curation candidates from the provenance log (plan 13, E4).

Reads the last N days of `evals/provenance/YYYY-MM-DD.jsonl` files and
groups by:

1. **Table + WHERE-pattern repeats** — candidates to promote into a new
   curated `fn_dx_*` function. These are the "agent kept reinventing the
   same query" signal.

2. **Plan-cost outliers** — top-N most expensive queries. Either need
   an index or should be refused (raise EXPLAIN cost threshold OR add a
   denial pattern).

3. **Cross-tenant volume** — table referenced by N tenants in the window.
   Signal for the multi-tenant abstraction in plan 14.

Output is plain text (or JSON via ``--format json``) so it can be
diffed in the weekly auto-commit.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

_TABLE_RE = re.compile(r"FROM\s+(nexo\.\w+)", re.IGNORECASE)
_WHERE_RE = re.compile(r"WHERE\s+(.+?)(?:\s+(?:ORDER|LIMIT|GROUP)|$)", re.IGNORECASE)


def _normalize_where(clause: str) -> str:
    """Collapse literal values to placeholders so similar predicates cluster.

    `WHERE id = 5` and `WHERE id = 7` both become `WHERE id = $`. This is
    a coarse cluster: agents reinventing the same FILTER + LIMIT pattern
    against the same table will land in one bucket.
    """

    s = re.sub(r"'[^']*'", "$", clause)
    s = re.sub(r"\b\d+(?:\.\d+)?\b", "$", s)
    return re.sub(r"\s+", " ", s).strip().lower()


def _load_window(root: Path, since: datetime, until: datetime) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    if not root.exists():
        return entries
    for path in sorted(root.glob("*.jsonl")):
        try:
            day = datetime.fromisoformat(path.stem).replace(tzinfo=UTC)
        except ValueError:
            continue
        if not (since <= day <= until):
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return entries


def curate(entries: list[dict[str, Any]], *, top: int = 10) -> dict[str, Any]:
    pattern_counts: Counter[str] = Counter()
    pattern_examples: dict[str, str] = {}
    by_table: Counter[str] = Counter()
    by_tenant_table: set[tuple[str, str]] = set()
    cost_outliers: list[dict[str, Any]] = []

    for e in entries:
        sql = e.get("sql", "")
        table_match = _TABLE_RE.search(sql)
        table = table_match.group(1) if table_match else "(unknown)"
        where_match = _WHERE_RE.search(sql)
        where_norm = _normalize_where(where_match.group(1)) if where_match else ""
        key = f"{table.lower()}::{where_norm}"

        pattern_counts[key] += 1
        pattern_examples.setdefault(key, e.get("question", ""))
        by_table[table.lower()] += 1
        by_tenant_table.add((e.get("tenant_id", "?"), table.lower()))

        cost = float(e.get("plan_cost") or 0.0)
        cost_outliers.append({"cost": cost, "sql": sql, "question": e.get("question", "")})

    cost_outliers.sort(key=lambda r: r["cost"], reverse=True)
    cross_tenant_tables = Counter(t for _, t in by_tenant_table).most_common()

    return {
        "total_entries": len(entries),
        "top_patterns": [
            {
                "pattern": k,
                "count": c,
                "example_question": pattern_examples.get(k, ""),
            }
            for k, c in pattern_counts.most_common(top)
        ],
        "top_tables": by_table.most_common(top),
        "cross_tenant_tables": [
            {"table": t, "n_tenants": n} for t, n in cross_tenant_tables if n >= 2
        ],
        "cost_outliers": cost_outliers[:top],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("evals/provenance"),
        help="Directory of YYYY-MM-DD.jsonl files",
    )
    parser.add_argument("--since-days", type=int, default=7, help="Window size in days")
    parser.add_argument("--top", type=int, default=10, help="Top-N rows per category")
    parser.add_argument(
        "--format", choices=("text", "json"), default="text", help="Output format"
    )
    args = parser.parse_args()

    until = datetime.now(UTC)
    since = until - timedelta(days=args.since_days)
    entries = _load_window(args.root, since=since, until=until)
    report = curate(entries, top=args.top)

    if args.format == "json":
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0

    print(f"Provenance window: {since.date()} → {until.date()}  ({len(entries)} entries)")
    print()
    print(f"Top {args.top} (table, where-pattern) repeats:")
    for row in report["top_patterns"]:
        print(f"  {row['count']:>4}  {row['pattern']}")
        if row["example_question"]:
            print(f"        ex: {row['example_question'][:80]}")
    print()
    print("Cross-tenant tables (≥2 tenants):")
    for row in report["cross_tenant_tables"]:
        print(f"  {row['n_tenants']:>3}  {row['table']}")
    print()
    print("Plan-cost outliers:")
    for row in report["cost_outliers"]:
        print(f"  {row['cost']:>10.1f}  {row['question'][:80]}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
