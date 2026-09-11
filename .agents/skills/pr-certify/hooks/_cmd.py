"""Shared hook helper: decide whether a Bash command really invokes a gh subcommand.

A naive substring test fires on quoted text and heredoc bodies — a commit message
that mentions `gh pr merge` is not a merge. Strip heredoc bodies, then require the
token to sit at a command position.
"""

import json
import re
import shlex
import sys

HEREDOC = re.compile(r"<<(-?)\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\2")


def heredoc_delimiters(line, quote):
    """Delimiters opened on this line, outside quotes. Returns (delims, quote-state).

    `printf '<<EOF'` is not a heredoc; treating it as one would discard the lines
    below it, including a real merge, and the gate would fail open.
    """
    delims, i, n = [], 0, len(line)
    while i < n:
        c = line[i]
        if quote:
            if c == "\\" and quote == '"':
                i += 2
                continue
            if c == quote:
                quote = None
            i += 1
            continue
        if c in "'\"":
            quote = c
            i += 1
            continue
        if c == "\\":
            i += 2
            continue
        if c == "<" and line.startswith("<<", i):
            if line.startswith("<<<", i) or (i and line[i - 1] == "<"):
                i += 3 if line.startswith("<<<", i) else 2
                continue
            m = HEREDOC.match(line, i)
            if m:
                delims.append(m.group(3))
                i = m.end()
                continue
            i += 2
            continue
        i += 1
    return delims, quote
BOUNDARY = r"(?:^|[\n;&|(]|\bthen\b|\bdo\b|\belse\b)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*"


def strip_heredocs(cmd):
    """Drop heredoc bodies. `$(( x << n ))` also matches the operator, so a run is only
    treated as a heredoc when a closing delimiter line actually shows up below it."""
    out, lines, i, quote = [], cmd.split("\n"), 0, None
    while i < len(lines):
        line = lines[i]
        out.append(line)
        delims, quote = heredoc_delimiters(line, quote)
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


KEYWORDS = {"if", "then", "elif", "else", "while", "until", "do", "{", "!", "time"}


def is_punctuation(token):
    """shlex glues runs of punctuation together, so `));` arrives as one token."""
    return bool(token) and set(token) <= SEPARATOR_CHARS


def _lex(text):
    try:
        lexer = shlex.shlex(text, posix=True, punctuation_chars=True)
        lexer.whitespace_split = True
        return list(lexer)
    except ValueError:
        return None


def tokenize(cmd):
    """Shell-aware tokens, or None when the command will not parse.

    shlex keeps a quoted argument as one token, so `printf '%s' '; gh pr merge 42'`
    yields one token that cannot be mistaken for an invocation. It also eats
    newlines, which would hide the second command of a multi-line script, so
    lines are lexed separately and rejoined with an explicit separator. A line
    that will not parse on its own is a quote spanning lines: keep accumulating.
    """
    tokens, buf = [], None
    for line in cmd.split("\n"):
        buf = line if buf is None else buf + "\n" + line
        toks = _lex(buf)
        if toks is None:
            continue
        if tokens:
            tokens.append("\n")
        tokens.extend(toks)
        buf = None
    if buf is not None:
        return None
    return tokens


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


def invocations(cmd, subcommand):
    """Argument tokens of every real `gh pr <subcommand>` in `cmd`, one list each.

    Returns None when the command could not be parsed, which callers treat as
    "unknown" rather than "none".
    """
    clean = strip_heredocs(cmd)
    wanted = set(subcommand.split("|"))
    tokens = tokenize(clean)
    if tokens is None:
        return None
    found = []
    for i in range(len(tokens) - 2):
        if not (tokens[i] == "gh" and tokens[i + 1] == "pr" and tokens[i + 2] in wanted):
            continue
        if not _at_command_position(tokens, i):
            continue
        j = i + 3
        while j < len(tokens) and not is_punctuation(tokens[j]):
            j += 1
        found.append(tokens[i + 3:j])
    return found


def invokes(cmd, subcommand):
    """True when `cmd` actually runs `gh pr <subcommand>`."""
    found = invocations(cmd, subcommand)
    if found is not None:
        return bool(found)
    pattern = BOUNDARY + r"gh\s+pr\s+(?:%s)\b" % subcommand
    return re.search(pattern, strip_heredocs(cmd)) is not None


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
