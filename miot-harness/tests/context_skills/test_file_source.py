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


def test_skill_source_playbook_ref_traversal_blocked(tmp_path: Path) -> None:
    secret = tmp_path / "secret.md"
    secret.write_text("TOP SECRET", encoding="utf-8")
    _write(
        tmp_path / "skills" / "p.yaml",
        "kind: playbook\nid: p1\nname: P1\nplaybook_ref: ../secret.md\n",
    )
    result = FileSkillSource(tmp_path / "skills").load()
    assert len(result.skills) == 1
    # The traversal must NOT read the out-of-tree file.
    assert result.skills[0].playbook_body is None
    assert any("escapes" in d.message for d in result.diagnostics)


def test_context_source_skips_k8s_projected_volume_dirs(tmp_path: Path) -> None:
    # Mimic a K8s ConfigMap projection: the real file plus a "..data"
    # snapshot copy. Only the real top-level file should be ingested.
    _write(tmp_path / "00-system.yaml", "id: system-base\nprimer_text: ok\n")
    _write(tmp_path / "..2026_06_17" / "00-system.yaml", "id: dup\nprimer_text: dup\n")

    result = FileContextSource(tmp_path).load()

    assert [c.id for c in result.contexts] == ["system-base"]
    assert result.diagnostics == ()


def test_skill_source_tenant_scope_from_dir(tmp_path: Path) -> None:
    _write(
        tmp_path / "tenants" / "mintral" / "s.yaml",
        "kind: http\nid: s1\ntool_name: t\nurl: https://x.example/t\n",
    )
    result = FileSkillSource(tmp_path).load()
    assert result.skills[0].skill.scope.kind == "tenant"
    assert result.skills[0].skill.scope.tenant_id == "mintral"


def test_skill_source_loads_skill_md_directory_skill(tmp_path: Path) -> None:
    # An Agent-Skills standard directory skill: a folder with a SKILL.md
    # (YAML frontmatter + Markdown body) and arbitrary auxiliary files.
    _write(
        tmp_path / "skill-creator" / "SKILL.md",
        "---\n"
        "name: skill-creator\n"
        "description: Create new skills. Use when authoring a skill.\n"
        "---\n"
        "# Skill Creator\n\nStep one: decide what the skill does.\n",
    )
    _write(tmp_path / "skill-creator" / "scripts" / "run.py", "print('hi')\n")

    result = FileSkillSource(tmp_path).load()

    assert result.diagnostics == ()
    assert len(result.skills) == 1
    loaded = result.skills[0]
    assert isinstance(loaded.skill, PlaybookSkill)
    assert loaded.skill.id == "skill-creator"
    assert loaded.skill.name == "skill-creator"
    # In the standard, description doubles as the trigger text.
    assert loaded.skill.when_to_use == loaded.skill.description
    assert loaded.skill.description.startswith("Create new skills")
    assert loaded.skill.scope.kind == "global"
    assert loaded.skill.tools == ()
    assert loaded.playbook_body is not None
    assert loaded.playbook_body.startswith("# Skill Creator")
    # Auxiliary files are NOT ingested as their own skills.
    assert [s.skill.id for s in result.skills] == ["skill-creator"]


def test_skill_source_skill_md_name_falls_back_to_dir(tmp_path: Path) -> None:
    _write(
        tmp_path / "my-skill" / "SKILL.md",
        "---\ndescription: does a thing\n---\nbody\n",
    )
    result = FileSkillSource(tmp_path).load()
    assert result.skills[0].skill.id == "my-skill"


def test_skill_source_skill_md_tenant_scope_from_dir(tmp_path: Path) -> None:
    _write(
        tmp_path / "tenants" / "mintral" / "greeter" / "SKILL.md",
        "---\nname: greeter\ndescription: greet\n---\nhi\n",
    )
    result = FileSkillSource(tmp_path).load()
    assert result.skills[0].skill.scope.kind == "tenant"
    assert result.skills[0].skill.scope.tenant_id == "mintral"


def test_skill_source_skill_md_malformed_frontmatter_isolated(tmp_path: Path) -> None:
    # No closing fence -> diagnostic, skipped; the sibling still loads.
    _write(tmp_path / "bad" / "SKILL.md", "---\nname: bad\nno closing fence\n")
    _write(
        tmp_path / "good" / "SKILL.md",
        "---\nname: good\ndescription: ok\n---\nbody\n",
    )
    result = FileSkillSource(tmp_path).load()
    assert [s.skill.id for s in result.skills] == ["good"]
    assert any(
        d.level == "error" and d.path.endswith("SKILL.md") for d in result.diagnostics
    )


def test_skill_source_skill_md_coexists_with_yaml(tmp_path: Path) -> None:
    _write(
        tmp_path / "playbooks" / "p.yaml",
        "kind: playbook\nid: p1\nname: P1\n",
    )
    _write(
        tmp_path / "creator" / "SKILL.md",
        "---\nname: creator\ndescription: d\n---\nbody\n",
    )
    result = FileSkillSource(tmp_path).load()
    assert sorted(s.skill.id for s in result.skills) == ["creator", "p1"]
