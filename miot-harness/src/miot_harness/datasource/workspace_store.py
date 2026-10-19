"""What the agent learns about a connection, kept as files next to it.

Two kinds of entries, per tenant:

- **notes** (`memory/<tenant>/<id>.md`): definitions the user confirmed, facts
  about the data, preferences. Markdown with a YAML header.
- **analyses** (`analyses/<tenant>/<name>.sql`): named, parameterized SELECTs
  the agent wrote and tested, to answer a recurring question again without
  rediscovering the schema. `:name` placeholders are bound from typed
  parameters.

Files are read on every call, so an entry written in one conversation is
visible in the next one without a restart.
"""

from __future__ import annotations

import os
import re
import tempfile
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import yaml

from miot_harness.datasource.knowledge.writer import _reject_if_secretish, slug_card_id

NOTE_KINDS = ("definition", "fact", "preference")
PARAM_TYPES = ("text", "int", "numeric", "date", "timestamptz", "bool")
MAX_BODY_CHARS = 4000
MAX_SQL_CHARS = 20000
# `:name` outside a `::cast`; only matched in SQL code, see _code_spans
_PLACEHOLDER_RE = re.compile(r"(?<![:\w]):([A-Za-z_]\w*)")
# Where SQL code stops being code: a string, a quoted identifier, a comment,
# or a dollar-quoted body.
_SKIP_RE = re.compile(
    r"'(?:[^']|'')*'"
    r'|"(?:[^"]|"")*"'
    r"|--[^\n]*"
    r"|/\*.*?\*/"
    r"|(\$[A-Za-z_]*\$).*?\1",
    re.DOTALL,
)
_INT_RE = re.compile(r"^-?\d+$")
_NUMERIC_RE = re.compile(r"^-?\d+(\.\d+)?$")
_HEADER_RE = re.compile(r"^/\*---\n(.*?)\n---\*/\n?", re.DOTALL)


def _tenant_dir(root: Path, kind: str, tenant_id: str) -> Path:
    slug = slug_card_id(tenant_id)
    if not slug:
        raise ValueError("a tenant is required")
    return root / kind / slug


def _write_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


# ---------------------------------------------------------------- notes


@dataclass
class Note:
    id: str
    title: str
    kind: str
    body: str
    meta: dict[str, Any] = field(default_factory=dict)


def _parse_note(path: Path) -> Note:
    text = path.read_text(encoding="utf-8")
    meta: dict[str, Any] = {}
    body = text
    if text.startswith("---\n"):
        head, _, body = text[4:].partition("\n---\n")
        loaded = yaml.safe_load(head) or {}
        meta = loaded if isinstance(loaded, dict) else {}
    return Note(
        id=path.stem,
        title=str(meta.pop("title", path.stem)),
        kind=str(meta.pop("kind", "fact")),
        body=body.strip(),
        meta=meta,
    )


def list_notes(root: Path, tenant_id: str) -> list[Note]:
    folder = _tenant_dir(root, "memory", tenant_id)
    if not folder.is_dir():
        return []
    notes = []
    for path in sorted(folder.glob("*.md")):
        try:
            notes.append(_parse_note(path))
        except (OSError, ValueError, yaml.YAMLError):
            continue
    return notes


def read_note(root: Path, tenant_id: str, note_id: str) -> Note | None:
    path = _tenant_dir(root, "memory", tenant_id) / f"{slug_card_id(note_id)}.md"
    return _parse_note(path) if path.is_file() else None


def write_note(
    root: Path,
    tenant_id: str,
    *,
    title: str,
    body: str,
    kind: str,
    author: str,
    conversation_id: str | None,
) -> Note:
    """Create or replace a note; its id is the slug of the title."""
    note_id = slug_card_id(title)
    if not note_id:
        raise ValueError("a note needs a title")
    if kind not in NOTE_KINDS:
        raise ValueError(f"kind must be one of {', '.join(NOTE_KINDS)}")
    body = body.strip()
    if not body or len(body) > MAX_BODY_CHARS:
        raise ValueError(f"a note body must have 1 to {MAX_BODY_CHARS} characters")
    _reject_if_secretish(body)
    path = _tenant_dir(root, "memory", tenant_id) / f"{note_id}.md"
    created = _now()
    if path.is_file():
        created = str(_parse_note(path).meta.get("created", created))
    meta = {
        "title": title.strip(),
        "kind": kind,
        "author": author,
        "conversation": conversation_id,
        "created": created,
        "updated": _now(),
    }
    _write_atomic(
        path, f"---\n{yaml.safe_dump(meta, allow_unicode=True, sort_keys=False)}---\n{body}\n"
    )
    return _parse_note(path)


# ---------------------------------------------------------------- analyses


@dataclass
class Analysis:
    name: str
    description: str
    sql: str
    params: list[dict[str, Any]]
    meta: dict[str, Any] = field(default_factory=dict)


def _parse_analysis(path: Path) -> Analysis:
    text = path.read_text(encoding="utf-8")
    match = _HEADER_RE.match(text)
    meta: dict[str, Any] = {}
    sql = text
    if match:
        loaded = yaml.safe_load(match.group(1)) or {}
        meta = loaded if isinstance(loaded, dict) else {}
        sql = text[match.end() :]
    params = meta.pop("params", []) or []
    return Analysis(
        name=path.stem,
        description=str(meta.pop("description", "")),
        sql=sql.strip(),
        params=[p for p in params if isinstance(p, dict)],
        meta=meta,
    )


def _code_spans(sql: str) -> list[tuple[int, int]]:
    """(start, end) of the parts of `sql` that are code, not literals or comments."""
    spans, pos = [], 0
    for match in _SKIP_RE.finditer(sql):
        spans.append((pos, match.start()))
        pos = match.end()
    spans.append((pos, len(sql)))
    return spans


