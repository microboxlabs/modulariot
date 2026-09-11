#!/usr/bin/env python3
"""PreToolUse(Bash): refuse `gh pr merge` until the PR head carries a pr-certify stamp.

Fails open on every error — a broken gate must never block the user.
"""

import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _cmd import bypasses, emit, invokes, read_payload, strip_heredocs  # noqa: E402

PRCERT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "bin", "prcert")
BYPASS = "PR_CERTIFY_BYPASS=1"


def main():
    payload = read_payload()
    cmd = (payload.get("tool_input") or {}).get("command") or ""
    cwd = payload.get("cwd") or ""

    if not invokes(cmd, "merge"):
        return 0
    if bypasses(cmd, BYPASS, "merge"):
        return 0
    if not os.access(PRCERT, os.X_OK):
        return 0

    clean = strip_heredocs(cmd)
    args = [PRCERT]

    repo = re.search(r"(?:--repo|-R)[=\s]+([A-Za-z0-9._-]+/[A-Za-z0-9._-]+)", clean)
    url = re.search(r"github\.com/([A-Za-z0-9._-]+/[A-Za-z0-9._-]+)/pull/(\d+)", clean)
    if url:
        args += ["--repo", url.group(1), "--pr", url.group(2)]
    else:
        if repo:
            args += ["--repo", repo.group(1)]
        tail = clean[re.search(r"gh\s+pr\s+merge", clean).end():]
        num = re.search(r"^(?:\s+(?:--repo|-R)[=\s]*[A-Za-z0-9._-]+/[A-Za-z0-9._-]+|\s+-[^\s]+)*"
                        r"\s+(\d+)\b", tail)
        if num:
            args += ["--pr", num.group(1)]
    args.append("gate")

    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=30,
                           cwd=cwd if os.path.isdir(cwd) else None)
    except Exception:
        return 0
    if p.returncode != 3:
        return 0

    reason = (p.stdout or p.stderr).strip()
    emit("PreToolUse", permissionDecision="deny", permissionDecisionReason=(
        "pr-certify gate: %s\n\nRun the pr-certify skill to certify this PR, or prefix the "
        "command with %s to merge anyway." % (reason, BYPASS)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
