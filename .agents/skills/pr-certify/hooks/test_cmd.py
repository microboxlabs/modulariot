#!/usr/bin/env python3
"""Command-matching tests for the hooks. Run: python3 hooks/test_cmd.py

Every case marked True in INVOKES is one the gate must act on. The dangerous
direction is a miss, so anything the parser cannot resolve still counts as seen.
"""

import importlib.machinery
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import _cmd  # noqa: E402

_loader = importlib.machinery.SourceFileLoader("prgate", os.path.join(HERE, "pr-gate.py"))
prgate = importlib.util.module_from_spec(importlib.util.spec_from_loader("prgate", _loader))
_loader.exec_module(prgate)

INVOKES = [
    # plain invocations
    ("gh pr merge 5", True),
    ("git push && gh pr merge 5", True),
    ("git push\ngh pr merge 5", True),
    ("PR_CERTIFY_BYPASS=1 gh pr merge 5", True),
    ("x=$(( 1 << 3 )); gh pr merge 5", True),
    ("(cd repo && gh pr merge 5)", True),
    ("if gh pr merge 5; then echo ok; fi", True),
    ("if true; then gh pr merge 5; fi", True),
    ("while gh pr merge 5; do :; done", True),
    ("until gh pr merge 5; do :; done", True),
    ("for x in 1; do gh pr merge 5; done", True),
    ("false || gh pr merge 5", True),
    # forms that used to slip past
    ("echo err >&2; gh pr merge 5", True),
    ("`gh pr merge 5`", True),
    ("command gh pr merge 5", True),
    ("env gh pr merge 5", True),
    ("sudo gh pr merge 5", True),
    ("eval gh pr merge 5", True),
    ("xargs gh pr merge 5", True),
    ("printf '<<EOF'\nmentions\nEOF\ngh pr merge 5", True),
    ("# <<EOF\ngh pr merge 5", True),
    # a tab-indented delimiter closes a <<- heredoc
    ("cat <<-EOF\nbody\n\tEOF\ngh pr merge 5", True),
    # text that only mentions one
    ("printf '%s' '; gh pr merge 42'", False),
    ("echo 'gh pr merge'", False),
    ("grep -r 'gh pr merge' .", False),
    ("cat <<<'gh pr merge'", False),
    ("git commit -F - <<'EOF'\ngh pr merge 5\nEOF", False),
    ("git commit -F - <<'EOF'\nmentions gh pr merge\nEOF", False),
    ("echo 'multi\nline gh pr merge 5'", False),
    ("# gh pr merge 5", False),
    # a space-indented delimiter does NOT close a plain heredoc: the merge stays inside it
    ("cat <<EOF\nbody\n  EOF\ngh pr merge 5\nEOF", False),
    # near misses
    ("gh pr view 5", False),
    ("mygh pr merge 5", False),
]

# An unquoted mention that the parser cannot resolve into an invocation is treated
# as seen, and the gate denies it. A false deny costs one bypass prefix; a false
# allow defeats the gate, and six of the findings that produced this design were
# filed as CWE-863. Quote the text and these go quiet.
AMBIGUOUS = [
    ("echo then gh pr merge", True),
    ("echo do then gh pr merge 5", True),
]

BYPASSES = [
    ("PR_CERTIFY_BYPASS=1 gh pr merge 5", True),
    ("FOO=1 PR_CERTIFY_BYPASS=1 gh pr merge 5", True),
    ("gh pr merge 42; echo PR_CERTIFY_BYPASS=1", False),
    ("PR_CERTIFY_BYPASS=1 echo hi; gh pr merge 42", False),
    ("gh pr merge 42 --subject PR_CERTIFY_BYPASS=1", False),
    ("echo PR_CERTIFY_BYPASS=1 gh pr merge 5", False),
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
    # a redirection operand is a filename, not a PR
    ("gh pr merge > 123", [[]]),
    ("gh pr merge 5 > 123", [["5"]]),
]

PR_TARGET = [
    (["5"], ["--pr", "5"]),
    (["5", "--repo", "a/b"], ["--pr", "5", "--repo", "a/b"]),
    (["-R", "a/b", "--squash", "5"], ["--repo", "a/b", "--pr", "5"]),
    # an option value is not the selector
    (["--subject", "5", "--squash"], []),
    (["--body", "123"], []),
    (["-d"], []),
    # gh pr merge takes a branch too
    (["feature-branch"], ["--pr", "feature-branch"]),
    (["https://github.com/a/b/pull/7"], ["--repo", "a/b", "--pr", "7"]),
]


def main():
    failures = []

    def check(kind, cmd, want, got):
        if got != want:
            failures.append((kind, cmd, want, got))

    for cmd, want in INVOKES:
        check("invokes/merge", cmd, want, _cmd.invokes(cmd, "merge"))
    for cmd, want in AMBIGUOUS:
        check("invokes/ambiguous", cmd, want, _cmd.invokes(cmd, "merge"))
    for cmd, want in CREATE:
        check("invokes/create", cmd, want, _cmd.invokes(cmd, "create|ready"))
    for cmd, want in BYPASSES:
        check("bypasses", cmd, want, _cmd.bypasses(cmd, "PR_CERTIFY_BYPASS=1", "merge"))
    for cmd, want in TARGETS:
        check("invocations", cmd, want, _cmd.invocations(cmd, "merge"))
    for argv, want in PR_TARGET:
        check("pr_target", " ".join(argv), want, prgate.pr_target(argv))

    total = (len(INVOKES) + len(AMBIGUOUS) + len(CREATE) + len(BYPASSES)
             + len(TARGETS) + len(PR_TARGET))
    for kind, cmd, want, got in failures:
        print("FAIL %s: %r\n  want %s\n  got  %s" % (kind, cmd, want, got))
    print("%d/%d passed" % (total - len(failures), total))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
