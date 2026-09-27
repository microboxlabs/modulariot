"""Chat commands the harness answers itself, without the agent loop.

`/compact [focus]` folds the conversation into its summary now.
`/context` reports how the next request would fill the model's context
window.

A command is the whole message: the name first, then its argument.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

COMMANDS = ("compact", "context")


@dataclass(frozen=True)
class Command:
    name: str
    argument: str


def parse_command(message: str) -> Command | None:
    text = message.strip()
    if not text.startswith("/"):
        return None
    name, _, rest = text[1:].partition(" ")
    name, _, first_line_rest = name.partition("\n")
    if name not in COMMANDS:
        return None
    argument = " ".join(part for part in (first_line_rest, rest) if part).strip()
    return Command(name=name, argument=argument)


def render_context(report: dict[str, Any]) -> str:
    """The `/context` answer as Markdown."""
    window = report["window"]
    rows = [
        ("System prompt", report["system"]),
        (f"Tools ({report['tool_count']})", report["tools"]),
        ("Conversation summary", report["summary"]),
        (f"History ({report['turns']} turns)", report["history"]),
        ("Free", report["free"]),
    ]
    lines = [
        f"**{report['model']}** · {report['used']:,} / {window:,} tokens ({report['ratio']:.1%})",
        "",
        "| Part | Tokens | Share |",
        "|---|---:|---:|",
        *(f"| {label} | {tokens:,} | {tokens / window:.1%} |" for label, tokens in rows),
        "",
        "Counts are approximate.",
    ]
    compact_at = report.get("compact_at")
    if compact_at:
        lines.append(
            f"History is summarized automatically past {compact_at:,} tokens. "
            "Send `/compact` to summarize it now."
        )
    return "\n".join(lines)
