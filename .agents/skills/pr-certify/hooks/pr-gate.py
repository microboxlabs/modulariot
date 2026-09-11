#!/usr/bin/env python3
"""PreToolUse(Bash): refuse `gh pr merge` until the PR head carries a pr-certify stamp.

Fails open on every error — a broken gate must never block the user — but not on
ambiguity: a merge the parser can see but cannot resolve is denied, not waved
through, because a parser gap must not read as "no merge here".
"""

import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _cmd import bypasses, emit, invocations, mentions, read_payload  # noqa: E402

PRCERT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "bin", "prcert")
BYPASS = "PR_CERTIFY_BYPASS=1"
MAX_INVOCATIONS = 16

SLUG = r"[A-Za-z0-9._-]+/[A-Za-z0-9._-]+"
PR_URL = re.compile(r"github\.com/(%s)/pull/(\d+)" % SLUG)
SLUG_ONLY = re.compile(r"^%s$" % SLUG)
# `gh pr merge` flags that consume the next token, so it is a value and not the selector.
VALUE_FLAGS = {"-b", "--body", "-F", "--body-file", "-t", "--subject", "--match-head-commit",
               "--author-email", "-R", "--repo"}


def pr_target(argv):
    """`--repo`/`--pr` flags for prcert, read off one invocation's argument tokens."""
    target, selector, i = [], None, 0
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
        if tok in VALUE_FLAGS:
            i += 2
            continue
        if tok.startswith("-"):
            i += 1
            continue
        m = PR_URL.search(tok)
        if m:
            target += ["--repo", m.group(1), "--pr", m.group(2)]
            selector = m.group(2)
            i += 1
            continue
        # The first bare operand is the selector: a number, a URL, or a branch.
        if selector is None:
            selector = tok
            target += ["--pr", tok]
        i += 1
    return target


def deny(reason):
    emit("PreToolUse", permissionDecision="deny", permissionDecisionReason=(
        "pr-certify gate: %s\n\nRun the pr-certify skill to certify this PR, or prefix the "
        "merge command with %s to merge anyway." % (reason, BYPASS)))


def main():
    payload = read_payload()
    cmd = (payload.get("tool_input") or {}).get("command") or ""
    cwd = payload.get("cwd") or ""

    found = invocations(cmd, "merge")
    seen = bool(found) or mentions(cmd, "merge")
    if not seen:
        return 0
    if bypasses(cmd, BYPASS, "merge"):
        return 0
    if not os.access(PRCERT, os.X_OK):
        return 0

    if found is None or (not found and seen):
        deny("this command runs `gh pr merge` in a form the hook cannot resolve, "
             "so it cannot tell which PR would be merged")
        return 0
    if len(found) > MAX_INVOCATIONS:
        deny("%d merge invocations in one command - too many to check individually" % len(found))
        return 0

    for argv in found:
        args = [PRCERT] + pr_target(argv) + ["gate"]
        try:
            p = subprocess.run(args, capture_output=True, text=True, timeout=30,
                               cwd=cwd if os.path.isdir(cwd) else None)
        except Exception:
            continue
        if p.returncode == 3:
            deny((p.stdout or p.stderr).strip())
            return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
