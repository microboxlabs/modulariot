"""Render the canonical Markdown answer into a caller-selected format.

The harness response is always JSON; only the `answer` string's content is
transformed here. Markdown is the canonical source produced by the agents.
All functions are pure and deterministic (no LLM, no network) so they are
fully unit-testable. `render_answer` never raises: on any renderer error it
returns the raw Markdown so a formatting glitch can never fail a run.
"""

from __future__ import annotations

import html as _html
import logging
import re
from collections.abc import Callable
from xml.sax.saxutils import escape as _xml_escape

import markdown as _markdown  # type: ignore[import-untyped]
import yaml as _yaml

logger = logging.getLogger(__name__)

_TAG_RE = re.compile(r"<[^>]+>")


def _to_html(text: str) -> str:
    return str(_markdown.markdown(text))


def _to_plain(text: str) -> str:
    stripped = _TAG_RE.sub("", _markdown.markdown(text))
    return _html.unescape(stripped).strip()


def _to_xml(text: str) -> str:
    return f'<answer format="markdown">{_xml_escape(text)}</answer>'


def _to_yaml(text: str) -> str:
    return str(_yaml.safe_dump({"answer": text}, allow_unicode=True, sort_keys=False))


# Markdown is the identity case and is handled inline in render_answer.
_RENDERERS: dict[str, Callable[[str], str]] = {
    "html": _to_html,
    "plain": _to_plain,
    "xml": _to_xml,
    "yaml": _to_yaml,
}


def render_answer_with_format(markdown_text: str | None, fmt: str) -> tuple[str | None, str]:
    """Render `markdown_text` as `fmt`, returning (result, effective_fmt).

    `effective_fmt` is `fmt` only when the result is genuinely in that format.
    It is "markdown" whenever the result is the raw Markdown string — an
    unknown format or a renderer-error fallback — so callers can echo a format
    that actually matches the bytes they return. A None answer preserves the
    requested `fmt` (there is no string to mislabel).
    """
    if markdown_text is None:
        return None, fmt
    if fmt == "markdown":
        return markdown_text, "markdown"
    renderer = _RENDERERS.get(fmt)
    if renderer is None:
        return markdown_text, "markdown"
    try:
        return renderer(markdown_text), fmt
    except Exception:  # noqa: BLE001 — rendering must never fail a run
        logger.exception("answer render failed for format=%s; using raw markdown", fmt)
        return markdown_text, "markdown"


def render_answer(markdown_text: str | None, fmt: str) -> str | None:
    """Return `markdown_text` rendered as `fmt`.

    `None` passes through as `None`. `markdown` and any unrecognised format
    return the input unchanged. Renderer exceptions fall back to the raw
    Markdown (logged), never propagating.
    """
    return render_answer_with_format(markdown_text, fmt)[0]
