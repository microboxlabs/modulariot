"""Conversation evals against a running harness.

Sends each case's turns to `POST /runs` the way the app's chat does
(`skill_id=miot-analyst`, `answer_format=json`, one `conversation_id` per case)
and checks what the service did: which tools ran, whether the answer is a
valid block array, and whether the sources it cites exist.

    uv run miot-harness-chat-evals --port 8010 --tenant-id "$TENANT"

Cases live in `chat_cases.yaml` next to this module. Exit code 1 when any turn fails.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import threading
import time
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
import yaml

# Shipped inside the package so an installed entry point finds it.
DEFAULT_CASES = Path(__file__).with_name("chat_cases.yaml")
SUITES = {
    "chat": DEFAULT_CASES,
    "analytics": Path(__file__).with_name("analytics_cases.yaml"),
}
# A separator must be followed by a digit, so "2026, 9.813" is two numbers.
# A space or no-break space groups thousands only before exactly three digits.
_NUMBER_RE = re.compile(r"\d+(?:[\u00a0 ]\d{3}(?!\d))*(?:[.,]\d+)*")

_LINK_RE = re.compile(r"https?://[^\s)\]>\"'`]+")
# A block array written inside a markdown value: the model narrated and the
# array was not salvaged, so the user sees raw JSON.
_LEAKED_BLOCKS_RE = re.compile(r'\{\s*"type"\s*:\s*"(?:intent|markdown|url)"')


@dataclass
class TurnResult:
    case: str
    turn: int
    message: str
    passed: bool
    failures: list[str] = field(default_factory=list)
    tools: list[str] = field(default_factory=list)
    model: str | None = None
    seconds: float = 0.0
    answer: str = ""
    sources: dict[str, int | str] = field(default_factory=dict)
    tokens: int = 0


def load_cases(path: Path) -> list[dict[str, Any]]:
    data = yaml.safe_load(path.read_text())
    cases = data.get("cases") if isinstance(data, dict) else None
    if not isinstance(cases, list) or not cases:
        raise ValueError(f"{path}: expected a non-empty `cases` list")
    for case in cases:
        if not case.get("id") or not case.get("turns"):
            raise ValueError(f"{path}: every case needs an `id` and `turns`")
    return cases


def tools_called(record: dict[str, Any]) -> list[str]:
    return [
        e["data"]["tool"]
        for e in record.get("events", [])
        if e.get("type") == "tool.started" and isinstance(e.get("data", {}).get("tool"), str)
    ]


def skills_loaded(record: dict[str, Any]) -> list[str]:
    return [
        str(e["data"].get("skill_id"))
        for e in record.get("events", [])
        if e.get("type") == "tool.completed"
        and e.get("data", {}).get("tool") == "load_skill"
        and e["data"].get("loaded") is True
    ]


def tokens_used(record: dict[str, Any]) -> int:
    return sum(
        int(e.get("data", {}).get("input_tokens") or 0)
        + int(e.get("data", {}).get("output_tokens") or 0)
        for e in record.get("events", [])
        if e.get("type") == "usage.recorded"
    )


def parse_blocks(answer: str | None) -> list[dict[str, Any]] | None:
    try:
        blocks = json.loads(answer or "")
    except ValueError:
        return None
    if not isinstance(blocks, list) or not all(isinstance(b, dict) and "type" in b for b in blocks):
        return None
    return blocks


def answer_text(blocks: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for block in blocks:
        value = block.get("value")
        if isinstance(value, str):
            parts.append(value)
        elif isinstance(value, dict):
            parts.extend(str(v) for v in value.values())
    return "\n".join(parts)


def links(blocks: list[dict[str, Any]]) -> list[str]:
    return sorted(set(_LINK_RE.findall(answer_text(blocks))))


def _number_candidates(token: str) -> list[str]:
    if "." in token and "," in token:
        decimal = "." if token.rfind(".") > token.rfind(",") else ","
        thousands = "," if decimal == "." else "."
        return [token.replace(thousands, "").replace(decimal, ".")]
    sep = "," if "," in token else "."
    if sep not in token:
        return [token]
    if token.count(sep) > 1:
        return [token.replace(sep, "")]
    return [token.replace(sep, ""), token.replace(sep, ".")]


def _number_readings(token: str) -> set[float]:
    """Every value a formatted number can mean: 38.325,9 / 38,325.9 / 38.325 (es or en)."""
    token = token.replace("\u00a0", "").replace(" ", "")
    readings: set[float] = set()
    for candidate in _number_candidates(token):
        try:
            readings.add(float(candidate))
        except ValueError:
            continue
    return readings


def numbers(text: str) -> set[float]:
    found: set[float] = set()
    for token in _NUMBER_RE.findall(text):
        found |= _number_readings(token)
    return found


def _leaf_text(value: Any) -> list[str]:
    """Every scalar inside a block tree, as text, so tables and KPIs are checked too."""
    if isinstance(value, dict):
        return [t for v in value.values() for t in _leaf_text(v)]
    if isinstance(value, list):
        return [t for v in value for t in _leaf_text(v)]
    if value is None or isinstance(value, bool):
        return []
    return [str(value)]


def _number_failures(text: str, expect: dict[str, Any]) -> list[str]:
    wanted = expect.get("numbers", [])
    if not wanted:
        return []
    found = numbers(text)
    failures = []
    for item in wanted:
        value = float(item["value"])
        tolerance = abs(value) * float(item.get("tolerance_pct", 1)) / 100
        if not any(abs(n - value) <= tolerance for n in found):
            failures.append(f"no number near {value:g} (±{item.get('tolerance_pct', 1)}%)")
    return failures


def _leaks_block_json(blocks: list[dict[str, Any]]) -> bool:
    return any(
        b.get("type") == "markdown"
        and ("```json" in b.get("value", "") or _LEAKED_BLOCKS_RE.search(b.get("value", "")))
        for b in blocks
    )


def _tool_failures(tools: list[str], expect: dict[str, Any]) -> list[str]:
    failures = [f"did not call {n}" for n in expect.get("tools", []) if n not in tools]
    failures += [f"called {n}" for n in expect.get("no_tools", []) if n in tools]
    if expect.get("any_tool") and not tools:
        failures.append("called no tool")
    budget = expect.get("max_tools")
    if budget is not None and len(tools) > budget:
        failures.append(f"{len(tools)} tool calls, budget {budget}")
    return failures


def _content_failures(blocks: list[dict[str, Any]], expect: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    if expect.get("links") and not links(blocks):
        failures.append("cites no link")
    lowered = answer_text(blocks).lower()
    wanted = expect.get("contains_any", [])
    if wanted and not any(w.lower() in lowered for w in wanted):
        failures.append(f"answer mentions none of {wanted}")
    failures += [
        f"answer says {p!r}" for p in expect.get("not_contains", []) if p.lower() in lowered
    ]
    intent = expect.get("intent")
    got = next((b.get("value") for b in blocks if b.get("type") == "intent"), None)
    if intent and got != intent:
        failures.append(f"intent {got!r}, expected {intent!r}")
    types = {b.get("type") for b in blocks if b.get("type") != "choices" or _is_question(b)}
    failures += [f"no {t} block" for t in expect.get("blocks", []) if t not in types]
    return failures + _number_failures("\n".join(_leaf_text(blocks)), expect)


def _is_question(block: dict[str, Any]) -> bool:
    """A choices block the user can answer: a question and at least two options."""
    value = block.get("value")
    if not isinstance(value, dict) or not str(value.get("question") or "").strip():
        return False
    options = value.get("options")
    return (
        isinstance(options, list)
        and sum(1 for o in options if isinstance(o, dict) and str(o.get("label") or "").strip())
        >= 2
    )


def check_turn(record: dict[str, Any], expect: dict[str, Any]) -> list[str]:
    """Return the failed checks for one turn; empty means it passed."""
    failures: list[str] = []
    if record.get("status") != "completed":
        failures.append(f"status {record.get('status')}")
    blocks = parse_blocks(record.get("answer"))
    if blocks is None:
        return [*failures, "answer is not a JSON block array"]
    if _leaks_block_json(blocks):
        failures.append("raw block JSON shown to the user")
    loaded = skills_loaded(record)
    failures += [f"did not load skill {s}" for s in expect.get("skills", []) if s not in loaded]
    return failures + _alternative_failures(
        [*blocks, *shown_widgets(record)], tools_called(record), expect
    )


def shown_widgets(record: dict[str, Any]) -> list[dict[str, Any]]:
    """The run's widgets as blocks: the chat shows each one, rows included."""
    return [
        {"type": "widget_data", "value": e["data"]["widget"]}
        for e in record.get("events", [])
        if e.get("type") == "widget.created" and isinstance(e.get("data", {}).get("widget"), dict)
    ]


