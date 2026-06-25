"""Tests for the GET /skills listing endpoint (skills autocomplete/picker)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from miot_harness.api.server import create_app
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.context_skills.skill_models import LoadedSkill, PlaybookSkill


def _bundle() -> ContextSkillsBundle:
    return ContextSkillsBundle(
        playbook_skills=(
            LoadedSkill(
                skill=PlaybookSkill(
                    kind="playbook",
                    id="skill-creator",
                    name="skill-creator",
                    description="Create new skills.",
                    when_to_use="Create new skills.",
                ),
                source_path="/w/skills/skill-creator/SKILL.md",
            ),
            LoadedSkill(
                skill=PlaybookSkill(
                    kind="playbook",
                    id="delivery-compliance-story",
                    name="Delivery Compliance Story",
                    description="Delivery compliance.",
                ),
                source_path="/w/skills/playbooks/delivery.yaml",
            ),
        )
    )


def test_skills_lists_bundle_with_source_badge() -> None:
    app = create_app()
    with TestClient(app) as client:
        app.state.harness.context_skills = _bundle()
        resp = client.get("/skills")
    assert resp.status_code == 200
    body = resp.json()
    by_id = {s["id"]: s for s in body}
    assert by_id["skill-creator"]["source"] == "skill_md"
    assert by_id["delivery-compliance-story"]["source"] == "manifest"
    # description doubles as the trigger for an Agent-Skills directory skill.
    assert by_id["skill-creator"]["when_to_use"] == "Create new skills."
    # Sorted by name (case-insensitive): "Delivery..." before "skill-creator".
    assert [s["name"] for s in body] == [
        "Delivery Compliance Story",
        "skill-creator",
    ]


def test_skills_empty_when_subsystem_absent() -> None:
    app = create_app()
    with TestClient(app) as client:
        app.state.harness.context_skills = None
        resp = client.get("/skills")
    assert resp.status_code == 200
    assert resp.json() == []


def test_skills_tenant_query_scopes_results() -> None:
    bundle = ContextSkillsBundle(
        playbook_skills=(
            LoadedSkill(
                skill=PlaybookSkill(kind="playbook", id="global-pb", name="Global"),
                source_path="/w/g.yaml",
            ),
            LoadedSkill(
                skill=PlaybookSkill(
                    kind="playbook",
                    id="mintral-pb",
                    name="Mintral",
                    scope={"kind": "tenant", "tenant_id": "mintral"},  # type: ignore[arg-type]
                ),
                source_path="/w/m.yaml",
            ),
        )
    )
    app = create_app()
    with TestClient(app) as client:
        app.state.harness.context_skills = bundle
        mintral = {s["id"] for s in client.get("/skills?tenant=mintral").json()}
        acme = {s["id"] for s in client.get("/skills?tenant=acme").json()}
    assert mintral == {"global-pb", "mintral-pb"}
    assert acme == {"global-pb"}
