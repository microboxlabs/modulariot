"""File-backed knowledge-pack loader + detection + version probe.

Pack file format — one `pack.md` per pack directory:

    ---
    id: alfresco-activiti
    title: Alfresco / Activiti workflow
    fingerprint: [act_ru_task, act_re_procdef, act_hi_procinst]
    version_probe:
      sql: "SELECT value_ FROM act_ge_property WHERE name_ = 'schema.version'"
      label: Activiti schema.version
    ---

    <overview markdown — always loaded>

    ## card: <card-id> · <card title>
    <card body — loaded on demand>

    ## card: <card-id-2> · <card title 2>
    ...

The loader never raises for content errors (mirrors the skills/connections
sources): a bad pack becomes a diagnostic and is skipped.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

import yaml

from miot_harness.datasource.knowledge.models import (
    KnowledgeCard,
    KnowledgePack,
    PackLoadResult,
    VersionProbe,
)
from miot_harness.datasource.safe_query import (
    DEFAULT_STATEMENT_TIMEOUT_MS,
)

logger = logging.getLogger(__name__)

_PACK_FILE = "pack.md"
_CARD_RE = re.compile(r"^##\s*card:\s*([^\s·]+)\s*·\s*(.+?)\s*$", re.MULTILINE)


def _split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("missing opening '---' frontmatter fence")
    closing = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    if closing is None:
        raise ValueError("missing closing '---' frontmatter fence")
    front = yaml.safe_load("\n".join(lines[1:closing])) or {}
    if not isinstance(front, dict):
        raise ValueError("frontmatter is not a mapping")
    body = "\n".join(lines[closing + 1 :]).strip()
    return front, body


def _parse_cards(body: str) -> tuple[str, tuple[KnowledgeCard, ...]]:
    """Split the body into (overview, cards). Overview is everything before the
    first `## card:` header; each card runs to the next header or EOF."""
    matches = list(_CARD_RE.finditer(body))
    if not matches:
        return body.strip(), ()
    overview = body[: matches[0].start()].strip()
    cards: list[KnowledgeCard] = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        card_body = body[m.end() : end].strip()
        cards.append(KnowledgeCard(id=m.group(1).strip(), title=m.group(2).strip(), body=card_body))
    return overview, tuple(cards)


def _parse_pack(text: str, *, default_id: str) -> KnowledgePack:
    front, body = _split_frontmatter(text)
    pack_id = str(front.get("id") or default_id).strip()
    title = str(front.get("title") or pack_id).strip()
    fingerprint = front.get("fingerprint") or []
    if not isinstance(fingerprint, list) or not fingerprint:
        raise ValueError("frontmatter field 'fingerprint' must be a non-empty list")
    probe = None
    raw_probe = front.get("version_probe")
    if raw_probe is not None:
        if not isinstance(raw_probe, dict) or not raw_probe.get("sql"):
            raise ValueError("frontmatter 'version_probe' must have a 'sql' field")
        probe = VersionProbe(
            sql=str(raw_probe["sql"]).strip(),
            label=str(raw_probe.get("label") or "schema version").strip(),
        )
    overview, cards = _parse_cards(body)
    return KnowledgePack(
        id=pack_id,
        title=title,
        fingerprint=tuple(str(t).strip() for t in fingerprint),
        overview=overview,
        cards=cards,
        version_probe=probe,
    )


def load_packs(packs_dir: Path) -> PackLoadResult:
    """Load all packs under `packs_dir`. Never raises; bad packs → diagnostics."""
    packs: list[KnowledgePack] = []
    diagnostics: list[str] = []
    if not packs_dir.exists():
        return PackLoadResult((), (f"packs dir does not exist: {packs_dir}",))
    for path in sorted(packs_dir.rglob(_PACK_FILE)):
        try:
            pack = _parse_pack(path.read_text(encoding="utf-8"), default_id=path.parent.name)
        except (ValueError, OSError) as exc:
            diagnostics.append(f"{path}: {exc}")
            continue
        packs.append(pack)
    return PackLoadResult(tuple(packs), tuple(diagnostics))


def detect_packs(
    table_names: frozenset[str], packs: tuple[KnowledgePack, ...]
) -> list[KnowledgePack]:
    """Return packs whose fingerprint is fully present in the schema."""
    return [p for p in packs if p.matches(table_names)]


async def probe_version(
    *,
    pool: object,
    probe: VersionProbe,
    schemas: tuple[str, ...],
    statement_timeout_ms: int | None = DEFAULT_STATEMENT_TIMEOUT_MS,
) -> str | None:
    """Run a pack's version probe schema-relative (search_path set to the
    connection's schemas) and return the first value as a string, or None."""
    if not schemas:
        return None
    # search_path makes the pack's bare table names resolve in the connection's
    # schema(s) without the pack needing to know the schema name. Quote each
    # schema id defensively (operator config, but never interpolate raw).
    search_path = ", ".join('"' + s.replace('"', '""') + '"' for s in schemas)
    async with pool.acquire() as conn:  # type: ignore[attr-defined]
        async with conn.transaction(readonly=True):
            if statement_timeout_ms:
                await conn.execute(
                    f"SET LOCAL statement_timeout = {int(statement_timeout_ms)}"
                )
            await conn.execute(f"SET LOCAL search_path = {search_path}")
            rows = await conn.fetch(probe.sql)
    if not rows:
        return None
    first = rows[0]
    value = next(iter(first.values())) if hasattr(first, "values") else first[0]
    return None if value is None else str(value)