def _alternative_failures(
    blocks: list[dict[str, Any]], tools: list[str], expect: dict[str, Any]
) -> list[str]:
    """`one_of`: the turn passes when the tool and content checks of any alternative pass."""

    def check(e: dict[str, Any]) -> list[str]:
        return _tool_failures(tools, e) + _content_failures(blocks, e)

    alternatives = expect.get("one_of")
    if not alternatives:
        return check(expect)
    base = {k: v for k, v in expect.items() if k != "one_of"}
    tried = [check({**base, **alt}) for alt in alternatives]
    if any(not failures for failures in tried):
        return []
    return ["no alternative passed: " + " | ".join("; ".join(f) for f in tried)]


def check_sources(urls: list[str], client: httpx.Client) -> dict[str, int | str]:
    """Fetch each cited URL. 401/403/429 count as existing: many sites refuse bots."""
    results: dict[str, int | str] = {}
    for url in urls:
        try:
            response = client.get(url, follow_redirects=True, timeout=15)
            results[url] = response.status_code
        except httpx.HTTPError as exc:
            results[url] = type(exc).__name__
    return results


def source_failures(results: dict[str, int | str]) -> list[str]:
    missing = [
        url
        for url, status in results.items()
        if not isinstance(status, int) or (status >= 400 and status not in (401, 403, 429))
    ]
    return [f"source not found: {url} ({results[url]})" for url in missing]


