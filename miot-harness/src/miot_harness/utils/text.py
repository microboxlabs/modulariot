"""Text helpers for model output."""

from __future__ import annotations

import re

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)


def strip_fences(text: str) -> str:
    """The content of a ```json fence when the text has one, else the text."""
    text = text.strip()
    match = _JSON_FENCE_RE.search(text)
    if match:
        return match.group(1).strip()
    return text
