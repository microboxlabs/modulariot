"""The packaged `miot-capabilities` and `research` skills load, the analyst skill
points at them, and the repository paths `miot-capabilities` teaches exist."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

import miot_harness.context_skills as context_skills_pkg
from miot_harness.context_skills.file_source import FileSkillSource
from miot_harness.context_skills.skill_models import PlaybookSkill

_SKILLS_DIR = Path(context_skills_pkg.__file__).parent / "defaults" / "skills"
_REPO_ROOT = Path(__file__).resolve().parents[3]
_PATH_RE = re.compile(r"`((?:quarkus-srv|turbo-repo|miot-harness)/[^`*<]+?)/?`")


def _playbooks() -> dict[str, PlaybookSkill]:
    result = FileSkillSource(_SKILLS_DIR).load()
    assert not [d for d in result.diagnostics if d.level == "error"]
    return {s.skill.id: s.skill for s in result.skills if isinstance(s.skill, PlaybookSkill)}


def test_the_new_skills_load_and_the_analyst_names_them() -> None:
    playbooks = _playbooks()
    assert {"miot-capabilities", "research"} <= set(playbooks)
    analyst = (_SKILLS_DIR / "miot-analyst" / "SKILL.md").read_text()
    for skill_id in ("miot-capabilities", "research", "source_search"):
        assert skill_id in analyst


def test_paths_in_miot_capabilities_exist() -> None:
    if not (_REPO_ROOT / "turbo-repo").is_dir():
        pytest.skip("monorepo checkout not available")
    body = (_SKILLS_DIR / "miot-capabilities" / "SKILL.md").read_text()
    paths = _PATH_RE.findall(body)
    assert paths
    missing = [p for p in paths if not (_REPO_ROOT / p).exists()]
    assert missing == []
