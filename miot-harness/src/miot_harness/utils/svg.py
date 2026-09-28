"""Allow-list check for SVG shown to users: shapes and text only."""

from __future__ import annotations

import re

import defusedxml.ElementTree as SafeET

_LOCAL_REF = re.compile(r"url\(\s*#[\w.:-]+\s*\)")


class SvgError(ValueError):
    pass


def _local(tag: object) -> str:
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def check_svg(svg: str, *, tags: frozenset[str]) -> None:
    """Refuse elements outside `tags`, event handlers, links and any `url()`
    that points outside the document."""
    try:
        root = SafeET.fromstring(svg, forbid_dtd=True)
    except Exception as exc:  # noqa: BLE001 — ParseError and defusedxml refusals alike
        raise SvgError(f"not a readable SVG document: {exc}") from exc
    if _local(root.tag) != "svg":
        raise SvgError("the document root is not <svg>")
    for el in root.iter():
        if _local(el.tag) not in tags:
            raise SvgError(f"unexpected SVG element {_local(el.tag)!r}")
        for key, value in el.attrib.items():
            name = _local(key).lower()
            if name.startswith("on") or "href" in name:
                raise SvgError(f"unexpected SVG attribute {name!r}")
            if "url(" in _LOCAL_REF.sub("", value):
                raise SvgError("SVG references outside the document")