def _run_turn(
    case_id: str,
    index: int,
    turn: dict[str, Any],
    post: Callable[[dict[str, Any]], dict[str, Any]],
    body: dict[str, Any],
    verify_sources: Callable[[list[str]], dict[str, int | str]] | None,
) -> TurnResult:
    started = time.monotonic()
    try:
        record = post(body)
    except httpx.HTTPError as exc:
        record = {"status": f"http error: {exc}"}
    seconds = time.monotonic() - started
    expect = turn.get("expect", {})
    failures = check_turn(record, expect)
    if expect.get("max_seconds") and seconds > float(expect["max_seconds"]):
        failures.append(f"took {seconds:.0f}s, budget {expect['max_seconds']}s")
    blocks = parse_blocks(record.get("answer")) or []
    sources: dict[str, int | str] = {}
    if verify_sources and blocks and links(blocks):
        sources = verify_sources(links(blocks))
        failures += source_failures(sources)
    return TurnResult(
        case=case_id,
        turn=index,
        message=turn["message"],
        passed=not failures,
        failures=failures,
        tools=tools_called(record),
        model=(record.get("context") or {}).get("model"),
        seconds=round(seconds, 1),
        answer=answer_text(blocks) if blocks else str(record.get("answer") or ""),
        sources=sources,
        tokens=tokens_used(record),
    )


def run_case(
    case: dict[str, Any],
    post: Callable[[dict[str, Any]], dict[str, Any]],
    base_body: dict[str, Any],
    verify_sources: Callable[[list[str]], dict[str, int | str]] | None = None,
    on_turn: Callable[[TurnResult], None] | None = None,
) -> list[TurnResult]:
    conversation_id = f"eval-{case['id']}-{uuid.uuid4().hex[:8]}"
    results: list[TurnResult] = []
    for index, turn in enumerate(case["turns"], start=1):
        body = {**base_body, "message": turn["message"], "conversation_id": conversation_id}
        result = _run_turn(case["id"], index, turn, post, body, verify_sources)
        results.append(result)
        if on_turn:
            on_turn(result)
    return results


