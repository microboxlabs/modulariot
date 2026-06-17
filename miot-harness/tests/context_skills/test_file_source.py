from __future__ import annotations

from pathlib import Path

from miot_harness.context_skills.file_source import FileContextSource, FileSkillSource
from miot_harness.context_skills.skill_models import HttpConnectorSkill, PlaybookSkill


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def test_context_source_loads_global_and_tenant(tmp_path: Path) -> None:
    _write(
        tmp_path / "00-system.yaml",
        "id: system-base\nprimer_text: hello\n"
        "facts:\n  - name: f1\n    body: b1\n",
    )
    _write(
        tmp_path / "tenants" / "mintral" / "overlay.yaml",
        "id: mintral\nprimer_text: tenant-hello\n",
    )
    _write(tmp_path / "notes.md", "# Markdown primer\nbody")

    result = FileContextSource(tmp_path).load()

    assert result.diagnostics == ()
    by_id = {c.id: c for c in result.contexts}
    assert by_id["system-base"].scope.kind == "global"
    assert by_id["system-base"].primer_text == "hello"
    assert by_id["mintral"].scope.kind == "tenant"
    assert by_id["mintral"].scope.tenant_id == "mintral"
    # A bare .md file becomes a global primer document keyed by its stem.
    assert by_id["notes"].primer_text.startswith("# Markdown primer")


def test_context_source_isolates_malformed_file(tmp_path: Path) -> None:
    _write(tmp_path / "good.yaml", "id: good\nprimer_text: ok\n")
    _write(tmp_path / "bad.yaml", "id: bad\nfacts: : : not-valid\n")

    result = FileContextSource(tmp_path).load()

    assert [c.id for c in result.contexts] == ["good"]
    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].level == "error"
    assert result.diagnostics[0].path.endswith("bad.yaml")


def test_context_source_missing_dir_warns(tmp_path: Path) -> None:
    result = FileContextSource(tmp_path / "nope").load()
    assert result.contexts == ()
    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].level == "warning"


def test_skill_source_loads_playbook_with_body_and_connector(tmp_path: Path) -> None:
    _write(
        tmp_path / "playbooks" / "p.yaml",
        "kind: playbook\nid: p1\nname: P1\nwhen_to_use: when X\n"
        "tools: [a, b]\nplaybook_ref: body.md\n",
    )
    _write(tmp_path / "playbooks" / "body.md", "# Body\nsteps")
    _write(
        tmp_path / "connectors" / "c.yaml",
        "kind: http\nid: c1\ntool_name: ping\nurl: https://x.example/ping\n",
    )

    result = FileSkillSource(tmp_path).load()

    assert result.diagnostics == ()
    by_kind = {type(s.skill).__name__: s for s in result.skills}
    playbook = by_kind["PlaybookSkill"]
    assert isinstance(playbook.skill, PlaybookSkill)
    assert playbook.skill.tools == ("a", "b")
    assert playbook.playbook_body is not None
    assert playbook.playbook_body.startswith("# Body")
    assert isinstance(by_kind["HttpConnectorSkill"].skill, HttpConnectorSkill)


def test_skill_source_missing_playbook_ref_warns(tmp_path: Path) -> None:
    _write(
        tmp_path / "p.yaml",
        "kind: playbook\nid: p1\nname: P1\nplaybook_ref: nope.md\n",
    )
    result = FileSkillSource(tmp_path).load()
    assert len(result.skills) == 1
    assert result.skills[0].playbook_body is None
    assert any(d.level == "warning" for d in result.diagnostics)


def test_skill_source_tenant_scope_from_dir(tmp_path: Path) -> None:
    _write(
        tmp_path / "tenants" / "mintral" / "s.yaml",
        "kind: http\nid: s1\ntool_name: t\nurl: https://x.example/t\n",
    )
    result = FileSkillSource(tmp_path).load()
    assert result.skills[0].skill.scope.kind == "tenant"
    assert result.skills[0].skill.scope.tenant_id == "mintral"
