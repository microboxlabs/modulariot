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
import os
import tempfile
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


def _write_atomic(path: Path, data: bytes) -> None:
    """Write through a temporary file and rename, so a reader never sees half a file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def _through_symlink(workspace: Path, target: Path) -> bool:
    """True when the target, or a directory between it and the workspace, is a symlink."""
    path = target
    while path != workspace:
        if path.is_symlink():
            return True
        path = path.parent
    return False


def _read_record(record_path: Path) -> dict[str, str]:
    try:
        data = json.loads(record_path.read_text())
    except (OSError, ValueError):
        return {}
    if not isinstance(data, dict):
        return {}
    return {k: v for k, v in data.items() if isinstance(k, str) and isinstance(v, str)}


def refresh_defaults(packaged: Path, workspace: Path) -> RefreshReport:
    """Bring `workspace` up to date with `packaged`. Never raises on file errors."""
    report = RefreshReport()
    try:
        if packaged.is_dir() and packaged.resolve() != workspace.resolve():
            _refresh(packaged, workspace, report)
    except (OSError, ValueError) as exc:
        logger.warning("Could not refresh packaged defaults in %s: %s", workspace, exc)
    return report


def _refresh(packaged: Path, workspace: Path, report: RefreshReport) -> None:
    state_dir = workspace.parent / _STATE_DIR
    record_path = state_dir / f"{workspace.name}.json"
    recorded = _read_record(record_path)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")

    for source in sorted(p for p in packaged.rglob("*") if p.is_file()):
        rel = source.relative_to(packaged).as_posix()
        if "__pycache__" in rel:
            continue
        target = workspace / rel
        if _through_symlink(workspace, target):
            logger.warning("%s is reached through a symlink; not refreshed", target)
            continue
        try:
            _refresh_file(
                source,
                target,
                rel,
                recorded,
                report,
                state_dir / "backups" / stamp / workspace.name,
            )
        except OSError as exc:
            logger.warning("Could not refresh %s in %s: %s", rel, workspace, exc)

    try:
        _write_atomic(record_path, json.dumps(recorded, indent=2, sort_keys=True).encode())
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


def _refresh_file(
    source: Path,
    target: Path,
    rel: str,
    recorded: dict[str, str],
    report: RefreshReport,
    backups: Path,
) -> None:
    data = source.read_bytes()
    wanted = hashlib.sha256(data).hexdigest()
    if not target.exists():
        report.copied.append(rel)
    else:
        current = _digest(target)
        if current == wanted:
            recorded[rel] = wanted
            return
        if rel in recorded and recorded[rel] != current:
            report.kept_edited.append(rel)
            return
        if rel not in recorded:
            _write_atomic(backups / rel, target.read_bytes())
            report.backed_up.append(rel)
        report.replaced.append(rel)
    _write_atomic(target, data)
    recorded[rel] = wanted
