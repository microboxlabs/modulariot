from pathlib import Path

from miot_harness.context_skills.seed import PACKAGED_DEFAULTS, refresh_defaults


def _tree(tmp_path: Path) -> tuple[Path, Path]:
    packaged = tmp_path / "packaged"
    (packaged / "miot-search").mkdir(parents=True)
    (packaged / "miot-search" / "SKILL.md").write_text("v1")
    (packaged / "00-system.yaml").write_text("sys v1")
    return packaged, tmp_path / "workspace" / "skills"


def test_an_empty_workspace_gets_every_packaged_file(tmp_path: Path) -> None:
    packaged, workspace = _tree(tmp_path)
    report = refresh_defaults(packaged, workspace)
    assert sorted(report.copied) == ["00-system.yaml", "miot-search/SKILL.md"]
    assert (workspace / "miot-search" / "SKILL.md").read_text() == "v1"


def test_a_new_packaged_version_replaces_a_file_nobody_edited(tmp_path: Path) -> None:
    packaged, workspace = _tree(tmp_path)
    refresh_defaults(packaged, workspace)
    (packaged / "miot-search" / "SKILL.md").write_text("v2")
    report = refresh_defaults(packaged, workspace)
    assert report.replaced == ["miot-search/SKILL.md"]
    assert report.backed_up == []
    assert (workspace / "miot-search" / "SKILL.md").read_text() == "v2"


def test_a_file_edited_in_place_is_kept(tmp_path: Path) -> None:
    packaged, workspace = _tree(tmp_path)
    refresh_defaults(packaged, workspace)
    (workspace / "miot-search" / "SKILL.md").write_text("operator edit")
    (packaged / "miot-search" / "SKILL.md").write_text("v2")
    report = refresh_defaults(packaged, workspace)
    assert report.kept_edited == ["miot-search/SKILL.md"]
    assert (workspace / "miot-search" / "SKILL.md").read_text() == "operator edit"


def test_an_unrecorded_stale_file_is_backed_up_then_replaced(tmp_path: Path) -> None:
    # A volume seeded by `cp -Rn` before this module existed has no record.
    packaged, workspace = _tree(tmp_path)
    (workspace / "miot-search").mkdir(parents=True)
    (workspace / "miot-search" / "SKILL.md").write_text("old seed")
    report = refresh_defaults(packaged, workspace)
    assert report.replaced == ["miot-search/SKILL.md"]
    assert report.backed_up == ["miot-search/SKILL.md"]
    assert (workspace / "miot-search" / "SKILL.md").read_text() == "v1"
    backups = list((workspace.parent / ".seed-state" / "backups").rglob("SKILL.md"))
    assert [b.read_text() for b in backups] == ["old seed"]


def test_workspace_only_files_are_left_alone(tmp_path: Path) -> None:
    packaged, workspace = _tree(tmp_path)
    overlay = workspace / "tenants" / "acme" / "overlay.yaml"
    overlay.parent.mkdir(parents=True)
    overlay.write_text("tenant")
    refresh_defaults(packaged, workspace)
    assert overlay.read_text() == "tenant"


def test_state_is_kept_outside_the_workspace_directory(tmp_path: Path) -> None:
    packaged, workspace = _tree(tmp_path)
    refresh_defaults(packaged, workspace)
    assert not any(p.name.startswith(".seed") for p in workspace.rglob("*"))
    assert (workspace.parent / ".seed-state" / "skills.json").is_file()


def test_the_packaged_directory_itself_is_never_touched(tmp_path: Path) -> None:
    report = refresh_defaults(PACKAGED_DEFAULTS / "skills", PACKAGED_DEFAULTS / "skills")
    assert report.copied == report.replaced == []


def test_a_symlinked_target_is_not_followed(tmp_path: Path) -> None:
    packaged, workspace = _tree(tmp_path)
    outside = tmp_path / "outside.txt"
    outside.write_text("keep me")
    (workspace / "miot-search").mkdir(parents=True)
    (workspace / "miot-search" / "SKILL.md").symlink_to(outside)
    refresh_defaults(packaged, workspace)
    assert outside.read_text() == "keep me"


def test_a_symlinked_directory_is_not_followed(tmp_path: Path) -> None:
    packaged, workspace = _tree(tmp_path)
    outside = tmp_path / "outside"
    outside.mkdir()
    workspace.mkdir(parents=True)
    (workspace / "miot-search").symlink_to(outside, target_is_directory=True)
    refresh_defaults(packaged, workspace)
    assert list(outside.iterdir()) == []


def test_a_record_that_is_not_an_object_is_ignored(tmp_path: Path) -> None:
    packaged, workspace = _tree(tmp_path)
    state = workspace.parent / ".seed-state"
    state.mkdir(parents=True)
    (state / "skills.json").write_text("null")
    report = refresh_defaults(packaged, workspace)
    assert sorted(report.copied) == ["00-system.yaml", "miot-search/SKILL.md"]


def test_an_unreadable_packaged_tree_does_not_raise(tmp_path: Path, monkeypatch) -> None:
    packaged, workspace = _tree(tmp_path)

    def boom(self: Path, pattern: str):
        raise PermissionError("denied")

    monkeypatch.setattr(Path, "rglob", boom)
    assert refresh_defaults(packaged, workspace).copied == []


def test_no_temporary_files_are_left_behind(tmp_path: Path) -> None:
    packaged, workspace = _tree(tmp_path)
    refresh_defaults(packaged, workspace)
    leftovers = [p for p in tmp_path.rglob(".*") if p.name.startswith(".") and p.is_file()]
    assert leftovers == []
