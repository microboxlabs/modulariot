from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.context_skills.skill_models import LoadedSkill, PlaybookSkill
from miot_harness.runtime.agent_prompt import (
    build_agent_system_prompt,
    cached_system_message,
    render_skills_index,
)
from tests.fixtures.fake_provider import FAKE_PROFILE


def _playbook(
    skill_id: str = "pending-deliveries",
    *,
    body: str | None = "1. Query tasks.\n2. Join variables.",
    connection: str | None = None,
    scope_kind: str = "global",
    tenant_id: str | None = None,
) -> LoadedSkill:
    return LoadedSkill(
        skill=PlaybookSkill(
            kind="playbook",
            id=skill_id,
            name=skill_id.replace("-", " ").title(),
            when_to_use="User asks which services are pending delivery.",
            tools=("fake_kpi_summary", "fake_alpha_query"),
            connection=connection,
            scope={"kind": scope_kind, "tenant_id": tenant_id},
        ),
        playbook_body=body,
        source_path=f"/skills/{skill_id}/SKILL.md",
    )


def _bundle(*skills: LoadedSkill) -> ContextSkillsBundle:
    return ContextSkillsBundle(playbook_skills=tuple(skills))


def test_prompt_is_byte_stable():
    assert build_agent_system_prompt(FAKE_PROFILE) == build_agent_system_prompt(
        FAKE_PROFILE
    )


def test_prompt_carries_rigor_and_answer_rules():
    text = build_agent_system_prompt(FAKE_PROFILE)
    assert "FakeSource" in text
    assert FAKE_PROFILE.primer in text
    assert "fake_" in text                 # curated prefix guidance

    # Planner rigor rules
    assert "FUZZY sample" in text
    assert "ENUMERATE the actual rows" in text
    assert "join/pivot query" in text
    assert "identified as needed" in text

    # Synthesizer answer rules
    assert "do not invent rows" in text
    assert "executed_sql" in text
    assert "refreshed_at" in text
    assert "same language as the question" in text
    assert "200 words" in text
    assert "do NOT claim you fabricated them" in text


def test_prompt_has_no_dynamic_markers():
    import re

    text = build_agent_system_prompt(FAKE_PROFILE)
    # No interpolated clock/uuid/request state — these would silently
    # invalidate the prompt-cache prefix on every request.
    assert not re.search(r"\d{4}-\d{2}-\d{2}T\d{2}:", text)
    assert "{" not in text.replace("{}", "")  # no unrendered placeholders


def test_cached_system_message_has_single_ephemeral_breakpoint():
    msg = cached_system_message("hello")
    assert isinstance(msg.content, list) and len(msg.content) == 1
    block = msg.content[0]
    assert block["type"] == "text"
    assert block["text"] == "hello"
    assert block["cache_control"] == {"type": "ephemeral"}


def test_skills_index_renders_one_line_per_eligible_skill():
    index = render_skills_index(_bundle(_playbook()), FAKE_PROFILE)
    assert index == (
        "- pending-deliveries: User asks which services are pending "
        "delivery. Steps: fake_kpi_summary → fake_alpha_query. "
        "Full guide: `load_skill`."
    )


def test_skills_index_omits_load_marker_for_bodyless_skill():
    index = render_skills_index(_bundle(_playbook(body=None)), FAKE_PROFILE)
    assert "load_skill" not in index
    assert "pending-deliveries" in index


def test_skills_index_filters_other_connections_and_tenants():
    index = render_skills_index(
        _bundle(
            _playbook("other-conn", connection="not-fake"),
            _playbook("other-tenant", scope_kind="tenant", tenant_id="rival"),
            _playbook("locked-tenant", scope_kind="tenant", tenant_id="acme"),
        ),
        FAKE_PROFILE,  # profile.name="fake", tenant_lock="acme"
    )
    assert "other-conn" not in index
    assert "other-tenant" not in index
    assert "locked-tenant" in index


def test_skills_index_empty_without_bundle():
    assert render_skills_index(None, FAKE_PROFILE) == ""
    assert render_skills_index(_bundle(), FAKE_PROFILE) == ""


def test_prompt_with_skills_block_is_byte_stable_and_gated():
    index = render_skills_index(_bundle(_playbook()), FAKE_PROFILE)
    with_skills = build_agent_system_prompt(FAKE_PROFILE, skills_index=index)
    assert with_skills == build_agent_system_prompt(
        FAKE_PROFILE, skills_index=index
    )
    assert "pending-deliveries" in with_skills
    assert "call `load_skill`" in with_skills
    # No index → the whole skills block is omitted, not rendered empty.
    without = build_agent_system_prompt(FAKE_PROFILE)
    assert "load_skill" not in without
    assert "Skills" not in without
