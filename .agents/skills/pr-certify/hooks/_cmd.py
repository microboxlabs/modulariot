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
SHELLS = {"bash", "sh", "zsh", "dash", "ksh", "busybox"}
# gh global flags that consume the next token, so it is not the `pr` subcommand.
GH_VALUE_FLAGS = {"-R", "--repo"}
REDIRECT = set("<>&")
MAX_NESTING = 3


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
    arith = 0             # depth of $(( )) - `<<` inside one is a shift
    stack = []            # quote states suspended by a command substitution
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
            # A double quote suppresses word splitting, not command substitution:
            # the inside of $( ) or ` ` is live shell code even in the middle of one.
            if quote == '"' and cmd.startswith("$(", i):
                stack.append(quote)
                quote = None
                live[i] = live[i + 1] = True
                i += 2
                at_word_start = True
                continue
            if quote == '"' and c == "`":
                stack.append(quote)
                quote = None
                live[i] = True
                i += 1
                at_word_start = True
                continue
            if c == quote:
                quote = None
            i += 1
            continue

        if stack and (c == ")" or c == "`"):
            live[i] = True
            quote = stack.pop()
            i += 1
            at_word_start = False
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

        if cmd.startswith("$((", i):
            arith += 1
            for k in range(i, i + 3):
                live[k] = True
            i += 3
            at_word_start = False
            continue

        if arith and cmd.startswith("))", i):
            arith -= 1
            live[i] = live[i + 1] = True
            i += 2
            at_word_start = False
            continue

        if c == "<" and cmd.startswith("<<<", i):
            for k in range(i, i + 3):
                live[k] = True
            i += 3
            at_word_start = False
            continue

        if c == "<" and not arith:
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


def mention_count(cmd, subcommand, depth=0):
    """How many `gh pr <sub>` occurrences sit in live shell code."""
    _, live = scan(cmd)
    pattern = re.compile(r"\bgh\b[^;&|()\n]*?\bpr\b[^;&|()\n]*?\b(?:%s)\b" % subcommand)
    count = sum(1 for m in pattern.finditer(cmd)
                if all(live[k] for k in range(m.start(), m.end()) if cmd[k] != "\n"))
    tokens = tokenize(cmd)
    if tokens and depth < MAX_NESTING:
        for payload in shell_payloads(tokens):
            count += mention_count(payload, subcommand, depth + 1)
    return count


def mentions(cmd, subcommand, depth=0):
    """True when `gh pr <subcommand>` appears in live shell code.

    Deliberately blunt: it catches occurrences the precise parser may not, which
    is exactly what makes a parser gap detectable rather than silent.
    """
    _, live = scan(cmd)
    pattern = re.compile(r"\bgh\b[^;&|()\n]*?\bpr\b[^;&|()\n]*?\b(?:%s)\b" % subcommand)
    for m in pattern.finditer(cmd):
        if all(live[k] for k in range(m.start(), m.end()) if cmd[k] != "\n"):
            return True
    tokens = tokenize(cmd)
    if tokens and depth < MAX_NESTING:
        for payload in shell_payloads(tokens):
            if mentions(payload, subcommand, depth + 1):
                return True
    return False


FD_PREFIX = re.compile(r"(?<![\w>&])(\d+)(?=[<>])")


