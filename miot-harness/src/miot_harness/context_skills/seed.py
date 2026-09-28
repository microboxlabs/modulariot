"""Keep a workspace's copy of the packaged context and skills up to date.

Deployments point `context_dir` / `skills_dir` at a writable volume that an
init container fills with `cp -Rn`, which never replaces a file. Without this
module a new image ships new defaults that the running harness never reads.

At boot, for every packaged file:

| Workspace file | Action |
|---|---|
| missing | copy it |
| same as packaged | nothing |
| unchanged since the last refresh | replace it |
| edited since the last refresh | keep it, log a warning |
| present, never recorded, different | back it up, then replace it |

Files that exist only in the workspace (tenant overlays) are never touched.
The record of what was copied and the backups live next to the workspace
directory, in `.seed-state/`, so the loaders never read them.
"""

from __future__ import annotations

import hashlib
import json
import logging
import shutil
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

logger = logging.getLogger(__name__)

_STATE_DIR = ".seed-state"
PACKAGED_DEFAULTS = Path(__file__).parent / "defaults"


@dataclass
class RefreshReport:
    copied: list[str] = field(default_factory=list)
    replaced: list[str] = field(default_factory=list)
    kept_edited: list[str] = field(default_factory=list)
    backed_up: list[str] = field(default_factory=list)


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def refresh_defaults(packaged: Path, workspace: Path) -> RefreshReport:
    """Bring `workspace` up to date with `packaged`. Never raises on file errors."""
    report = RefreshReport()
    if not packaged.is_dir() or packaged.resolve() == workspace.resolve():
        return report
    state_dir = workspace.parent / _STATE_DIR
    record_path = state_dir / f"{workspace.name}.json"
    try:
        recorded: dict[str, str] = json.loads(record_path.read_text())
    except (OSError, ValueError):
        recorded = {}
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")

    for source in sorted(p for p in packaged.rglob("*") if p.is_file()):
        rel = source.relative_to(packaged).as_posix()
        if "__pycache__" in rel:
            continue
        target = workspace / rel
        try:
            wanted = _digest(source)
            if not target.exists():
                report.copied.append(rel)
            else:
                current = _digest(target)
                if current == wanted:
                    recorded[rel] = wanted
                    continue
                if rel in recorded and recorded[rel] != current:
                    report.kept_edited.append(rel)
                    continue
                if rel not in recorded:
                    backup = state_dir / "backups" / stamp / workspace.name / rel
                    backup.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(target, backup)
                    report.backed_up.append(rel)
                report.replaced.append(rel)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            recorded[rel] = wanted
        except OSError as exc:
            logger.warning("Could not refresh %s in %s: %s", rel, workspace, exc)

    try:
        state_dir.mkdir(parents=True, exist_ok=True)
        record_path.write_text(json.dumps(recorded, indent=2, sort_keys=True))
    except OSError as exc:
        logger.warning("Could not record refreshed defaults for %s: %s", workspace, exc)

    for rel in report.kept_edited:
        logger.warning(
            "%s/%s was edited in place; the packaged version is not applied", workspace, rel
        )
    if report.copied or report.replaced:
        logger.info(
            "Refreshed packaged defaults in %s: %d copied, %d replaced (%d backed up to %s)",
            workspace,
            len(report.copied),
            len(report.replaced),
            len(report.backed_up),
            state_dir / "backups",
        )
    return report
