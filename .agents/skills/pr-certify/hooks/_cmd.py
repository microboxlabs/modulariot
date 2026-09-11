"""Shared hook helper: decide whether a Bash command really invokes a gh subcommand.

A naive substring test fires on quoted text and heredoc bodies — a commit message
that mentions `gh pr merge` is not a merge. Strip heredoc bodies, then require the
token to sit at a command position.
"""

import json
import re
import shlex
import sys

HEREDOC = re.compile(r"(?<!<)<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1(?!<)")
BOUNDARY = r"(?:^|[\n;&|(]|\bthen\b|\bdo\b|\belse\b)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*"


def strip_heredocs(cmd):
    """Drop heredoc bodies. `$(( x << n ))` also matches the operator, so a run is only
    treated as a heredoc when a closing delimiter line actually shows up below it."""
    out, lines, i = [], cmd.split("\n"), 0
    while i < len(lines):
        line = lines[i]
        out.append(line)
        delims = [m.group(2) for m in HEREDOC.finditer(line)]
        i += 1
        for delim in delims:
            close = next((j for j in range(i, len(lines)) if lines[j].strip() == delim), None)
            if close is None:
                break
            i = close + 1
    return "\n".join(out)


def read_payload():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


SEPARATOR_CHARS = set(";&|()\n")
ASSIGNMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")


KEYWORDS = {"then", "do", "else", "elif", "{", "!", "time"}


def is_punctuation(token):
    """shlex glues runs of punctuation together, so `));` arrives as one token."""
    return bool(token) and set(token) <= SEPARATOR_CHARS


def tokenize(cmd):
    """Shell-aware tokens, or None when the command will not parse.

    shlex keeps a quoted argument as one token, so `printf '%s' '; gh pr merge 42'`
    yields a single token that cannot be mistaken for an invocation.
    """
    try:
        lexer = shlex.shlex(cmd, posix=True, punctuation_chars=True)
        lexer.whitespace_split = True
        return list(lexer)
    except ValueError:
        return None


def _at_command_position(tokens, i):
    """A command starts the line, follows an operator, or follows a keyword that is
    itself at a command position — `echo then gh` is three arguments, not a keyword."""
    j = i - 1
    while j >= 0:
        if ASSIGNMENT.match(tokens[j]):
            j -= 1
            continue
        if is_punctuation(tokens[j]):
            return True
        if tokens[j] in KEYWORDS:
            i, j = j, j - 1
            continue
        return False
    return True


def invokes(cmd, subcommand):
    """True when `cmd` actually runs `gh pr <subcommand>`."""
    clean = strip_heredocs(cmd)
    wanted = set(subcommand.split("|"))
    tokens = tokenize(clean)
    if tokens is not None:
        for i in range(len(tokens) - 2):
            if (tokens[i] == "gh" and tokens[i + 1] == "pr" and tokens[i + 2] in wanted
                    and _at_command_position(tokens, i)):
                return True
        return False
    pattern = BOUNDARY + r"gh\s+pr\s+(?:%s)\b" % subcommand
    return re.search(pattern, clean) is not None


def bypasses(cmd, token, subcommand):
    """True only when `token` is an environment assignment on the merge command itself."""
    clean = strip_heredocs(cmd)
    tokens = tokenize(clean)
    if tokens is None:
        return False
    for i in range(len(tokens) - 2):
        if not (tokens[i] == "gh" and tokens[i + 1] == "pr" and tokens[i + 2] in set(subcommand.split("|"))):
            continue
        j = i - 1
        while j >= 0 and ASSIGNMENT.match(tokens[j]):
            if tokens[j] == token:
                return True
            j -= 1
    return False


def emit(event, **fields):
    fields["hookEventName"] = event
    json.dump({"hookSpecificOutput": fields}, sys.stdout)
    sys.stdout.write("\n")
