"""Read and write one tenant's editable knowledge, with versions.

| layer  | live file                                          | history key                 |
|--------|----------------------------------------------------|-----------------------------|
| fact   | `<connection dir>/knowledge/<id>.md`               | `fact/<connection>/<id>`    |
| rule   | `<context_dir>/tenants/<T>/learned/<id>.md`        | `rule/<T>/<id>`             |
| skill  | `<skills_dir>/tenants/<T>/learned/<id>/SKILL.md`   | `skill/<T>/<id>`            |
| primer | `<connection dir>/connection.md` (body only)       | `primer/<connection>`       |
| note   | `<connection dir>/memory/<T>/<id>.md`              | `note/<connection>/<T>/<id>`|
| eval   | `<root>/evals/tenants/<T>/<id>.yaml`               | `eval/<T>/<id>`             |

Every write, delete and revert appends a version under
`<root>/.history/<history key>/`: `NNNN.md` holds the whole file (absent for a
delete) and `NNNN.json` who wrote it, when and why. A live file that no longer
matches its last version (edited by hand, or by an older endpoint) is recorded
as a version of its own before the next write, so nothing is lost.
"""

from __future__ import annotations

import json
import os
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

from miot_harness.datasource.knowledge.loader import _parse_connection_card
from miot_harness.datasource.knowledge.writer import (
    ConnectionCardWrite,
    _reject_if_secretish,
    render_connection_card,
    slug_card_id,
)
from miot_harness.datasource.workspace_store import _write_atomic
from miot_harness.knowledge.changes import LAYERS
from miot_harness.knowledge.formats import (
    compose_eval,
    compose_rule,
    compose_skill,
    parse_eval,
    parse_rule,
    parse_skill,
    safe_segment,
    split_frontmatter,
    split_raw_frontmatter,
)
from miot_harness.knowledge.tenant_overlays import (
    SKILL_FILE,
    TENANTS_DIR,
    is_learned_path,
    learned_dir,
)

LABELS = {
    "fact": "Data facts",
    "rule": "Rules and glossary",
    "skill": "Procedures",
    "primer": "Data source descriptions",
    "note": "Agent notes",
    "eval": "Evaluation cases",
}
EDITABLE = frozenset({"fact", "rule", "skill", "primer", "eval"})
_SAFETY_CHECKED = frozenset({"fact", "rule", "skill", "primer"})
_TARGETED = frozenset({"fact", "note"})
_HISTORY = ".history"
_EXTERNAL_REASON = "changed outside the knowledge store"


