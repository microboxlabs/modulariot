#!/usr/bin/env python3
"""Command-matching tests for the hooks. Run: python3 hooks/test_cmd.py"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _cmd  # noqa: E402

INVOKES = [
    # real invocations
    ("gh pr merge 5", True),
    ("git push && gh pr merge 5", True),
    ("PR_CERTIFY_BYPASS=1 gh pr merge 5", True),
    ("x=$(( 1 << 3 )); gh pr merge 5", True),
    ("(cd repo && gh pr merge 5)", True),
    ("if true; then gh pr merge 5; fi", True),
    ("for x in 1; do gh pr merge 5; done", True),
    ("false || gh pr merge 5", True),
    ("if x; then ! gh pr merge 5; fi", True),
    ("if gh pr merge 5; then echo ok; fi", True),
    ("while gh pr merge 5; do :; done", True),
    ("until gh pr merge 5; do :; done", True),
    ("git push\ngh pr merge 5", True),
    ("printf '<<EOF'\nmentions\nEOF\ngh pr merge 5", True),
    # text that only mentions one
    ("printf '%s' '; gh pr merge 42'", False),
    ("echo 'gh pr merge'", False),
    ("grep -r 'gh pr merge' .", False),
    ("cat <<<'gh pr merge'", False),
    ("git commit -F - <<'EOF'\nmentions gh pr merge\nEOF", False),
    ("echo then gh pr merge", False),
    ("echo do then gh pr merge 5", False),
    ("git commit -F - <<'EOF'\ngh pr merge 5\nEOF", False),
    ("echo 'multi\nline gh pr merge 5'", False),
    # near misses
    ("gh pr view 5", False),
    ("mygh pr merge 5", False),
]

BYPASSES = [
    ("PR_CERTIFY_BYPASS=1 gh pr merge 5", True),
    ("FOO=1 PR_CERTIFY_BYPASS=1 gh pr merge 5", True),
    ("gh pr merge 42; echo PR_CERTIFY_BYPASS=1", False),
    ("PR_CERTIFY_BYPASS=1 echo hi; gh pr merge 42", False),
    ("gh pr merge 42 --subject PR_CERTIFY_BYPASS=1", False),
    ("gh pr merge 5", False),
]

CREATE = [
    ("gh pr create --fill", True),
    ("gh pr ready 1174", True),
    ("git push -u origin x && gh pr create --fill", True),
    ("git commit -F - <<'EOF'\nafter gh pr create do X\nEOF", False),
    ("echo 'gh pr create'", False),
]


TARGETS = [
    ("gh pr merge 5", [["5"]]),
    ("gh pr merge 5 --repo acme/repo", [["5", "--repo", "acme/repo"]]),
    ("echo 'gh pr merge 1'; gh pr merge 2 --repo acme/repo", [["2", "--repo", "acme/repo"]]),
    ("gh pr merge 1; gh pr merge 2", [["1"], ["2"]]),
]


def main():
    failures = []
    for cmd, want in TARGETS:
        got = _cmd.invocations(cmd, "merge")
        if got != want:
            failures.append(("invocations", cmd, want, got))
    for cmd, want in INVOKES:
        got = _cmd.invokes(cmd, "merge")
        if got != want:
            failures.append(("invokes/merge", cmd, want, got))
    for cmd, want in CREATE:
        got = _cmd.invokes(cmd, "create|ready")
        if got != want:
            failures.append(("invokes/create", cmd, want, got))
    for cmd, want in BYPASSES:
        got = _cmd.bypasses(cmd, "PR_CERTIFY_BYPASS=1", "merge")
        if got != want:
            failures.append(("bypasses", cmd, want, got))

    total = len(INVOKES) + len(CREATE) + len(BYPASSES) + len(TARGETS)
    for kind, cmd, want, got in failures:
        print("FAIL %s: %r want %s got %s" % (kind, cmd, want, got))
    print("%d/%d passed" % (total - len(failures), total))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
