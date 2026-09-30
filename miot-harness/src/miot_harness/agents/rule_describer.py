"""Plain-language descriptions of symptom rules (CEL expressions)."""

from __future__ import annotations

import html
import re
from collections.abc import Awaitable, Callable

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from miot_harness.agents.chat_models import response_text

RuleDescriber = Callable[[str, str, dict[str, str], str], Awaitable[str]]

MAX_DESCRIPTION_CHARS = 600
_ALLOWED_TAGS = frozenset({"b", "i", "mark"})
_TAG = re.compile(r"<(/?)([a-zA-Z]+)>")
_ENTITY = re.compile(r"&(?:[a-zA-Z]{2,8}|#[0-9]{1,6}|#x[0-9a-fA-F]{1,6});")

_SYSTEM_PROMPT = (
    "You explain monitoring rules to the owner of a logistics control tower. "
    "The owner is not a developer. You receive one rule written in CEL, the "
    "section of the symptom it belongs to, and a list of fields with their "
    "human labels. Reply with one or two short sentences that say what the "
    "rule does, in the language of the given locale. "
    "Name fields only by their human labels. Never show CEL syntax, operators, "
    "field paths or code. "
    "You may use only the HTML tags <b>, <i> and <mark>, without attributes, "
    "to highlight conditions and values. No other markup, no Markdown, no "
    "quotes around the answer, no prefix."
)

_SECTION_HINTS = {
    "activation": "decides when the symptom is evaluated for a record",
    "measure": "computes the value that is measured",
    "lifecycle.open": "decides when a case is opened",
    "lifecycle.close": "decides when an open case is closed",
}


def _section_hint(section: str) -> str:
    if section.startswith("levels."):
        return (
            f"is the condition for severity level {section.removeprefix('levels.')}, "
            "over the measured value and how long it has lasted"
        )
    return _SECTION_HINTS.get(section, "is part of the symptom definition")


def build_rule_describer(model: BaseChatModel) -> RuleDescriber:
    async def describe(section: str, rule: str, fields: dict[str, str], locale: str) -> str:
        field_lines = "\n".join(f"- {path}: {label}" for path, label in fields.items())
        prompt = (
            f"Locale: {locale}\n"
            f"Section: {section} (this rule {_section_hint(section)})\n"
            f"Fields:\n{field_lines or '- (none)'}\n\n"
            f"Rule:\n{rule}"
        )
        response = await model.ainvoke(
            [SystemMessage(content=_SYSTEM_PROMPT), HumanMessage(content=prompt)]
        )
        cleaned = sanitize_description(response_text(response))
        if not cleaned:
            raise ValueError("rule describer returned nothing")
        return cleaned

    return describe


def sanitize_description(text: str) -> str:
    """Keeps bare <b>, <i> and <mark> tags, escapes everything else and caps
    the text at MAX_DESCRIPTION_CHARS. Character references such as &lt; are
    kept, so sanitizing twice changes nothing. Tags left open are closed."""
    text = text.strip()
    out: list[str] = []
    open_tags: list[str] = []
    length = 0
    pos = 0
    for match in _TAG.finditer(text):
        length = _append_text(out, text[pos : match.start()], length)
        pos = match.end()
        closing, name = match.group(1) == "/", match.group(2).lower()
        if name not in _ALLOWED_TAGS:
            length = _append_text(out, match.group(0), length)
        elif not closing:
            out.append(f"<{name}>")
            open_tags.append(name)
        elif name in open_tags:
            while open_tags:
                tag = open_tags.pop()
                out.append(f"</{tag}>")
                if tag == name:
                    break
    _append_text(out, text[pos:], length)
    out.extend(f"</{tag}>" for tag in reversed(open_tags))
    return "".join(out).strip()


def _append_text(out: list[str], chunk: str, length: int) -> int:
    i = 0
    while i < len(chunk) and length < MAX_DESCRIPTION_CHARS:
        entity = _ENTITY.match(chunk, i) if chunk[i] == "&" else None
        if entity:
            out.append(entity.group(0))
            i = entity.end()
        else:
            out.append(html.escape(chunk[i], quote=False))
            i += 1
        length += 1
    return length
