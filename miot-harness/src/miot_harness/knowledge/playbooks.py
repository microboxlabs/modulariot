"""Trainer playbooks: skills shipped with the harness for learning sessions.

They live in `<skills_dir>/learning/<name>/SKILL.md`. The skill loader skips
that folder, so they are never listed or offered to a run; a trainer's
`/skill-creator` or `/skill-doctor` command loads one as the run's guidance.
"""

from __future__ import annotations

from pathlib import Path

from miot_harness.knowledge.formats import split_raw_frontmatter

TRAINER_PLAYBOOKS_DIR = "learning"
_PACKAGED_SKILLS = Path(__file__).parents[1] / "context_skills" / "defaults" / "skills"


def is_trainer_playbook_path(parts: tuple[str, ...]) -> bool:
    """True for a path, relative to a skills dir, inside the playbooks folder."""
    return bool(parts) and parts[0] == TRAINER_PLAYBOOKS_DIR


def trainer_playbook(skills_dir: Path, name: str) -> str | None:
    """The playbook's body: the workspace copy, else the packaged one."""
    for base in (skills_dir, _PACKAGED_SKILLS):
        path = base / TRAINER_PLAYBOOKS_DIR / name / "SKILL.md"
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        return split_raw_frontmatter(text)[1] or None
    return None
