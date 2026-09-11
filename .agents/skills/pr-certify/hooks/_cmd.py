"""Shared hook helper: decide whether a Bash command really invokes a gh subcommand.

Two passes with deliberately different temperaments:

  scan()        a quote-, comment- and heredoc-aware character walk of the raw
                text. Cheap, and it never misses an occurrence the shell could
                actually execute.
  invocations() shlex tokenization. Precise about *which* PR is being merged and
                good at ignoring prose, but a hand-rolled shell parser will
                always have holes.

The gate uses both. invocations() names the targets; scan() decides whether a
miss is real. An occurrence sitting in live shell code that invocations() failed
to resolve means the parser has a hole, and the caller denies instead of
guessing — a parser gap must never read as "no merge here".
"""

import json
import re
import shlex
import sys

SEPARATOR_CHARS = set(";&|()<>\n`")
ASSIGNMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
# Wrappers that run their argument as a command, so `gh` after one is still a command.
WRAPPERS = {"command", "builtin", "env", "exec", "eval", "nohup", "sudo", "doas",
            "xargs", "time", "nice", "ionice", "stdbuf", "setsid"}
KEYWORDS = {"if", "then", "elif", "else", "while", "until", "do", "{", "!"} | WRAPPERS
WORD = r"[A-Za-z0-9_./-]+"


def _delimiter(text, i):
    """Parse a heredoc operator at `text[i]`. Returns (delimiter, strip_tabs, end) or None.

    `<<<` is a herestring, not a heredoc; so is the second `<` of one, which read
    alone would take the quoted word as its delimiter.
    """
    if not text.startswith("<<", i) or text.startswith("<<<", i):
        return None
    if i and text[i - 1] == "<":
        return None
    j = i + 2
    strip_tabs = False
    if j < len(text) and text[j] == "-":
        strip_tabs = True
        j += 1
    while j < len(text) and text[j] in " \t":
        j += 1
    if j >= len(text):
        return None
    quote = None
    if text[j] in "'\"":
        quote = text[j]
        j += 1
    word = []
    while j < len(text):
        c = text[j]
        if quote:
            if c == quote:
                j += 1
                break
            word.append(c)
        else:
            if c == "\\":
                j += 1
                if j < len(text):
                    word.append(text[j])
                    j += 1
                continue
            if not re.match(WORD, c):
                break
            word.append(c)
        j += 1
    delim = "".join(word)
    return (delim, strip_tabs, j) if delim else None


def scan(cmd):
    """One pass over the raw command.

    Returns (masked, live) where `masked` is the command with comments and
    heredoc bodies blanked out — what the tokenizer should see — and `live` is a
    per-character list, True where that character is shell code outside quotes,
    comments and heredoc bodies.
    """
    n = len(cmd)
    live = [False] * n
    masked = list(cmd)
    pending = []          # heredocs opened on the current line, not yet closed
    quote = None
    i = 0
    at_word_start = True

    while i < n:
        c = cmd[i]

        if c == "\n":
            live[i] = quote is None
            i += 1
            at_word_start = True
            # Consume the bodies of every heredoc opened on the line just ended.
            while pending:
                delim, strip_tabs = pending.pop(0)
                while i < n:
                    end = cmd.find("\n", i)
                    end = n if end < 0 else end
                    line = cmd[i:end]
                    candidate = line.lstrip("\t") if strip_tabs else line
                    for k in range(i, min(end + 1, n)):
                        masked[k] = "\n" if cmd[k] == "\n" else " "
                    i = end + 1 if end < n else n
                    if candidate == delim:
                        break
            continue

        if quote:
            if c == "\\" and quote == '"' and i + 1 < n:
                i += 2
                continue
            if c == quote:
                quote = None
            i += 1
            continue

        if c in "'\"":
            quote = c
            live[i] = True
            i += 1
            at_word_start = False
            continue

        if c == "\\" and i + 1 < n:
            live[i] = True
            i += 2
            at_word_start = False
            continue

        if c == "#" and at_word_start:
            end = cmd.find("\n", i)
            end = n if end < 0 else end
            for k in range(i, end):
                masked[k] = " "
            i = end
            continue

        if c == "<" and cmd.startswith("<<<", i):
            for k in range(i, i + 3):
                live[k] = True
            i += 3
            at_word_start = False
            continue

        if c == "<":
            parsed = _delimiter(cmd, i)
            if parsed:
                delim, strip_tabs, end = parsed
                pending.append((delim, strip_tabs))
                for k in range(i, end):
                    live[k] = True
                i = end
                at_word_start = False
                continue

        live[i] = True
        at_word_start = c in " \t;&|()`" or c == "\n"
        i += 1

    return "".join(masked), live


