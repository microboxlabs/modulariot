"""File formats of the editable layers: how an item's title, content and
metadata are stored, and read back."""

from __future__ import annotations

import re
from typing import Any

import yaml

_SEGMENT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.@-]{0,127}$")


def safe_segment(value: str | None) -> str | None:
    """`value` when it can be one path component (a tenant, connection or item
    id), else None."""
    text = (value or "").strip()
    if not _SEGMENT_RE.match(text) or ".." in text:
        return None
    return text


def split_raw_frontmatter(text: str) -> tuple[str, str]:
    """(the frontmatter block with its fences, the body). No block → ("", text)."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return "", text.strip()
    closing = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    if closing is None:
        return "", text.strip()
    return "\n".join(lines[: closing + 1]), "\n".join(lines[closing + 1 :]).strip()


def split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    head, body = split_raw_frontmatter(text)
    if not head:
        return {}, body
    front = yaml.safe_load("\n".join(head.splitlines()[1:-1])) or {}
    if not isinstance(front, dict):
        raise ValueError("frontmatter is not a mapping")
    return front, body


def with_frontmatter(front: dict[str, Any], body: str) -> str:
    fm = yaml.safe_dump(front, sort_keys=False, allow_unicode=True)
    return f"---\n{fm}---\n\n{body.strip()}\n"


def compose_rule(title: str, content: str) -> str:
    return with_frontmatter({"title": title.strip()}, content)


def parse_rule(text: str, default_title: str) -> tuple[str, str, dict[str, Any]]:
    front, body = split_frontmatter(text)
    title = str(front.pop("title", "") or default_title).strip()
    return title, body, front


def compose_skill(skill_id: str, title: str, content: str, meta: dict[str, Any]) -> str:
    front = {**meta, "name": skill_id, "description": title.strip() or skill_id}
    return with_frontmatter(front, content)


def parse_skill(text: str, default_title: str) -> tuple[str, str, dict[str, Any]]:
    front, body = split_frontmatter(text)
    front.pop("name", None)
    title = str(front.pop("description", "") or default_title).strip()
    return title, body, front


EVAL_KEYS = ("question", "expectation", "expect_skill", "expect_no_skill", "checks")
_EVAL_FILE_KEYS = frozenset((*EVAL_KEYS, "source"))


def _eval_text(key: str, value: Any) -> str:
    if isinstance(value, (dict, list)):
        raise ValueError(f"an eval case's {key} must be text")
    return "" if value is None else str(value).strip()


def eval_fields(text: str) -> dict[str, Any] | None:
    """`text` as an eval case's fields when it is a YAML mapping that names any
    of `EVAL_KEYS`; None for plain text (an expectation)."""
    try:
        doc = yaml.safe_load(text)
    except yaml.YAMLError:
        return None
    if not isinstance(doc, dict) or not set(EVAL_KEYS) & set(doc):
        return None
    return doc


def compose_eval(title: str, content: str, meta: dict[str, Any]) -> str:
    """An eval case: question and expectation, then whatever else the case
    carries (checks, source, expected skills). `content` is the expectation,
    or a YAML mapping of `EVAL_KEYS`."""
    fields = eval_fields(content)
    if fields is not None:
        unknown = sorted(str(k) for k in fields if k not in EVAL_KEYS)
        if unknown:
            raise ValueError(
                f"unknown eval case keys {', '.join(unknown)}; use {', '.join(EVAL_KEYS)}"
            )
        question = _eval_text("question", fields.pop("question", None))
        if title.strip() and question and question != title.strip():
            raise ValueError("the content's question differs from the title")
        title = title.strip() or question
        content = _eval_text("expectation", fields.pop("expectation", None))
        meta = {**meta, **fields}
    doc: dict[str, Any] = {"question": title.strip(), "expectation": content.strip()}
    doc.update((k, v) for k, v in meta.items() if k not in doc and v not in (None, "", [], {}))
    return str(yaml.safe_dump(doc, sort_keys=False, allow_unicode=True))


def check_eval(text: str) -> None:
    """Refuse an eval file with unknown keys, non-text question or expectation,
    or an expectation that holds a whole eval case."""
    doc = yaml.safe_load(text) or {}
    if not isinstance(doc, dict):
        raise ValueError("an eval case must be a YAML mapping")
    unknown = sorted(str(k) for k in doc if k not in _EVAL_FILE_KEYS)
    if unknown:
        raise ValueError(f"unknown eval case keys {', '.join(unknown)}; use {', '.join(EVAL_KEYS)}")
    _eval_text("question", doc.get("question"))
    if eval_fields(_eval_text("expectation", doc.get("expectation"))) is not None:
        raise ValueError(
            "the expectation holds a whole eval case; write question and expectation "
            "as top-level keys"
        )


def parse_eval(text: str) -> tuple[str, str, dict[str, Any]]:
    """(question, expectation, the rest). An expectation that holds a whole
    eval case (an old write) is read as that case."""
    doc = yaml.safe_load(text) or {}
    if not isinstance(doc, dict):
        raise ValueError("an eval case must be a YAML mapping")
    title = str(doc.pop("question", "") or "").strip()
    content = str(doc.pop("expectation", "") or "").strip()
    nested = eval_fields(content)
    if nested is not None and str(nested.get("question") or "").strip() in ("", title):
        content = str(nested.pop("expectation", "") or "").strip()
        nested.pop("question", None)
        doc.update((k, v) for k, v in nested.items() if k in EVAL_KEYS and k not in doc)
    return title, content, doc
