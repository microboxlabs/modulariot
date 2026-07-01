"""Typed-block schema for the `json` answer format.

The `json` answer format returns the run's answer as an array of typed blocks
so clients can render multiple, differently-typed pieces of one answer. Two
block types are validated strictly — `markdown` (value is a string) and `url`
(value is an object with string `url` and `name`); any other `type` is accepted
unchanged (passthrough). `to_json_blocks` never raises: on any failure it wraps
the raw text as a single markdown block so a formatting glitch can't fail a run.

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


def to_json_blocks(text: str) -> str:
    """Return a clean JSON array string of blocks. Never raises.

    On any parse/validate failure, wrap the raw text as a single markdown block.
    """
    try:
        blocks = parse_blocks(text)
        return json.dumps([b.model_dump() for b in blocks], ensure_ascii=False)
    except Exception as exc:  # noqa: BLE001 — formatting must never fail a run
        logger.warning("answer json-blocks parse failed; using markdown fallback: %s", exc)
        return json.dumps([{"type": "markdown", "value": text}], ensure_ascii=False)
