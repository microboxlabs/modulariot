"""Shared hook helper: decide whether a Bash command really invokes a gh subcommand.

A naive substring test fires on quoted text and heredoc bodies — a commit message
that mentions `gh pr merge` is not a merge. Strip heredoc bodies, then require the
token to sit at a command position.
"""

import json
import re
import sys

HEREDOC = re.compile(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")
BOUNDARY = r"(?:^|[\n;&|(]|\bthen\b|\bdo\b|\belse\b)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*"


def strip_heredocs(cmd):
    out, lines, i = [], cmd.split("\n"), 0
    while i < len(lines):
        line = lines[i]
        out.append(line)
        delims = [m.group(2) for m in HEREDOC.finditer(line)]
        i += 1
        for delim in delims:
            while i < len(lines) and lines[i].strip() != delim:
                i += 1
            if i < len(lines):
                i += 1
    return "\n".join(out)


def read_payload():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def invokes(cmd, subcommand):
    """True when `cmd` actually runs `gh pr <subcommand>`."""
    pattern = BOUNDARY + r"gh\s+pr\s+(?:%s)\b" % subcommand
    return re.search(pattern, strip_heredocs(cmd)) is not None


def emit(event, **fields):
    fields["hookEventName"] = event
    json.dump({"hookSpecificOutput": fields}, sys.stdout)
    sys.stdout.write("\n")
