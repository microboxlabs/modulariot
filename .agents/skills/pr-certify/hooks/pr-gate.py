#!/usr/bin/env python3
"""PreToolUse(Bash): refuse `gh pr merge` until the PR head carries a pr-certify stamp.

Fails open on every error — a broken gate must never block the user.
"""

import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _cmd import bypasses, emit, invocations, invokes, read_payload  # noqa: E402

PRCERT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "bin", "prcert")
BYPASS = "PR_CERTIFY_BYPASS=1"
SLUG = r"[A-Za-z0-9._-]+/[A-Za-z0-9._-]+"
PR_URL = re.compile(r"github\.com/(%s)/pull/(\d+)" % SLUG)
SLUG_ONLY = re.compile(r"^%s$" % SLUG)


def pr_target(argv):
    """`--repo`/`--pr` flags for prcert, read off one invocation's argument tokens."""
    target, i = [], 0
    while i < len(argv):
        tok = argv[i]
        if tok in ("--repo", "-R") and i + 1 < len(argv) and SLUG_ONLY.match(argv[i + 1]):
            target += ["--repo", argv[i + 1]]
            i += 2
            continue
        if tok.startswith("--repo=") and SLUG_ONLY.match(tok[7:]):
            target += ["--repo", tok[7:]]
            i += 1
            continue
        m = PR_URL.search(tok)
        if m:
            target += ["--repo", m.group(1), "--pr", m.group(2)]
            i += 1
            continue
        if tok.isdigit() and "--pr" not in target:
            target += ["--pr", tok]
            i += 1
            continue
        i += 1
    return target


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

    # Take the target off the invocation that actually matched, not the first
    # `gh pr merge` in the text: `echo 'gh pr merge 1'; gh pr merge 2` merges 2.
    found = invocations(cmd, "merge") or [[]]
    for argv in found[:4]:
        target = pr_target(argv)
        args = [PRCERT] + target + ["gate"]
        try:
            p = subprocess.run(args, capture_output=True, text=True, timeout=30,
                               cwd=cwd if os.path.isdir(cwd) else None)
        except Exception:
            continue
        if p.returncode != 3:
            continue
        reason = (p.stdout or p.stderr).strip()
        emit("PreToolUse", permissionDecision="deny", permissionDecisionReason=(
            "pr-certify gate: %s\n\nRun the pr-certify skill to certify this PR, or prefix the "
            "merge command with %s to merge anyway." % (reason, BYPASS)))
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
