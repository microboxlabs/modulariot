"""Unified diffs of a file's text, as tool results and approval cards show them."""

from __future__ import annotations

import difflib
from typing import Any


def line_count(text: str | None) -> int:
    return len(text.splitlines()) if text else 0


def unified_diff(old: str | None, new: str | None, path: str) -> str:
    """`old` → `new` as a unified diff with 3 lines of context. None stands for
    a file that does not exist (created or deleted)."""
    before = (old or "").splitlines(keepends=True)
    after = (new or "").splitlines(keepends=True)
    lines = difflib.unified_diff(
        before,
        after,
        fromfile="/dev/null" if old is None else f"a/{path}",
        tofile="/dev/null" if new is None else f"b/{path}",
        n=3,
    )
    return "".join(line if line.endswith("\n") else f"{line}\n" for line in lines)


def diff_fields(old: str | None, new: str | None, path: str) -> dict[str, Any]:
    """The `diff` and line counts a file change carries."""
    return {
        "diff": unified_diff(old, new, path),
        "old_lines": line_count(old),
        "new_lines": line_count(new),
    }
