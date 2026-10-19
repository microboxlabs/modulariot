"""The knowledge store: each layer's file, versions, history, revert and the
guards on paths and content."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml
from pydantic import ValidationError

from miot_harness.datasource.knowledge.loader import load_connection_cards
from miot_harness.knowledge.changes import KnowledgeChange
from miot_harness.knowledge.store import (
    ConnectionTarget,
    KnowledgeError,
    KnowledgeStore,
    virtual_path,
)
from miot_harness.knowledge.tenant_overlays import TenantOverlays

_CONNECTION = "---\nname: db\nbackend: postgres\noptions:\n  tenant_lock: t1\n---\n\nOld primer.\n"


def _store(tmp_path: Path, tenant: str = "t1") -> KnowledgeStore:
    conns = tmp_path / "connections"
    for name, lock in (("db", "t1"), ("shared", None), ("other", "t2")):
        (conns / name).mkdir(parents=True, exist_ok=True)
        (conns / name / "connection.md").write_text(
            _CONNECTION.replace("t1", lock or "none"), encoding="utf-8"
        )
    return KnowledgeStore(
        tenant_id=tenant,
        root=tmp_path,
        context_dir=tmp_path / "context",
        skills_dir=tmp_path / "skills",
        connections=[
            ConnectionTarget("db", conns / "db", "t1", cards=True),
            ConnectionTarget("shared", conns / "shared", None, cards=True),
            ConnectionTarget("other", conns / "other", "t2", cards=True),
        ],
    )


def test_fact_is_a_loadable_card_with_versions(tmp_path: Path) -> None:
    store = _store(tmp_path)
    first = store.put(
        "fact", "loaded-trips", target="db", title="Loaded trips", content="Rows in active_trips."
    )
    assert first["version"] == 1
    cards = load_connection_cards(tmp_path / "connections" / "db" / "knowledge").cards
    assert [c.body for c in cards] == ["Rows in active_trips."]

    second = store.put(
        "fact",
        "loaded-trips",
        target="db",
        title="Loaded trips",
        content="Rows in active_trips, status ADDED or SCHEDULED.",
        reason="add statuses",
        author="trainer-1",
    )
    assert second["version"] == 2
    assert second["updated_by"] == "trainer-1"
    assert [h["version"] for h in second["history"]] == [2, 1]
    assert second["history"][0]["reason"] == "add statuses"
    old = store.read_version("fact", "loaded-trips", 1, target="db")
    assert old["content"] == "Rows in active_trips."


def test_history_sidecar_has_provenance(tmp_path: Path) -> None:
    store = _store(tmp_path)
    store.put(
        "rule",
        "cargado",
        title="Cargado",
        content="Sent to the tracking database.",
        provenance={"run_id": "r1"},
    )
    sidecar = tmp_path / ".history" / "rule" / "t1" / "cargado" / "0001.json"
    entry = json.loads(sidecar.read_text())
    assert entry["provenance"] == {"run_id": "r1"}
    assert set(entry) >= {"version", "updated_at", "updated_by", "reason", "provenance"}


def test_rule_and_skill_files_are_read_by_the_live_overlays(tmp_path: Path) -> None:
    store = _store(tmp_path)
    store.put("rule", "cargado", title="Cargado", content="Means sent to tracking.")
    store.put("skill", "count-trips", title="Count trips loaded today", content="1. Query.")
    overlays = TenantOverlays(tmp_path / "context", tmp_path / "skills")
    assert [(r.id, r.content) for r in overlays.rules("t1")] == [
        ("cargado", "Means sent to tracking.")
    ]
    [skill] = overlays.skills("t1")
    assert skill.skill.id == "count-trips"
    assert skill.skill.description == "Count trips loaded today"
    assert skill.playbook_body == "1. Query."
    assert overlays.rules("t2") == ()


def test_delete_then_revert_restores(tmp_path: Path) -> None:
    store = _store(tmp_path)
    store.put("skill", "count-trips", title="Count", content="Steps.")
    store.delete("skill", "count-trips", reason="obsolete")
    assert not (tmp_path / "skills" / "tenants" / "t1" / "learned" / "count-trips").exists()
    with pytest.raises(KnowledgeError) as missing:
        store.read("skill", "count-trips")
    assert missing.value.status == 404
    deleted = store.read_version("skill", "count-trips", 2)
    assert deleted["meta"] == {"deleted": True}

    restored = store.revert("skill", "count-trips", 1)
    assert restored["version"] == 3
    assert restored["content"] == "Steps."
    assert restored["history"][0]["reason"] == "revert to version 1"


def test_identical_write_adds_no_version(tmp_path: Path) -> None:
    store = _store(tmp_path)
    store.put("rule", "r", title="R", content="Same.")
    again = store.put("rule", "r", title="R", content="Same.")
    assert again["version"] == 1


def test_hand_edit_is_recorded_before_the_next_write(tmp_path: Path) -> None:
    store = _store(tmp_path)
    store.put("rule", "r", title="R", content="One.")
    live = tmp_path / "context" / "tenants" / "t1" / "learned" / "r.md"
    live.write_text(live.read_text().replace("One.", "Hand."), encoding="utf-8")
    assert store.read("rule", "r")["version"] == 2
    item = store.put("rule", "r", title="R", content="Three.")
    assert item["version"] == 3
    assert store.read_version("rule", "r", 2)["content"] == "Hand."


def test_primer_keeps_the_frontmatter(tmp_path: Path) -> None:
    store = _store(tmp_path)
    item = store.put("primer", "db", title="ignored", content="New primer.")
    assert item["content"] == "New primer."
    text = (tmp_path / "connections" / "db" / "connection.md").read_text()
    assert text.startswith("---\nname: db\nbackend: postgres")
    assert "tenant_lock: t1" in text
    assert "New primer." in text
    assert "Old primer." not in text

    changed_head = text.replace("tenant_lock: t1", "tenant_lock: t9")
    with pytest.raises(KnowledgeError) as refused:
        store.write_file("primer", "db", changed_head)
    assert refused.value.status == 400

    reverted = store.revert("primer", "db", 1)
    assert reverted["content"] == "Old primer."


def test_primer_only_for_connections_locked_to_the_tenant(tmp_path: Path) -> None:
    store = _store(tmp_path)
    for conn, status in (("shared", 403), ("other", 403), ("nope", 404)):
        with pytest.raises(KnowledgeError) as refused:
            store.put("primer", conn, content="x")
        assert refused.value.status == status
    with pytest.raises(KnowledgeError):
        store.delete("primer", "db")


def test_fact_on_another_tenants_connection_is_refused(tmp_path: Path) -> None:
    store = _store(tmp_path)
    with pytest.raises(KnowledgeError) as refused:
        store.put("fact", "x", target="other", content="Meaning.")
    assert refused.value.status == 403
    assert store.targets("fact") == ["db", "shared"]


@pytest.mark.parametrize(
    ("layer", "item_id", "target"),
    [
        ("rule", "../../escape", None),
        ("rule", "..", None),
        ("skill", "a/b", None),
        ("fact", "x", "../db"),
        ("eval", ".hidden", None),
    ],
)
def test_path_traversal_is_refused(
    tmp_path: Path, layer: str, item_id: str, target: str | None
) -> None:
    store = _store(tmp_path)
    with pytest.raises(KnowledgeError) as refused:
        store.put(layer, item_id, target=target, title="t", content="c")
    assert refused.value.status in (400, 404)
    assert not (tmp_path / "escape.md").exists()


def test_tenant_must_be_one_path_segment(tmp_path: Path) -> None:
    with pytest.raises(KnowledgeError):
        _store(tmp_path, tenant="../t1")


def test_new_ids_must_be_slugs(tmp_path: Path) -> None:
    store = _store(tmp_path)
    with pytest.raises(KnowledgeError) as refused:
        store.put("rule", "Not_A_Slug", content="x")
    assert refused.value.status == 400


def test_personal_data_is_refused(tmp_path: Path) -> None:
    store = _store(tmp_path)
    for layer, target in (("fact", "db"), ("rule", None), ("skill", None), ("primer", None)):
        item_id = "db" if layer == "primer" else "contact"
        with pytest.raises(KnowledgeError) as refused:
            store.put(layer, item_id, target=target, content="Write to someone@example.com")
        assert refused.value.status == 400


def test_notes_are_read_and_delete_only(tmp_path: Path) -> None:
    store = _store(tmp_path)
    notes = tmp_path / "connections" / "db" / "memory" / "t1"
    notes.mkdir(parents=True)
    (notes / "units.md").write_text("---\ntitle: Units\nkind: fact\n---\nKilograms.\n")
    item = store.read("note", "units", target="db")
    assert (item["title"], item["content"]) == ("Units", "Kilograms.")
    with pytest.raises(KnowledgeError) as refused:
        store.put("note", "units", target="db", content="Grams.")
    assert refused.value.status == 405
    store.delete("note", "units", target="db")
    assert not (notes / "units.md").exists()
    assert store.revert("note", "units", 1, target="db")["content"] == "Kilograms."


def test_eval_case_keeps_expected_skills(tmp_path: Path) -> None:
    store = _store(tmp_path)
    item = store.put(
        "eval",
        "trips-today",
        title="How many trips were loaded today?",
        content="Counts active_trips rows created today.",
        meta={"expect_skill": "count-trips", "expect_no_skill": ["other"]},
        provenance={"thread": "x"},
    )
    assert item["meta"] == {
        "expect_skill": "count-trips",
        "expect_no_skill": ["other"],
        "source": {"thread": "x"},
    }
    doc = yaml.safe_load((tmp_path / "evals" / "tenants" / "t1" / "trips-today.yaml").read_text())
    assert doc["question"] == "How many trips were loaded today?"
    with pytest.raises(KnowledgeError):
        store.put("eval", "no-question", content="x")


# What an agent passed as an eval case's content in a live session: the whole
# case as YAML, stored as the expectation with the question repeated inside.
_QUESTION = "¿Cuántos viajes han sido cargados en modular hoy?"
_EXPECTATION = (
    "No se puede responder con exactitud porque live_trip no tiene columna created_at "
    "ni fecha de carga. Lo que se puede reportar es el total de servicios actualmente en "
    "live_trip (monitoreados), filtrando por created_by_client_id = 'tenant-a', "
    "desglosado por status (ADDED y SCHEDULED). historical_trip no cuenta porque son "
    "servicios ya terminados."
)
_WHOLE_CASE = f"question: {_QUESTION}\n\nexpectation: {_EXPECTATION}"


def test_eval_content_given_as_a_whole_case_is_stored_flat(tmp_path: Path) -> None:
    store = _store(tmp_path)
    item = store.put(
        "eval",
        "viajes-cargados-modular-hoy",
        title=_QUESTION,
        content=_WHOLE_CASE,
        provenance={"conversation_id": "c1"},
    )
    assert (item["title"], item["content"]) == (_QUESTION, _EXPECTATION)
    path = tmp_path / "evals" / "tenants" / "t1" / "viajes-cargados-modular-hoy.yaml"
    doc = yaml.safe_load(path.read_text())
    assert doc == {
        "question": _QUESTION,
        "expectation": _EXPECTATION,
        "source": {"conversation_id": "c1"},
    }


def test_eval_content_as_a_mapping_carries_the_case_fields(tmp_path: Path) -> None:
    store = _store(tmp_path)
    content = yaml.safe_dump(
        {"question": "Q?", "expectation": "A.", "expect_skill": "trips", "checks": ["x"]}
    )
    item = store.put("eval", "q", content=content)
    assert (item["title"], item["content"]) == ("Q?", "A.")
    assert item["meta"] == {"expect_skill": "trips", "checks": ["x"]}
    with pytest.raises(KnowledgeError, match="unknown eval case keys expected"):
        store.put("eval", "q2", content="question: Q?\nexpected: A.")
    with pytest.raises(KnowledgeError, match="differs from the title"):
        store.put("eval", "q3", title="Other?", content="question: Q?\nexpectation: A.")


def test_a_nested_eval_file_is_refused_on_write_and_read_flat(tmp_path: Path) -> None:
    store = _store(tmp_path)
    nested = yaml.safe_dump({"question": _QUESTION, "expectation": _WHOLE_CASE}, allow_unicode=True)
    with pytest.raises(KnowledgeError, match="holds a whole eval case"):
        store.write_file("eval", "viajes", nested)
    # A case saved before the check still reads as a plain case.
    path = tmp_path / "evals" / "tenants" / "t1" / "viajes.yaml"
    path.parent.mkdir(parents=True)
    path.write_text(nested, encoding="utf-8")
    item = store.read("eval", "viajes")
    assert (item["title"], item["content"]) == (_QUESTION, _EXPECTATION)


def test_conversation_undo_restores_what_the_runs_read_before(tmp_path: Path) -> None:
    store = _store(tmp_path)
    before, session = {"conversation_id": "c0"}, {"conversation_id": "c1"}
    store.put("fact", "old", target="db", title="Old", content="Before.", provenance=before)
    store.put("fact", "old", target="db", title="Old", content="After.", provenance=session)
    store.put("fact", "new", target="db", title="New", content="Created.", provenance=session)
    store.put("rule", "gone", title="Gone", content="Deleted later.", provenance=before)
    store.delete("rule", "gone", provenance=session)
    store.put("primer", "db", content="New primer.", provenance=session)
    store.put("eval", "case", title="Q?", content="A.", provenance=session)

    undo = {(c.layer, c.id): c for c in store.conversation_undo("c1")}

    assert set(undo) == {("fact", "old"), ("fact", "new"), ("rule", "gone"), ("primer", "db")}
    assert (undo["fact", "old"].op, undo["fact", "old"].content) == ("upsert", "Before.")
    assert undo["fact", "old"].target == "db"
    assert undo["fact", "new"].op == "delete"
    assert (undo["rule", "gone"].op, undo["rule", "gone"].title) == ("upsert", "Gone")
    assert (undo["primer", "db"].op, undo["primer", "db"].content) == ("upsert", "Old primer.")
    assert store.conversation_undo("c2") == []


def test_conversation_undo_treats_an_unreadable_prior_file_as_absent(tmp_path: Path) -> None:
    store = _store(tmp_path)
    rules = tmp_path / "context" / "tenants" / "t1" / "learned"
    rules.mkdir(parents=True)
    (rules / "broken.md").write_text("---\n- not a mapping\n---\n\nBody.\n", encoding="utf-8")
    store.put(
        "rule", "broken", title="Fixed", content="Fixed.", provenance={"conversation_id": "c1"}
    )

    [undo] = store.conversation_undo("c1")
    assert (undo.layer, undo.id, undo.op) == ("rule", "broken", "delete")


def test_layers_listing(tmp_path: Path) -> None:
    store = _store(tmp_path)
    store.put("fact", "f", target="shared", title="F", content="Meaning.")
    store.put("rule", "r", title="R", content="Rule.")
    layers = {layer["layer"]: layer for layer in store.layers()}
    assert list(layers) == ["fact", "rule", "skill", "primer", "note", "eval"]
    assert layers["fact"]["targets"] == ["db", "shared"]
    assert layers["fact"]["items"] == [
        {
            "id": "f",
            "title": "F",
            "target": "shared",
            "updated_at": layers["fact"]["items"][0]["updated_at"],
            "updated_by": "",
            "version": 1,
        }
    ]
    assert layers["primer"]["targets"] == ["db"]
    assert [i["id"] for i in layers["primer"]["items"]] == ["db"]
    assert layers["note"]["editable"] is False
    assert _store(tmp_path, tenant="t2").layers()[1]["items"] == []


# ---- virtual tree ----------------------------------------------------------


@pytest.mark.parametrize(
    ("path", "layer", "item_id", "target"),
    [
        ("rules/cargado.md", "rule", "cargado", None),
        ("skills/count-trips/SKILL.md", "skill", "count-trips", None),
        ("facts/db/loaded.md", "fact", "loaded", "db"),
        ("primers/db.md", "primer", "db", None),
        ("evals/trips.yaml", "eval", "trips", None),
        ("notes/db/units.md", "note", "units", "db"),
    ],
)
def test_virtual_paths_round_trip(
    tmp_path: Path, path: str, layer: str, item_id: str, target: str | None
) -> None:
    ref = _store(tmp_path).resolve_path(path)
    assert (ref.layer, ref.id, ref.target) == (layer, item_id, target)
    assert ref.writable is (layer != "note")
    assert virtual_path(layer, item_id, target) == path


@pytest.mark.parametrize(
    "path",
    ["", "rules/../x.md", "rules/x.txt", "skills/x/other.md", "facts/other/x.md", "base/x"],
)
def test_bad_virtual_paths_are_refused(tmp_path: Path, path: str) -> None:
    store = _store(tmp_path)
    with pytest.raises(KnowledgeError):
        store.resolve_path(path)


def test_tree_lists_items_and_base_views(tmp_path: Path) -> None:
    store = _store(tmp_path)
    (tmp_path / "skills" / "analyst").mkdir(parents=True)
    (tmp_path / "skills" / "analyst" / "SKILL.md").write_text("---\nname: analyst\n---\nBody\n")
    (tmp_path / "context" / "tenants" / "t2").mkdir(parents=True)
    (tmp_path / "context" / "tenants" / "t2" / "secret.md").write_text("Other tenant.")
    (tmp_path / "context" / "tenants" / "t1").mkdir(parents=True)
    (tmp_path / "context" / "tenants" / "t1" / "own.md").write_text("Own static context.")
    store.put("rule", "cargado", title="Cargado", content="Rule.")
    tree = {e["path"]: e for e in store.tree()}
    assert tree["rules/cargado.md"]["writable"] is True
    assert tree["primers/db.md"]["layer"] == "primer"
    assert tree["base/skills/analyst/SKILL.md"]["writable"] is False
    assert "base/context/tenants/t1/own.md" in tree
    assert "base/context/tenants/t2/secret.md" not in tree
    assert "base/context/tenants/t1/learned/cargado.md" not in tree
    assert store.read_path("base/skills/analyst/SKILL.md").startswith("---")
    assert "Rule." in store.read_path("rules/cargado.md")
    with pytest.raises(KnowledgeError):
        store.read_path("base/context/tenants/t2/secret.md")


def test_a_primer_delete_change_is_refused() -> None:
    with pytest.raises(ValidationError):
        KnowledgeChange(layer="primer", id="db", op="delete")


def test_history_keeps_its_lock_out_of_the_versions(tmp_path: Path) -> None:
    store = _store(tmp_path)
    store.put("rule", "r", title="R", content="One.")
    store.put("rule", "r", title="R", content="Two.")
    store.delete("rule", "r")
    history = tmp_path / ".history" / "rule" / "t1" / "r"
    assert (history / ".lock").exists()
    assert sorted(p.name for p in history.glob("*.json")) == ["0001.json", "0002.json", "0003.json"]