def placeholders(sql: str) -> set[str]:
    """The `:name` parameters the SQL uses in code."""
    return {
        m.group(1)
        for start, end in _code_spans(sql)
        for m in _PLACEHOLDER_RE.finditer(sql, start, end)
    }


def validate_params(params: list[dict[str, Any]], sql: str) -> list[dict[str, Any]]:
    """Check each declared parameter and that the SQL uses exactly those names."""
    clean: list[dict[str, Any]] = []
    for p in params:
        name = str(p.get("name", ""))
        if not re.fullmatch(r"[A-Za-z_]\w*", name):
            raise ValueError(f"invalid parameter name {name!r}")
        kind = str(p.get("type", "text"))
        if kind not in PARAM_TYPES:
            raise ValueError(f"parameter {name}: type must be one of {', '.join(PARAM_TYPES)}")
        entry: dict[str, Any] = {"name": name, "type": kind}
        if p.get("description"):
            entry["description"] = str(p["description"])
        if "default" in p and p["default"] is not None:
            entry["default"] = p["default"]
        clean.append(entry)
    declared = {p["name"] for p in clean}
    used = placeholders(sql)
    if used - declared:
        raise ValueError(
            f"the SQL uses undeclared parameters: {', '.join(sorted(used - declared))}"
        )
    if declared - used:
        raise ValueError(
            f"declared parameters not used in the SQL: {', '.join(sorted(declared - used))}"
        )
    return clean


def _is_date(text: str) -> bool:
    try:
        date.fromisoformat(text)
    except ValueError:
        return False
    return True


def _is_timestamp(text: str) -> bool:
    try:
        datetime.fromisoformat(text)
    except ValueError:
        return False
    return True


# type -> (accepts the text, renders it as SQL, what the error calls it)
_LITERALS: dict[str, tuple[Any, Any, str]] = {
    "int": (lambda t: bool(_INT_RE.match(t)), lambda t: t, "an integer"),
    "numeric": (lambda t: bool(_NUMERIC_RE.match(t)), lambda t: t, "a number"),
    "bool": (lambda t: t.lower() in ("true", "false"), lambda t: t.upper(), "true or false"),
    "date": (_is_date, lambda t: f"DATE '{t}'", "a date (YYYY-MM-DD)"),
    "timestamptz": (_is_timestamp, lambda t: f"TIMESTAMPTZ '{t}'", "an ISO timestamp"),
    "text": (lambda t: True, lambda t: "'" + t.replace("'", "''") + "'", "text"),
}


def _literal(kind: str, value: Any, name: str) -> str:
    if value is None:
        return "NULL"
    text = str(value).strip()
    accepts, render, expected = _LITERALS.get(kind, _LITERALS["text"])
    if not accepts(text):
        raise ValueError(f"parameter {name}: {value!r} is not {expected}")
    rendered: str = render(text)
    return rendered


def bind(sql: str, params: list[dict[str, Any]], args: dict[str, Any]) -> str:
    """Replace each `:name` with a typed SQL literal; missing args use defaults."""
    kinds = {p["name"]: p["type"] for p in params}
    unknown = set(args) - set(kinds)
    if unknown:
        raise ValueError(f"unknown arguments: {', '.join(sorted(unknown))}")
    values = {p["name"]: args.get(p["name"], p.get("default")) for p in params}

    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        return _literal(kinds[name], values[name], name)

    out, pos = [], 0
    for start, end in _code_spans(sql):
        out.append(sql[pos:start])
        out.append(_PLACEHOLDER_RE.sub(replace, sql[start:end]))
        pos = end
    return "".join(out)


def list_analyses(root: Path, tenant_id: str) -> list[Analysis]:
    folder = _tenant_dir(root, "analyses", tenant_id)
    if not folder.is_dir():
        return []
    found = []
    for path in sorted(folder.glob("*.sql")):
        try:
            found.append(_parse_analysis(path))
        except (OSError, ValueError, yaml.YAMLError):
            continue
    return found


def read_analysis(root: Path, tenant_id: str, name: str) -> Analysis | None:
    path = _tenant_dir(root, "analyses", tenant_id) / f"{slug_card_id(name).replace('-', '_')}.sql"
    return _parse_analysis(path) if path.is_file() else None


def save_analysis(
    root: Path,
    tenant_id: str,
    *,
    name: str,
    description: str,
    sql: str,
    params: list[dict[str, Any]],
    author: str,
    conversation_id: str | None,
    columns: list[str],
) -> Analysis:
    slug = slug_card_id(name).replace("-", "_")
    if not slug:
        raise ValueError("an analysis needs a name")
    sql = sql.strip().rstrip(";").strip()
    if not sql or len(sql) > MAX_SQL_CHARS:
        raise ValueError(f"the SQL must have 1 to {MAX_SQL_CHARS} characters")
    clean = validate_params(params, sql)
    path = _tenant_dir(root, "analyses", tenant_id) / f"{slug}.sql"
    created = _now()
    version = 1
    if path.is_file():
        previous = _parse_analysis(path)
        created = str(previous.meta.get("created", created))
        version = int(previous.meta.get("version", 1)) + 1
    meta = {
        "description": description.strip(),
        "params": clean,
        "columns": columns,
        "author": author,
        "conversation": conversation_id,
        "created": created,
        "updated": _now(),
        "version": version,
    }
    header = yaml.safe_dump(meta, allow_unicode=True, sort_keys=False).strip()
    _write_atomic(path, f"/*---\n{header}\n---*/\n{sql}\n")
    return _parse_analysis(path)
