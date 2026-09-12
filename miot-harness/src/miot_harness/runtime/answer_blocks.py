"""Typed-block schema for the `json` answer format.

The `json` answer format returns the run's answer as an array of typed blocks
so clients can render multiple, differently-typed pieces of one answer. Two
block types are validated strictly — `markdown` (value is a string) and `url`
(value is an object with string `url` and `name`); any other `type` is accepted
unchanged (passthrough). `to_json_blocks` never raises: it salvages a block array a model
appended after narrating, and on any other failure wraps the raw text as a
single markdown block so a formatting glitch can't fail a run.

Note: `url` block values are NOT scheme-validated — the schema only checks they
are strings — so downstream consumers must sanitize urls as hrefs (reject
`javascript:`, `data:`, etc.).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from pydantic import BaseModel, TypeAdapter, ValidationError, model_validator

logger = logging.getLogger(__name__)

# Match a fenced block: ```json\n...\n``` or ```\n...\n``` (whole string).
_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?(.*?)\n?```$", re.DOTALL)


class AnswerBlock(BaseModel):
    type: str
    value: Any

    @model_validator(mode="after")
    def _validate_known_types(self) -> AnswerBlock:
        if self.type == "markdown":
            if not isinstance(self.value, str):
                raise ValueError("markdown block value must be a string")
        elif self.type == "url":
            v = self.value
            if (
                not isinstance(v, dict)
                or not isinstance(v.get("url"), str)
                or not isinstance(v.get("name"), str)
            ):
                raise ValueError(
                    "url block value must be an object with string 'url' and 'name'"
                )
        # Any other type passes through unchanged.
        return self


_BLOCKS_ADAPTER = TypeAdapter(list[AnswerBlock])


def _strip_fence(raw: str) -> str:
    match = _FENCE_RE.match(raw.strip())
    return match.group(1) if match else raw


def parse_blocks(raw: str) -> list[AnswerBlock]:
    """Parse agent text into a validated list of blocks.

    Strips an optional ```json fence, requires a JSON array, and validates
    known block types. Raises `ValueError` on any failure.
    """
    text = _strip_fence(raw)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"answer is not valid JSON: {exc}") from exc
    if not isinstance(data, list):
        raise ValueError("answer JSON must be an array of blocks")
    try:
        return _BLOCKS_ADAPTER.validate_python(data)
    except ValidationError as exc:
        raise ValueError(f"invalid blocks: {exc}") from exc


# Nesting deep enough to exhaust the stack is not something a model produces on
# purpose, so a handful of recovery attempts is plenty. The cap bounds the cost
# of a shape the bracket-run skip cannot step over in one go, such as `[1,[1,[1…`.
_MAX_DEEP_FAILURES = 4


def _after_bracket_run(text: str, start: int) -> int:
    """The next `[` after the run of brackets and whitespace at `start`."""
    i = start
    while i < len(text) and (text[i] == "[" or text[i].isspace()):
        i += 1
    return text.find("[", i)


def _salvage_trailing_blocks(text: str) -> list[AnswerBlock] | None:
    """The block array a model appended after narrating, or None.

    The contract says the answer is the array and nothing else, but a model
    that thinks out loud writes its reasoning first and the array last. The
    array is intact; only the prose in front of it makes the whole string
    invalid JSON. Take the widest array that runs to the end of the text and
    validates as blocks — a nested array, or one quoted inside prose, does not
    reach the end, and a trailing array of something else fails validation.
    """
    stripped = text.rstrip()
    if not stripped.endswith("]"):
        return None
    decoder = json.JSONDecoder()
    start = stripped.find("[")
    deep_failures = 0
    while start != -1:
        try:
            data, end = decoder.raw_decode(stripped, start)
        except json.JSONDecodeError:
            start = stripped.find("[", start + 1)
            continue
        except RecursionError:
            # `raw_decode` recurses per nesting level and blows the stack past
            # roughly 2,000. Resume after the bracket run that caused it, not
            # one character along: in `[[[[…` the next character opens an array
            # barely shallower, so stepping would recurse once per character.
            deep_failures += 1
            if deep_failures > _MAX_DEEP_FAILURES:
                return None
            start = _after_bracket_run(stripped, start)
            continue
        if end == len(stripped) and isinstance(data, list):
            try:
                return _BLOCKS_ADAPTER.validate_python(data)
            except ValidationError:
                return None
        start = stripped.find("[", start + 1)
    return None


def to_json_blocks(text: str) -> str:
    """Return a clean JSON array string of blocks. Never raises.

    A clean answer parses directly. One a model narrated before — prose, then
    the array — keeps the array and drops the prose. Anything else, including
    text with no array in it at all, is wrapped as a single markdown block.
    """
    try:
        blocks = parse_blocks(text)
        return json.dumps([b.model_dump() for b in blocks], ensure_ascii=False)
    except Exception as exc:  # noqa: BLE001 — formatting must never fail a run
        salvaged = _salvage_trailing_blocks(text)
        if salvaged is not None:
            logger.warning(
                "answer json-blocks had %d chars of prose before the array; "
                "dropped it and kept the blocks",
                len(text) - len(json.dumps([b.model_dump() for b in salvaged])),
            )
            return json.dumps([b.model_dump() for b in salvaged], ensure_ascii=False)
        logger.warning("answer json-blocks parse failed; using markdown fallback: %s", exc)
        return json.dumps([{"type": "markdown", "value": text}], ensure_ascii=False)
