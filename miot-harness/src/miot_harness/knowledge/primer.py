"""Edited data source descriptions (the body of a tenant-locked connection's
`connection.md`), carried into the next run.

A connection's description is part of the system prompt, which is built once
and cached. Rather than rebuild it, a run whose tenant owns an edited
connection gets the current description in its per-run block, marked as
replacing the one in its instructions. The block only changes when the file
does.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path

from miot_harness.knowledge.changes import KnowledgeChange
from miot_harness.knowledge.formats import split_raw_frontmatter

_HEADER = (
    "# Updated data source descriptions\n"
    "These replace the descriptions of the same data sources in your instructions."
)


@dataclass(frozen=True)
class PrimerSource:
    connection: str
    path: Path
    tenant_lock: str
    boot_body: str


class PrimerUpdates:
    def __init__(self, sources: Sequence[PrimerSource]) -> None:
        self.sources = tuple(sorted(sources, key=lambda s: s.connection))
        self._cache: dict[Path, tuple[tuple[int, int], str]] = {}

    def _body(self, path: Path) -> str | None:
        try:
            st = path.stat()
            key = (st.st_mtime_ns, st.st_size)
            cached = self._cache.get(path)
            if cached is not None and cached[0] == key:
                return cached[1]
            body = split_raw_frontmatter(path.read_text(encoding="utf-8"))[1]
        except OSError:
            return None
        self._cache[path] = (key, body)
        return body

    def block(self, tenant_id: str, overlay: Iterable[KnowledgeChange] = ()) -> str:
        edits = {
            c.id: c.content.strip() for c in overlay if c.layer == "primer" and c.op == "upsert"
        }
        sections: list[str] = []
        for source in self.sources:
            if source.tenant_lock != tenant_id:
                continue
            body = edits.get(source.connection, self._body(source.path))
            if body is not None and body != source.boot_body.strip():
                sections.append(f"## {source.connection}\n{body}")
        return "\n\n".join([_HEADER, *sections]) if sections else ""
