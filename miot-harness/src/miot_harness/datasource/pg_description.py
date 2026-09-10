"""Parse a PostgreSQL object description (COMMENT ON) into title, body and a
`@meta … @end` key/value block.

Shared by the Nexo introspection and the generic routine catalog: the analysts
annotate functions in this format on every connection.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

_LAYER_PREFIX_RE = re.compile(r"^(L1|L2|L3|VT)\s*:\s*", re.IGNORECASE)
_META_BLOCK_RE = re.compile(r"@meta\s*\n(.*?)\n@end", re.DOTALL)


@dataclass
class ParsedDescription:
    title: str = ""
    body: str = ""
    layer: str = ""  # "L1" | "L2" | "L3" | "VT" | "meta" | ""
    meta: dict[str, str] = field(default_factory=dict)


def parse_pg_description(raw: str | None) -> ParsedDescription:
    if not raw:
        return ParsedDescription()

    text = raw.strip()
    meta: dict[str, str] = {}
    layer = ""
    title = ""
    body = text

    meta_match = _META_BLOCK_RE.search(text)
    if meta_match:
        for line in meta_match.group(1).splitlines():
            line = line.strip()
            if not line or ":" not in line:
                continue
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
        layer = "meta"
        before = text[: meta_match.start()].strip()
        after = text[meta_match.end() :].strip()
        title = before.splitlines()[0].strip() if before else ""
        rest_before = "\n".join(before.splitlines()[1:]).strip()
        body = "\n\n".join(part for part in (rest_before, after) if part)
        return ParsedDescription(title=title, body=body, layer=layer, meta=meta)

    prefix = _LAYER_PREFIX_RE.match(text)
    if prefix:
        layer = prefix.group(1).upper()
        body = text[prefix.end() :].strip()
        return ParsedDescription(title="", body=body, layer=layer, meta={})

    return ParsedDescription(title="", body=text, layer="", meta={})