class KnowledgeError(Exception):
    def __init__(self, status: int, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail


@dataclass(frozen=True)
class ConnectionTarget:
    """A connection whose knowledge a tenant may edit. `dir` holds its
    `connection.md`; `cards` is whether it takes learned facts."""

    name: str
    dir: Path
    tenant_lock: str | None
    cards: bool


@dataclass(frozen=True)
class _Loc:
    layer: str
    id: str
    target: str | None
    live: Path
    history: Path


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def _inside(base: Path, *parts: str) -> Path:
    root = os.path.realpath(base)
    path = os.path.realpath(os.path.join(root, *parts))
    if not path.startswith(root + os.sep):
        raise KnowledgeError(400, "path escapes its layer directory")
    return Path(path)


def _compose_fact(
    item_id: str,
    title: str,
    content: str,
    meta: dict[str, Any],
    author: str,
    provenance: dict[str, Any] | None,
) -> str:
    card = ConnectionCardWrite(
        term=str(meta.get("term") or title or item_id),
        body=content,
        kind=str(meta.get("kind") or ""),
        title=title,
        scope=str(meta.get("scope") or "tenant"),
        status=str(meta.get("status") or "approved"),
        confidence=meta.get("confidence"),
        card_id=item_id,
        approved_by=author,
        provenance=provenance or None,
    )
    try:
        return render_connection_card(card)
    except ValueError as exc:
        raise KnowledgeError(400, str(exc)) from exc


def _check_primer(connection: str, text: str, current: str | None) -> None:
    if current is None:
        raise KnowledgeError(404, f"connection {connection!r} has no description file")
    if split_raw_frontmatter(text)[0] != split_raw_frontmatter(current)[0]:
        raise KnowledgeError(400, "a data source's frontmatter is not editable")


def _read(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except (FileNotFoundError, NotADirectoryError):
        return None


class KnowledgeStore:
    def __init__(
        self,
        *,
        tenant_id: str,
        root: Path,
        context_dir: Path,
        skills_dir: Path,
        connections: Sequence[ConnectionTarget] = (),
    ) -> None:
        tenant = safe_segment(tenant_id)
        if tenant is None:
            raise KnowledgeError(400, "a valid tenant is required")
        self.tenant = tenant
        self.root = Path(root)
        self.context_dir = Path(context_dir)
        self.skills_dir = Path(skills_dir)
        self.connections = {c.name: c for c in connections}

    # ---- targets ----------------------------------------------------------

    def _usable(self, conn: ConnectionTarget) -> bool:
        return conn.tenant_lock in (None, self.tenant)

    def targets(self, layer: str) -> list[str]:
        conns = sorted(self.connections.values(), key=lambda c: c.name)
        if layer == "fact":
            return [c.name for c in conns if c.cards and self._usable(c)]
        if layer == "note":
            return [c.name for c in conns if self._usable(c)]
        return []

    def _primer_connections(self) -> list[ConnectionTarget]:
        return sorted(
            (c for c in self.connections.values() if c.tenant_lock == self.tenant),
            key=lambda c: c.name,
        )

    def _connection(self, name: str | None, *, locked_only: bool = False) -> ConnectionTarget:
        conn = self.connections.get(name or "")
        if conn is None:
            raise KnowledgeError(404, f"unknown connection {name!r}")
        if not self._usable(conn) or (locked_only and conn.tenant_lock != self.tenant):
            raise KnowledgeError(403, f"connection {name!r} is not editable by this tenant")
        return conn

    # ---- locations --------------------------------------------------------

    def _locate(self, layer: str, item_id: str, target: str | None) -> _Loc:
        if layer not in LAYERS:
            raise KnowledgeError(404, f"unknown layer {layer!r}")
        stem = safe_segment(item_id)
        if stem is None:
            raise KnowledgeError(400, f"invalid id {item_id!r}")
        if layer in _TARGETED:
            if not target:
                raise KnowledgeError(400, f"layer {layer!r} needs a target connection")
        elif target:
            raise KnowledgeError(400, f"layer {layer!r} takes no target")
        history = self.root / _HISTORY
        tenant = self.tenant
        if layer == "fact":
            conn = self._connection(target)
            if not conn.cards:
                raise KnowledgeError(404, f"connection {target!r} takes no learned facts")
            live = _inside(conn.dir / "knowledge", f"{stem}.md")
            key: tuple[str, ...] = (layer, conn.name, stem)
        elif layer == "note":
            conn = self._connection(target)
            live = _inside(conn.dir / "memory", slug_card_id(tenant), f"{stem}.md")
            key = (layer, conn.name, slug_card_id(tenant), stem)
        elif layer == "primer":
            conn = self._connection(stem, locked_only=True)
            live = _inside(conn.dir, "connection.md")
            key = (layer, conn.name)
        elif layer == "rule":
            live = _inside(self._learned(self.context_dir), f"{stem}.md")
            key = (layer, tenant, stem)
        elif layer == "skill":
            live = _inside(self._learned(self.skills_dir), stem, SKILL_FILE)
            key = (layer, tenant, stem)
        else:
            live = _inside(self.root / "evals" / "tenants" / tenant, f"{stem}.yaml")
            key = (layer, tenant, stem)
        return _Loc(layer, stem, target, live, _inside(history, *key))

    def _learned(self, base: Path) -> Path:
        folder = learned_dir(base, self.tenant)
        assert folder is not None  # the tenant was validated in __init__
        return folder

    # ---- file formats -----------------------------------------------------

    def _parse(self, loc: _Loc, text: str) -> tuple[str, str, dict[str, Any]]:
        if loc.layer == "fact":
            card = _parse_connection_card(text, default_id=loc.id)
            meta: dict[str, Any] = {
                "term": card.term,
                "kind": card.kind,
                "scope": card.scope,
                "status": card.status,
            }
            if card.confidence is not None:
                meta["confidence"] = card.confidence
            return card.title, card.body, meta
        if loc.layer == "rule":
            return parse_rule(text, loc.id)
        if loc.layer == "skill":
            return parse_skill(text, loc.id)
        if loc.layer == "primer":
            return loc.id, split_raw_frontmatter(text)[1], {}
        if loc.layer == "eval":
            return parse_eval(text)
        front, body = split_frontmatter(text)
        return str(front.pop("title", "") or loc.id), body, front

    def _compose(
        self,
        loc: _Loc,
        current: str | None,
        *,
        title: str,
        content: str,
        meta: dict[str, Any],
        author: str,
        provenance: dict[str, Any] | None,
    ) -> str:
        if loc.layer == "fact":
            return _compose_fact(loc.id, title, content, meta, author, provenance)
        if loc.layer == "rule":
            return compose_rule(title or loc.id, content)
        if loc.layer == "skill":
            return compose_skill(loc.id, title, content, meta)
        if loc.layer == "primer":
            if current is None:
                raise KnowledgeError(404, f"connection {loc.id!r} has no description file")
            head = split_raw_frontmatter(current)[0]
            return f"{head}\n\n{content.strip()}\n" if head else f"{content.strip()}\n"
        if loc.layer == "eval":
            return compose_eval(title, content, meta)
        raise KnowledgeError(405, f"layer {loc.layer!r} is read-only")

    def _validate(
        self, loc: _Loc, text: str, current: str | None, *, restoring: bool = False
    ) -> None:
        """Refuse a file the layer cannot read back, an empty one, one that
        carries personal data, or a description whose frontmatter changed.
        `restoring` a stored version is allowed on read-only layers, so a
        deleted note can be brought back."""
        if loc.layer not in EDITABLE and not restoring:
            raise KnowledgeError(405, f"layer {loc.layer!r} is read-only")
        new_id = current is None and not restoring and loc.layer != "primer"
        if new_id and slug_card_id(loc.id) != loc.id:
            raise KnowledgeError(
                400, f"a new id must be a slug (lowercase letters, digits, '-'): {loc.id!r}"
            )
        self._check_content(loc, text)
        if loc.layer == "primer":
            _check_primer(loc.id, text, current)

    def _check_content(self, loc: _Loc, text: str) -> None:
        try:
            title, content, _ = self._parse(loc, text)
        except (ValueError, yaml.YAMLError) as exc:
            raise KnowledgeError(400, f"unreadable {loc.layer}: {exc}") from exc
        if not content.strip():
            raise KnowledgeError(400, "content is required")
        if loc.layer == "eval" and not title.strip():
            raise KnowledgeError(400, "an eval case needs a question")
        if loc.layer in _SAFETY_CHECKED:
            try:
                _reject_if_secretish(f"{title}\n{content}")
            except ValueError as exc:
                raise KnowledgeError(400, str(exc)) from exc

    # ---- history ----------------------------------------------------------

    def _versions(self, loc: _Loc) -> list[dict[str, Any]]:
        if not loc.history.is_dir():
            return []
        out: list[dict[str, Any]] = []
        for path in sorted(loc.history.glob("[0-9]" * 4 + ".json")):
            try:
                entry = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if isinstance(entry, dict):
                out.append(entry)
        return out

    def _version_text(self, loc: _Loc, version: int) -> str | None:
        return _read(loc.history / f"{version:04d}.md")

    def _append(
        self,
        loc: _Loc,
        text: str | None,
        *,
        author: str,
        reason: str,
        provenance: dict[str, Any] | None = None,
        updated_at: str | None = None,
    ) -> dict[str, Any]:
        versions = self._versions(loc)
        number = int(versions[-1]["version"]) + 1 if versions else 1
        entry = {
            "version": number,
            "updated_at": updated_at or _now(),
            "updated_by": author,
            "reason": reason,
            "provenance": provenance or {},
            "deleted": text is None,
        }
        if text is not None:
            _write_atomic(loc.history / f"{number:04d}.md", text)
        _write_atomic(loc.history / f"{number:04d}.json", json.dumps(entry, ensure_ascii=False))
        return entry

    def _current(self, loc: _Loc) -> tuple[str | None, dict[str, Any] | None, bool]:
        """(live text, the version describing it, whether that version is
        recorded). An unrecorded version is a hand edit, dated by the file."""
        live = _read(loc.live)
        versions = self._versions(loc)
        last = versions[-1] if versions else None
        last_text = self._version_text(loc, int(last["version"])) if last else None
        if last is not None and live == last_text:
            return live, last, True
        if live is None:
            return None, last, True
        number = int(last["version"]) + 1 if last else 1
        mtime = datetime.fromtimestamp(loc.live.stat().st_mtime, tz=UTC).replace(microsecond=0)
        entry = {
            "version": number,
            "updated_at": mtime.isoformat(),
            "updated_by": "",
            "reason": _EXTERNAL_REASON if last else "",
            "provenance": {},
            "deleted": False,
        }
        return live, entry, False

    def _record_current(self, loc: _Loc) -> str | None:
        live, entry, recorded = self._current(loc)
        if not recorded and entry is not None:
            self._append(
                loc,
                live,
                author="",
                reason=str(entry["reason"]),
                updated_at=str(entry["updated_at"]),
            )
        return live

    # ---- items ------------------------------------------------------------

    def _item(self, loc: _Loc, text: str, entry: dict[str, Any]) -> dict[str, Any]:
        try:
            title, content, meta = self._parse(loc, text)
        except (ValueError, yaml.YAMLError) as exc:
            title, content, meta = loc.id, text, {"parse_error": str(exc)}
        return {
            "layer": loc.layer,
            "id": loc.id,
            "target": loc.target,
            "title": title,
            "content": content,
            "meta": meta,
            "version": entry.get("version"),
            "updated_at": entry.get("updated_at"),
            "updated_by": entry.get("updated_by") or "",
        }

    def _with_history(self, loc: _Loc, item: dict[str, Any]) -> dict[str, Any]:
        _, current, recorded = self._current(loc)
        entries = self._versions(loc)
        if current is not None and not recorded:
            entries.append(current)
        item["history"] = [
            {
                "version": e.get("version"),
                "updated_at": e.get("updated_at"),
                "updated_by": e.get("updated_by") or "",
                "reason": e.get("reason") or "",
            }
            for e in reversed(entries)
        ]
        return item

    def read(self, layer: str, item_id: str, target: str | None = None) -> dict[str, Any]:
        loc = self._locate(layer, item_id, target)
        text, entry, _ = self._current(loc)
        if text is None or entry is None:
            raise KnowledgeError(404, f"no {layer} {item_id!r}")
        return self._with_history(loc, self._item(loc, text, entry))

    def read_version(
        self, layer: str, item_id: str, version: int, target: str | None = None
    ) -> dict[str, Any]:
        loc = self._locate(layer, item_id, target)
        _, current, recorded = self._current(loc)
        entries = self._versions(loc)
        entry = next((e for e in entries if e.get("version") == version), None)
        text = self._version_text(loc, version) if entry else None
        if entry is None and current is not None and not recorded:
            if current.get("version") == version:
                entry, text = current, _read(loc.live)
        if entry is None:
            raise KnowledgeError(404, f"no version {version} of {layer} {item_id!r}")
        if text is None:
            item = self._item(loc, "", entry)
            item.update(title=item_id, content="", meta={"deleted": True})
        else:
            item = self._item(loc, text, entry)
        return self._with_history(loc, item)

    def put(
        self,
        layer: str,
        item_id: str,
        *,
        target: str | None = None,
        title: str = "",
        content: str,
        reason: str = "",
        author: str = "",
        provenance: dict[str, Any] | None = None,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        loc = self._locate(layer, item_id, target)
        if layer not in EDITABLE:
            raise KnowledgeError(405, f"layer {layer!r} is read-only")
        current = _read(loc.live)
        merged: dict[str, Any] = {}
        if current is not None:
            try:
                merged = self._parse(loc, current)[2]
            except (ValueError, yaml.YAMLError):
                merged = {}
        merged.update(meta or {})
        if layer == "eval" and provenance:
            merged["source"] = provenance
        text = self._compose(
            loc,
            current,
            title=title,
            content=content,
            meta=merged,
            author=author,
            provenance=provenance,
        )
        return self._write(loc, text, author=author, reason=reason, provenance=provenance)

    def write_file(
        self,
        layer: str,
        item_id: str,
        text: str,
        *,
        target: str | None = None,
        reason: str = "",
        author: str = "",
        provenance: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Replace an item's whole file (frontmatter included), as the file
        tools do. Same checks as `put`."""
        loc = self._locate(layer, item_id, target)
        return self._write(loc, text, author=author, reason=reason, provenance=provenance)

    def read_file(self, layer: str, item_id: str, target: str | None = None) -> str:
        text = _read(self._locate(layer, item_id, target).live)
        if text is None:
            raise KnowledgeError(404, f"no {layer} {item_id!r}")
        return text

    def _write(
        self,
        loc: _Loc,
        text: str,
        *,
        author: str,
        reason: str,
        provenance: dict[str, Any] | None,
        restoring: bool = False,
    ) -> dict[str, Any]:
        self._validate(loc, text, _read(loc.live), restoring=restoring)
        current = self._record_current(loc)
        if current == text:
            return self.read(loc.layer, loc.id, loc.target)
        _write_atomic(loc.live, text)
        entry = self._append(loc, text, author=author, reason=reason, provenance=provenance)
        return self._with_history(loc, self._item(loc, text, entry))

    def delete(
        self,
        layer: str,
        item_id: str,
        *,
        target: str | None = None,
        reason: str = "",
        author: str = "",
    ) -> None:
        if layer == "primer":
            raise KnowledgeError(405, "a data source description cannot be deleted")
        loc = self._locate(layer, item_id, target)
        if self._record_current(loc) is None:
            raise KnowledgeError(404, f"no {layer} {item_id!r}")
        loc.live.unlink()
        if layer == "skill":
            try:
                loc.live.parent.rmdir()
            except OSError:
                pass
        self._append(loc, None, author=author, reason=reason)

    def revert(
        self,
        layer: str,
        item_id: str,
        version: int,
        *,
        target: str | None = None,
        reason: str = "",
        author: str = "",
    ) -> dict[str, Any]:
        """Make `version`'s content current again, as a new version."""
        loc = self._locate(layer, item_id, target)
        old = self._version_text(loc, version)
        if old is None:
            raise KnowledgeError(404, f"version {version} of {layer} {item_id!r} has no content")
        if layer == "primer":
            current = _read(loc.live)
            old = self._compose(
                loc,
                current,
                title="",
                content=split_raw_frontmatter(old)[1],
                meta={},
                author=author,
                provenance=None,
            )
        return self._write(
            loc,
            old,
            author=author,
            reason=reason or f"revert to version {version}",
            provenance=None,
            restoring=True,
        )

    # ---- listing ----------------------------------------------------------

    def _live_ids(self, layer: str, target: str | None) -> list[str]:
        if layer == "fact" and target:
            folder = self.connections[target].dir / "knowledge"
            return sorted(p.stem for p in folder.glob("*.md"))
        if layer == "note" and target:
            folder = self.connections[target].dir / "memory" / slug_card_id(self.tenant)
            return sorted(p.stem for p in folder.glob("*.md"))
        if layer == "rule":
            return sorted(p.stem for p in self._learned(self.context_dir).glob("*.md"))
        if layer == "skill":
            skills = self._learned(self.skills_dir).glob(f"*/{SKILL_FILE}")
            return sorted(p.parent.name for p in skills)
        if layer == "primer":
            conns = self._primer_connections()
            return [c.name for c in conns if (c.dir / "connection.md").is_file()]
        if layer == "eval":
            folder = self.root / "evals" / "tenants" / self.tenant
            return sorted(p.stem for p in folder.glob("*.yaml"))
        return []

    def _summaries(self, layer: str) -> list[dict[str, Any]]:
        scopes: list[str | None] = list(self.targets(layer)) if layer in _TARGETED else [None]
        items: list[dict[str, Any]] = []
        for target in scopes:
            for item_id in self._live_ids(layer, target):
                if safe_segment(item_id) is None:
                    continue
                loc = self._locate(layer, item_id, target)
                text, entry, _ = self._current(loc)
                if text is None or entry is None:
                    continue
                item = self._item(loc, text, entry)
                items.append(
                    {
                        k: item[k]
                        for k in ("id", "title", "target", "updated_at", "updated_by", "version")
                    }
                )
        return items

    def layers(self) -> list[dict[str, Any]]:
        return [
            {
                "layer": layer,
                "label": LABELS[layer],
                "editable": layer in EDITABLE,
                "targets": self.targets(layer)
                if layer in _TARGETED
                else ([c.name for c in self._primer_connections()] if layer == "primer" else []),
                "items": self._summaries(layer),
            }
            for layer in LAYERS
        ]

    # ---- virtual tree (the file tools' view) ------------------------------

    def resolve_path(self, path: str) -> VirtualRef:
        """What a virtual path names. Raises KnowledgeError for a path outside
        the tree or one this tenant may not see."""
        parts = _virtual_parts(path)
        head, rest = parts[0], parts[1:]
        if head == "base" and len(rest) >= 2 and rest[0] in ("context", "skills"):
            return VirtualRef(path="/".join(parts), layer=None, id=None, target=None)
        ref = _LAYER_PATHS.get((head, len(rest)))
        item_id, target = ref[1](rest) if ref else (None, None)
        if ref is None or item_id is None:
            raise KnowledgeError(400, f"no such path {path!r}")
        self._locate(ref[0], item_id, target)
        return VirtualRef(path="/".join(parts), layer=ref[0], id=item_id, target=target)

    def _base_visible(self, rel: tuple[str, ...]) -> bool:
        """Shipped files, and this tenant's own non-learned overlay files."""
        if not rel or any(p.startswith(".") for p in rel) or is_learned_path(rel):
            return False
        return rel[0] != TENANTS_DIR or (len(rel) > 2 and rel[1] == self.tenant)

    def _base_file(self, ref: VirtualRef) -> Path:
        parts = ref.path.split("/")[1:]
        base = self.context_dir if parts[0] == "context" else self.skills_dir
        rel = tuple(parts[1:])
        path = _inside(base, *rel) if self._base_visible(rel) else None
        if path is None or not path.is_file():
            raise KnowledgeError(404, f"no such file {ref.path!r}")
        return path

    def read_path(self, path: str) -> str:
        ref = self.resolve_path(path)
        if ref.layer is None:
            return self._base_file(ref).read_text(encoding="utf-8")
        return self.read_file(ref.layer, str(ref.id), ref.target)

    def tree(self) -> list[dict[str, Any]]:
        """Every file of the tenant's virtual tree, sorted by path."""
        entries: list[dict[str, Any]] = [
            {
                "path": virtual_path(layer, item["id"], item["target"]),
                "layer": layer,
                "id": item["id"],
                "target": item["target"],
                "writable": layer in EDITABLE,
            }
            for layer in LAYERS
            for item in self._summaries(layer)
        ]
        for name, base in (("context", self.context_dir), ("skills", self.skills_dir)):
            files = sorted(base.rglob("*")) if base.is_dir() else []
            for file in files:
                rel = file.relative_to(base).parts
                if file.is_file() and self._base_visible(rel):
                    entries.append(
                        {
                            "path": "/".join(("base", name, *rel)),
                            "layer": None,
                            "id": None,
                            "target": None,
                            "writable": False,
                        }
                    )
        return sorted(entries, key=lambda e: e["path"])


@dataclass(frozen=True)
class VirtualRef:
    """A virtual path and the item it names; `layer` is None for a read-only
    view of a shipped file under `base/`."""

    path: str
    layer: str | None
    id: str | None
    target: str | None

    @property
    def writable(self) -> bool:
        return self.layer in EDITABLE


def _virtual_parts(path: str) -> list[str]:
    parts = [p for p in path.strip().strip("/").split("/") if p not in ("", ".")]
    if not parts or any(p.startswith(".") for p in parts):
        raise KnowledgeError(400, f"no such path {path!r}")
    return parts


def _stem(name: str, suffix: str) -> str | None:
    return name[: -len(suffix)] if name.endswith(suffix) and len(name) > len(suffix) else None


_PathParse = Callable[[list[str]], tuple[str | None, str | None]]
_LAYER_PATHS: dict[tuple[str, int], tuple[str, _PathParse]] = {
    ("rules", 1): ("rule", lambda r: (_stem(r[0], ".md"), None)),
    ("skills", 2): ("skill", lambda r: (r[0] if r[1] == SKILL_FILE else None, None)),
    ("facts", 2): ("fact", lambda r: (_stem(r[1], ".md"), r[0])),
    ("primers", 1): ("primer", lambda r: (_stem(r[0], ".md"), None)),
    ("evals", 1): ("eval", lambda r: (_stem(r[0], ".yaml"), None)),
    ("notes", 2): ("note", lambda r: (_stem(r[1], ".md"), r[0])),
}


def virtual_path(layer: str, item_id: str, target: str | None = None) -> str:
    """The file tools' path of an item; the inverse of `resolve_path`."""
    paths = {
        "rule": f"rules/{item_id}.md",
        "skill": f"skills/{item_id}/{SKILL_FILE}",
        "fact": f"facts/{target}/{item_id}.md",
        "primer": f"primers/{item_id}.md",
        "eval": f"evals/{item_id}.yaml",
        "note": f"notes/{target}/{item_id}.md",
    }
    if layer not in paths:
        raise KnowledgeError(404, f"unknown layer {layer!r}")
    return paths[layer]
