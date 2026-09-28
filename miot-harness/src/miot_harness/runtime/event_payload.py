"""Bounded, redacted copies of tool arguments and results for run events.

Every tool event carries what the tool was called with and a preview of what
it returned, so a finished run can be inspected later. Values under a
secret-looking key and base64 blobs never reach the event.
"""

from __future__ import annotations

import json
import re
from typing import Any

from miot_harness.utils.truncation import truncate_for_trace

ARGS_BYTES_CAP = 4096
PREVIEW_BYTES_CAP = 2048
REDACTED = "[redacted]"

_SECRET_KEY = re.compile(
    r"password|passwd|token(?!s)|secret|dsn|authorization|api[_-]?key|credential",
    re.IGNORECASE,
)
_DATA_URI = re.compile(r"^data:[\w.+-]+/[\w.+-]+;base64,", re.IGNORECASE)
_BASE64 = re.compile(r"^[A-Za-z0-9+/_-]+={0,2}$")
_BASE64_MIN_CHARS = 256
_URL_CREDENTIALS = re.compile(r"(\b[a-z][a-z0-9+.-]*://)[^\s/@:]+:[^\s/]*@", re.IGNORECASE)
# When a value is too big, strings and lists are shortened to these sizes
# before the last-resort byte cut.
_STRING_CHARS_CAP = 1000
_LIST_ITEMS_CAP = 20


def scrub_text(text: str) -> str:
    """Remove `user:password@` from URLs inside free text (error messages)."""
    return _URL_CREDENTIALS.sub(r"\1***@", text)


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: REDACTED if _SECRET_KEY.search(str(key)) else redact(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact(item) for item in value]
    if isinstance(value, str):
        if _DATA_URI.match(value) or (len(value) >= _BASE64_MIN_CHARS and _BASE64.match(value)):
            return f"[base64, {len(value)} characters]"
        return scrub_text(value)
    return value


def _shorten(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _shorten(item) for key, item in value.items()}
    if isinstance(value, list):
        items = [_shorten(item) for item in value[:_LIST_ITEMS_CAP]]
        if len(value) > _LIST_ITEMS_CAP:
            items.append(f"… {len(value) - _LIST_ITEMS_CAP} more")
        return items
    if isinstance(value, str) and len(value) > _STRING_CHARS_CAP:
        return value[:_STRING_CHARS_CAP] + f"… ({len(value)} characters)"
    return value


def _encoded(value: Any) -> bytes | None:
    try:
        return json.dumps(value, default=str, ensure_ascii=False).encode("utf-8")
    except (TypeError, ValueError):
        return None


def bounded(value: Any, cap: int) -> tuple[Any, bool]:
    """`(value, truncated)`: the redacted value when its JSON fits in `cap`
    bytes, else a shortened copy, else its JSON cut to `cap` bytes."""
    clean = redact(value)
    encoded = _encoded(clean)
    if encoded is None:
        return None, True
    if len(encoded) <= cap:
        return clean, False
    short = _shorten(clean)
    encoded = _encoded(short) or b""
    if len(encoded) <= cap:
        return short, True
    return encoded[:cap].decode("utf-8", errors="ignore"), True


def args_payload(args: dict[str, Any]) -> dict[str, Any]:
    value, truncated = bounded(args, ARGS_BYTES_CAP)
    payload: dict[str, Any] = {"args": value}
    if truncated:
        payload["args_truncated"] = True
    return payload


def preview_payload(output: Any) -> dict[str, Any]:
    capped, info = truncate_for_trace(output)
    value, truncated = bounded(capped, PREVIEW_BYTES_CAP)
    payload: dict[str, Any] = {"preview": value}
    if truncated or info.get("truncated"):
        payload["preview_truncated"] = True
    return payload