def _drop_fd_prefixes(text, live):
    """Blank the N in `N>file`, which is a file descriptor and not an argument.

    Adjacency is the whole distinction and shlex loses it: bash reads `2>out` as
    a redirection but `5 > out` as the argument 5 followed by one, so the digit
    can only be dropped while the spacing is still visible.
    """
    out = list(text)
    for m in FD_PREFIX.finditer(text):
        if all(live[k] for k in range(m.start(1), m.end(1)) if k < len(live)):
            for k in range(m.start(1), m.end(1)):
                out[k] = " "
    return "".join(out)


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
    masked, live = scan(cmd)
    text = _drop_fd_prefixes(masked, live).replace("`", " ` ")
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
    arguments, not a keyword. Leading redirections and assignments are prefixes,
    so `> out gh pr merge 5` is still a command."""
    j = i - 1
    while j >= 0:
        if ASSIGNMENT.match(tokens[j]):
            j -= 1
            continue
        if (j >= 1 and not is_punctuation(tokens[j]) and is_punctuation(tokens[j - 1])
                and set(tokens[j - 1]) <= REDIRECT):
            j -= 2
            continue
        if is_punctuation(tokens[j]):
            return True
        if tokens[j] in KEYWORDS:
            j -= 1
            continue
        return False
    return True


def _skip_flags(tokens, j, value_flags):
    while j < len(tokens) and tokens[j].startswith("-"):
        if tokens[j] in value_flags:
            j += 2
        else:
            j += 1
    return j


def _matches(tokens, i, wanted):
    """`gh [global flags] pr [flags] <sub>`. Returns (end index, pre-sub flags) or None.

    gh accepts its own options before the subcommand, so `gh --repo a/b pr merge 42`
    is a real merge that a contiguous match would miss entirely.
    """
    if tokens[i] != "gh":
        return None
    j = _skip_flags(tokens, i + 1, GH_VALUE_FLAGS)
    if j >= len(tokens) or tokens[j] != "pr":
        return None
    pre = [t for t in tokens[i + 1:j]]
    j = _skip_flags(tokens, j + 1, GH_VALUE_FLAGS)
    if j >= len(tokens) or tokens[j] not in wanted:
        return None
    return j + 1, pre


def shell_payloads(tokens):
    """Script text run by a child shell or by eval, which the outer parse sees as data."""
    out = []
    for i, tok in enumerate(tokens):
        if not _at_command_position(tokens, i):
            continue
        if tok == "eval":
            j = i + 1
            argv = []
            while j < len(tokens) and not is_punctuation(tokens[j]):
                argv.append(tokens[j])
                j += 1
            if argv:
                out.append(" ".join(argv))
            continue
        if tok not in SHELLS:
            continue
        j = i + 1
        while j < len(tokens) and tokens[j].startswith("-"):
            if "c" in tokens[j].lstrip("-") and j + 1 < len(tokens):
                out.append(tokens[j + 1])
                break
            j += 1
    return out


def _collect(tokens, j):
    """Arguments of one invocation, skipping redirections and their operands.

    `gh pr merge 2>/tmp/out` merges the current branch's PR; the `2` is a file
    descriptor, not PR 2.
    """
    argv = []
    while j < len(tokens):
        tok = tokens[j]
        if is_punctuation(tok):
            if set(tok) <= REDIRECT:
                j += 2
                continue
            break
        argv.append(tok)
        j += 1
    return argv


def _invocations(cmd, wanted, token, depth):
    """(argv, bypassed) for every real invocation, recursing into `sh -c` payloads."""
    tokens = tokenize(cmd)
    if tokens is None:
        return None
    found = []
    for i in range(len(tokens)):
        m = _matches(tokens, i, wanted)
        if not m or not _at_command_position(tokens, i):
            continue
        end, pre = m
        bypassed = False
        j = i - 1
        while j >= 0 and ASSIGNMENT.match(tokens[j]):
            bypassed = bypassed or tokens[j] == token
            j -= 1
        found.append((pre + _collect(tokens, end), bypassed))
    if depth < MAX_NESTING:
        for payload in shell_payloads(tokens):
            nested = _invocations(payload, wanted, token, depth + 1)
            if nested is None:
                return None
            found.extend(nested)
    return found


def invocations(cmd, subcommand, bypass_token=None):
    """Argument tokens of every real `gh pr <subcommand>`, one list each.

    Returns None when the command will not parse, which callers must treat as
    unknown rather than as none.
    """
    found = _invocations(cmd, set(subcommand.split("|")), bypass_token, 0)
    return None if found is None else [argv for argv, _ in found]


def invocations_with_bypass(cmd, subcommand, token):
    """As `invocations`, but each entry is (argv, bypassed-by-its-own-assignment)."""
    return _invocations(cmd, set(subcommand.split("|")), token, 0)


def invokes(cmd, subcommand):
    """True when `cmd` runs `gh pr <subcommand>`, or when it may and we cannot tell."""
    found = invocations(cmd, subcommand)
    if found:
        return True
    return mentions(cmd, subcommand)


def bypasses(cmd, token, subcommand):
    """True when every real invocation carries `token` as its own assignment.

    Per invocation, not per command: `PR_CERTIFY_BYPASS=1 gh pr merge 1; gh pr
    merge 2` bypasses only the first, so the command as a whole is not bypassed.
    """
    found = invocations_with_bypass(cmd, subcommand, token)
    return bool(found) and all(bypassed for _, bypassed in found)


def read_payload():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def emit(event, **fields):
    fields["hookEventName"] = event
    json.dump({"hookSpecificOutput": fields}, sys.stdout)
    sys.stdout.write("\n")
