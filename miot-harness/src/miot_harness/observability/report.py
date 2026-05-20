"""Cost report CLI (plan 13, C3).

Reads traces from Langfuse's public API (or a local JSONL fixture)
and prints per-agent / per-tenant / per-mode cost aggregations.

Live use:

    python -m miot_harness.observability.report --since 7d --by agent

Synthetic / dry-run:

    python -m miot_harness.observability.report \
        --fixture /path/to/traces.jsonl --by mode

The aggregation core (``aggregate_cost``) is pure — it takes a list of
trace projections and returns CostRow records grouped by the chosen
dimension. The CLI layer reads from Langfuse or a file, projects each
trace into the shape `aggregate_cost` expects, and renders the report.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any, Literal

GroupBy = Literal["agent", "tenant", "mode"]

_QUANTUM = Decimal("0.000001")
_GROUP_KEY = {
    "agent": "modular.agent",
    "tenant": "modular.tenant_id",
    "mode": "modular.mode",
}
_SINCE_RE = re.compile(r"^(\d+)([mhd])$")  # 5m / 24h / 7d


@dataclass(frozen=True, slots=True)
class CostRow:
    """One aggregation bucket — grouping value + summed cost/tokens/count."""

    key: str
    cost_usd: Decimal
    input_tokens: int
    output_tokens: int
    traces: int


def aggregate_cost(
    traces: Iterable[dict[str, Any]],
    *,
    by: GroupBy,
) -> list[CostRow]:
    """Bucket traces by `by` and sum `gen_ai.usage.cost_usd` + tokens."""

    attr = _GROUP_KEY.get(by)
    if attr is None:
        raise ValueError(f"unknown grouping dimension: {by!r}")

    buckets: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"cost": Decimal("0"), "in": 0, "out": 0, "n": 0}
    )
    for trace in traces:
        attrs = trace.get("attributes") or {}
        if "gen_ai.usage.cost_usd" not in attrs:
            continue
        key = str(attrs.get(attr, "(unknown)"))
        bucket = buckets[key]
        bucket["cost"] += Decimal(str(attrs.get("gen_ai.usage.cost_usd") or 0))
        bucket["in"] += int(attrs.get("gen_ai.usage.input_tokens") or 0)
        bucket["out"] += int(attrs.get("gen_ai.usage.output_tokens") or 0)
        bucket["n"] += 1

    rows = [
        CostRow(
            key=key,
            cost_usd=b["cost"].quantize(_QUANTUM),
            input_tokens=b["in"],
            output_tokens=b["out"],
            traces=b["n"],
        )
        for key, b in buckets.items()
    ]
    rows.sort(key=lambda r: (r.cost_usd, r.traces), reverse=True)
    return rows


def parse_since(spec: str) -> timedelta:
    """Parse a since-spec like '7d', '24h', '90m' into a timedelta."""

    match = _SINCE_RE.fullmatch(spec)
    if not match:
        raise ValueError(f"invalid --since spec {spec!r}; expected NNNNm/h/d")
    n, unit = int(match.group(1)), match.group(2)
    if unit == "m":
        return timedelta(minutes=n)
    if unit == "h":
        return timedelta(hours=n)
    if unit == "d":
        return timedelta(days=n)
    raise ValueError(f"unknown unit {unit!r}")  # pragma: no cover


def _load_fixture(path: Path) -> list[dict[str, Any]]:
    """Load a JSONL fixture file — one trace projection per line."""

    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def _render_text(rows: list[CostRow], by: GroupBy) -> str:
    header = (
        f"{'#':>3}  {by.upper():<20}  {'COST_USD':>10}  "
        f"{'INPUT':>10}  {'OUTPUT':>10}  {'N':>5}"
    )
    lines = [header]
    for i, row in enumerate(rows, 1):
        lines.append(
            f"{i:>3}  {row.key[:20]:<20}  {row.cost_usd:>10}  {row.input_tokens:>10}  "
            f"{row.output_tokens:>10}  {row.traces:>5}"
        )
    return "\n".join(lines)


def main() -> int:  # pragma: no cover — CLI shim, exercised by integration runs
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--since", default="7d", help="window size (e.g. 7d, 24h)")
    parser.add_argument("--by", choices=("agent", "tenant", "mode"), default="agent")
    parser.add_argument(
        "--fixture",
        type=Path,
        default=None,
        help="JSONL file of trace projections (skips Langfuse fetch)",
    )
    parser.add_argument(
        "--format", choices=("text", "json"), default="text", help="output format"
    )
    args = parser.parse_args()

    if args.fixture is None:
        # Live Langfuse fetch deferred to F-phase wire-up; for now use a
        # fixture or get a clear error so the operator knows what's needed.
        parser.error(
            "live Langfuse fetch is not wired yet; pass --fixture <path-to-jsonl> "
            "or wait for F-phase integration"
        )

    parse_since(args.since)  # validate spec; window-filtering uses Langfuse query
    traces = _load_fixture(args.fixture)
    rows = aggregate_cost(traces, by=args.by)

    if args.format == "json":
        print(
            json.dumps(
                [
                    {
                        "key": r.key,
                        "cost_usd": str(r.cost_usd),
                        "input_tokens": r.input_tokens,
                        "output_tokens": r.output_tokens,
                        "traces": r.traces,
                    }
                    for r in rows
                ],
                indent=2,
                ensure_ascii=False,
            )
        )
    else:
        print(_render_text(rows, args.by))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