_print_lock = threading.Lock()


def _print(result: TurnResult) -> None:
    mark = "PASS" if result.passed else "FAIL"
    tools = ",".join(result.tools) or "-"
    lines = [
        f"{mark} {result.case}#{result.turn} [{result.seconds}s {result.tokens} tok"
        f" {result.model}] tools={tools}",
        f"     > {result.message}",
        f"     < {result.answer[:240].replace(chr(10), ' ')}",
        *(f"     ! {failure}" for failure in result.failures),
    ]
    with _print_lock:
        print("\n".join(lines), file=sys.stderr, flush=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("MIOT_EVAL_PORT", "8010")),
        help="harness port on localhost (a local run, or a port-forward to a cluster)",
    )
    parser.add_argument("--tenant-id", default=os.environ.get("MIOT_EVAL_TENANT_ID"))
    parser.add_argument("--user-id", default="chat-evals@example.com")
    parser.add_argument(
        "--model", action="append", help="repeat to compare models; default: the harness default"
    )
    parser.add_argument("--suite", choices=sorted(SUITES), default="chat")
    parser.add_argument(
        "--skill",
        default="miot-analyst",
        help="skill_id sent with each run (the chat's by default)",
    )
    parser.add_argument("--only", action="append", help="case id to run; repeatable")
    parser.add_argument("--repeat", type=int, default=1, help="run each case N times")
    parser.add_argument("--no-source-check", action="store_true", help="skip fetching cited URLs")
    parser.add_argument("--jobs", type=int, default=4, help="conversations run at once")
    parser.add_argument("--json", action="store_true", help="print every turn result as JSON")
    args = parser.parse_args(argv)

    cases = [c for c in load_cases(SUITES[args.suite]) if not args.only or c["id"] in args.only]
    if not cases:
        parser.error("no case matches --only")
    all_results: list[dict[str, Any]] = []
    with (
        httpx.Client(base_url=f"http://localhost:{args.port}", timeout=300) as harness,
        httpx.Client(headers={"user-agent": "Mozilla/5.0 (miot-harness chat evals)"}) as web,
    ):

        def post(body: dict[str, Any]) -> dict[str, Any]:
            response = harness.post("/runs", json=body)
            if response.status_code >= 400:
                return {"status": f"http {response.status_code}: {response.text[:200]}"}
            record: dict[str, Any] = response.json()
            return record

        verify = None if args.no_source_check else (lambda urls: check_sources(urls, web))
        jobs: list[tuple[dict[str, Any], dict[str, Any]]] = []
        for model in args.model or [None]:
            base_body: dict[str, Any] = {
                "skill_id": args.skill,
                "answer_format": "json",
                "user_id": args.user_id,
            }
            if args.tenant_id:
                base_body["tenant_id"] = args.tenant_id
            if model:
                base_body["model"] = model
            jobs += [(case, base_body) for _ in range(args.repeat) for case in cases]
        print(
            f"{len(jobs)} conversations against localhost:{args.port}", file=sys.stderr, flush=True
        )
        with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
            futures = [
                pool.submit(run_case, case, post, body, verify, _print) for case, body in jobs
            ]
            for future, (_, body) in zip(futures, jobs, strict=True):
                all_results += [
                    {**r.__dict__, "requested_model": body.get("model")} for r in future.result()
                ]
    failed = sum(not r["passed"] for r in all_results)
    total = len(all_results)
    tokens = sum(r["tokens"] for r in all_results)
    seconds = sum(r["seconds"] for r in all_results)
    calls = sum(len(r["tools"]) for r in all_results)
    print(
        f"\n{total - failed}/{total} turns passed · {calls} tool calls · {tokens} tokens"
        f" · {seconds:.0f}s model time",
        file=sys.stderr,
    )
    if args.json:
        print(json.dumps(all_results, indent=2, ensure_ascii=False))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
