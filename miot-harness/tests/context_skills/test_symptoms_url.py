"""The symptom tools may live on a different modulith than the other MCP skills."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from miot_harness.config import HarnessSettings
from miot_harness.context_skills.file_source import FileSkillSource
from miot_harness.context_skills.loader import boot_context_skills
from miot_harness.context_skills.mcp_skills import resolve_url
from miot_harness.context_skills.seed import PACKAGED_DEFAULTS, refresh_defaults
from miot_harness.context_skills.skill_models import McpServer
from miot_harness.context_skills.source import ContextLoadResult, ContextSource
from miot_harness.tools.registry import build_default_registry

LOCAL = "https://modulith.example.com"
REMOTE = "https://control-tower.example.com"
SKILL = "control-tower-symptoms/SKILL.md"
OLD_URL = "${MIOT_HARNESS_MODULITH_URL}/api/v1/mcp"
NEW_URL = "${MIOT_HARNESS_SYMPTOMS_URL}/api/v1/mcp"
SYMPTOMS = McpServer(url=NEW_URL)


class _NoContext(ContextSource):
    def load(self) -> ContextLoadResult:
        return ContextLoadResult()


@pytest.fixture
def local_only(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MIOT_HARNESS_MODULITH_URL", LOCAL)
    monkeypatch.delenv("MIOT_HARNESS_SYMPTOMS_URL", raising=False)


def _boot(skills_dir: Path, settings: HarnessSettings | None = None):
    return boot_context_skills(
        build_default_registry(),
        settings if settings is not None else HarnessSettings(),
        context_source=_NoContext(),
        skill_source=FileSkillSource(skills_dir),
    ).bundle


def _url(bundle, skill_id: str) -> str:
    skill = bundle.find_mcp_skill("tenant-a", skill_id)
    assert skill is not None
    assert skill.mcp is not None
    return skill.mcp.url


def test_the_setting_defaults_to_the_modulith_url(local_only: None) -> None:
    assert HarnessSettings().symptoms_url == LOCAL


def test_the_setting_can_be_overridden(
    local_only: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MIOT_HARNESS_SYMPTOMS_URL", REMOTE)
    settings = HarnessSettings()
    assert settings.symptoms_url == REMOTE
    assert settings.modulith_url == LOCAL


def test_unset_the_symptom_url_resolves_to_the_modulith(local_only: None) -> None:
    assert resolve_url(SYMPTOMS) == f"{LOCAL}/api/v1/mcp"


def test_a_blank_symptom_url_also_falls_back(
    local_only: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MIOT_HARNESS_SYMPTOMS_URL", "  ")
    assert resolve_url(SYMPTOMS) == f"{LOCAL}/api/v1/mcp"


def test_neither_set_names_the_symptom_variable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MIOT_HARNESS_MODULITH_URL", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_SYMPTOMS_URL", raising=False)
    with pytest.raises(ValueError, match="MIOT_HARNESS_SYMPTOMS_URL"):
        resolve_url(SYMPTOMS)


def test_the_packaged_symptoms_skill_goes_to_the_override_and_the_rest_stay_local(
    local_only: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MIOT_HARNESS_SYMPTOMS_URL", REMOTE + "/")
    bundle = _boot(PACKAGED_DEFAULTS / "skills")
    assert _url(bundle, "control-tower-symptoms") == f"{REMOTE}/api/v1/mcp"
    for skill_id in ("selectables", "storyteller", "system-builder"):
        assert _url(bundle, skill_id) == f"{LOCAL}/api/v1/mcp"


def test_without_the_override_the_packaged_symptoms_skill_stays_local(
    local_only: None,
) -> None:
    bundle = _boot(PACKAGED_DEFAULTS / "skills")
    assert _url(bundle, "control-tower-symptoms") == f"{LOCAL}/api/v1/mcp"


@pytest.mark.parametrize("env_url", [None, "https://other.example.com"])
def test_explicit_boot_settings_override_the_environment(
    local_only: None, monkeypatch: pytest.MonkeyPatch, env_url: str | None
) -> None:
    if env_url is not None:
        monkeypatch.setenv("MIOT_HARNESS_SYMPTOMS_URL", env_url)
    bundle = _boot(
        PACKAGED_DEFAULTS / "skills", HarnessSettings(symptoms_url=REMOTE + "/")
    )
    assert _url(bundle, "control-tower-symptoms") == f"{REMOTE}/api/v1/mcp"
    for skill_id in ("selectables", "storyteller", "system-builder"):
        assert _url(bundle, skill_id) == f"{LOCAL}/api/v1/mcp"


def test_symptoms_url_from_dotenv_is_used_without_exporting_it(
    tmp_path: Path, local_only: None
) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(f"MIOT_HARNESS_SYMPTOMS_URL={REMOTE}\n", encoding="utf-8")
    bundle = _boot(PACKAGED_DEFAULTS / "skills", HarnessSettings(_env_file=env_file))
    assert _url(bundle, "control-tower-symptoms") == f"{REMOTE}/api/v1/mcp"


def _old_packaged(tmp_path: Path) -> Path:
    """The packaged skills as they were before the symptoms URL existed."""
    old = tmp_path / "old-packaged"
    shutil.copytree(PACKAGED_DEFAULTS / "skills", old)
    path = old / SKILL
    text = path.read_text(encoding="utf-8")
    assert NEW_URL in text
    path.write_text(text.replace(NEW_URL, OLD_URL), encoding="utf-8")
    return old


@pytest.mark.parametrize("recorded", [True, False], ids=["recorded", "cp-Rn-seed"])
def test_a_workspace_with_the_old_unedited_skill_gets_the_new_url(
    tmp_path: Path, local_only: None, monkeypatch: pytest.MonkeyPatch, recorded: bool
) -> None:
    old = _old_packaged(tmp_path)
    workspace = tmp_path / "workspace" / "skills"
    if recorded:
        refresh_defaults(old, workspace)
    else:
        shutil.copytree(old, workspace)
    assert OLD_URL in (workspace / SKILL).read_text(encoding="utf-8")

    report = refresh_defaults(PACKAGED_DEFAULTS / "skills", workspace)

    assert SKILL in report.replaced
    assert NEW_URL in (workspace / SKILL).read_text(encoding="utf-8")
    monkeypatch.setenv("MIOT_HARNESS_SYMPTOMS_URL", REMOTE)
    assert _url(_boot(workspace), "control-tower-symptoms") == f"{REMOTE}/api/v1/mcp"


def test_an_edited_old_symptoms_skill_is_preserved(tmp_path: Path) -> None:
    old = _old_packaged(tmp_path)
    workspace = tmp_path / "workspace" / "skills"
    refresh_defaults(old, workspace)
    path = workspace / SKILL
    edited = path.read_text(encoding="utf-8") + "\nOperator guidance.\n"
    path.write_text(edited, encoding="utf-8")

    report = refresh_defaults(PACKAGED_DEFAULTS / "skills", workspace)

    assert SKILL in report.kept_edited
    assert SKILL not in report.replaced
    assert path.read_text(encoding="utf-8") == edited
