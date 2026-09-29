#!/usr/bin/env python3
"""PostToolUse(Bash): after a PR is created or marked ready, point at the certification loop."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _cmd import emit, invokes, read_payload  # noqa: E402

MESSAGE = (
    "A pull request was just created or marked ready. Before merging it, invoke the pr-certify "
    "skill: it requests Copilot, CodeRabbit and SonarCloud reviews on the current head, triages "
    "every finding, replies to and resolves each thread, and stamps the PR. `gh pr merge` is "
    "blocked until that stamp matches the head SHA."
)


def main():
    cmd = (read_payload().get("tool_input") or {}).get("command") or ""
    if invokes(cmd, "create|ready"):
        emit("PostToolUse", additionalContext=MESSAGE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