def strip_heredocs(cmd):
    return scan(cmd)[0]


def mentions(cmd, subcommand):
    """True when `gh pr <subcommand>` appears in live shell code.

    Deliberately blunt: it catches occurrences the precise parser may not, which
    is exactly what makes a parser gap detectable rather than silent.
    """
    _, live = scan(cmd)
    pattern = re.compile(r"\bgh\s+pr\s+(?:%s)\b" % subcommand)
    for m in pattern.finditer(cmd):
        if all(live[k] for k in range(m.start(), m.end()) if cmd[k] != "\n"):
            return True
    return False


def _lex(text):
    try:
        lexer = shlex.shlex(text, posix=True, punctuation_chars=True)
        lexer.whitespace_split = True
        return list(lexer)
    except ValueError:
        return None


def tokenize(cmd):
    """Shell-aware tokens, or None when the command will not parse.

    shlex keeps a quoted argument as one token, so `printf '%s' '; gh pr merge'`
    yields one token that cannot be mistaken for an invocation. It also eats
    newlines, which would hide the second command of a multi-line script, so
    lines are lexed separately and rejoined with an explicit separator. A line
    that will not parse alone is a quote spanning lines: keep accumulating.
    """
    text = strip_heredocs(cmd).replace("`", " ` ")
    tokens, buf = [], None
    for line in text.split("\n"):
        buf = line if buf is None else buf + "\n" + line
        toks = _lex(buf)
        if toks is None:
            continue
        if tokens:
            tokens.append("\n")
        tokens.extend(toks)
        buf = None
    return None if buf is not None else tokens


def is_punctuation(token):
    """shlex glues runs of punctuation together, so `>&2;` arrives as one token."""
    return bool(token) and set(token) <= SEPARATOR_CHARS


def _at_command_position(tokens, i):
    """A command starts the input, follows an operator, or follows a keyword or
    wrapper that is itself at a command position — `echo then gh` is three
    arguments, not a keyword."""
    j = i - 1
    while j >= 0:
        if ASSIGNMENT.match(tokens[j]):
            j -= 1
            continue
        if is_punctuation(tokens[j]):
            return True
        if tokens[j] in KEYWORDS:
            j -= 1
            continue
        return False
    return True


def _matches(tokens, i, wanted):
    return (tokens[i] == "gh" and i + 2 < len(tokens)
            and tokens[i + 1] == "pr" and tokens[i + 2] in wanted)


def invocations(cmd, subcommand):
    """Argument tokens of every real `gh pr <subcommand>`, one list each.

    Redirections and their operands are dropped — `gh pr merge > 123` merges the
    PR of the current branch into a file called 123, it does not merge PR 123.
    Returns None when the command will not parse, which callers must treat as
    unknown rather than as none.
    """
    wanted = set(subcommand.split("|"))
    tokens = tokenize(cmd)
    if tokens is None:
        return None
    found = []
    for i in range(len(tokens)):
        if not _matches(tokens, i, wanted) or not _at_command_position(tokens, i):
            continue
        argv, j = [], i + 3
        while j < len(tokens) and not is_punctuation(tokens[j]):
            argv.append(tokens[j])
            j += 1
        # A redirection ends the argument list; its operand is a file, not an argument.
        while j < len(tokens) and is_punctuation(tokens[j]) and set(tokens[j]) <= set("<>&"):
            j += 2
        found.append(argv)
    return found


def invokes(cmd, subcommand):
    """True when `cmd` runs `gh pr <subcommand>`, or when it may and we cannot tell."""
    found = invocations(cmd, subcommand)
    if found:
        return True
    return mentions(cmd, subcommand)


def bypasses(cmd, token, subcommand):
    """True only when `token` is an environment assignment on a real invocation."""
    tokens = tokenize(cmd)
    if tokens is None:
        return False
    wanted = set(subcommand.split("|"))
    for i in range(len(tokens)):
        if not _matches(tokens, i, wanted) or not _at_command_position(tokens, i):
            continue
        j = i - 1
        while j >= 0 and ASSIGNMENT.match(tokens[j]):
            if tokens[j] == token:
                return True
            j -= 1
    return False


def read_payload():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def emit(event, **fields):
    fields["hookEventName"] = event
    json.dump({"hookSpecificOutput": fields}, sys.stdout)
    sys.stdout.write("\n")
