"""Frozen system prompt for the single-agent loop.

This text is the prompt-cache prefix (together with the tool list), so it
must be a pure function of the datasource profile: no clock, no per-request
tenant, no uuids, no counters. Dynamic per-run context never goes here —
it rides in the user turn (see agent_loop._compose_human).

The rules merge the two seats the loop replaces: the agentic planner's
investigation-rigor rules and the synthesizer's answer rules.

Skills are progressive disclosure over the same prefix contract: only the
one-line index (trigger text) lives here; full playbook bodies arrive
mid-transcript as `load_skill` tool results, so pulling one never touches
the cached prefix.
"""

from __future__ import annotations

from langchain_core.messages import SystemMessage

from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.context_skills.skill_models import PlaybookSkill
from miot_harness.datasource.provider import DataSourceProfile

_AGENT_SYSTEM_TEMPLATE = """\
You are the {display_name} data agent ({tenant_display} fleet operations).
You investigate the user's question by calling tools, then write the final
answer yourself from the evidence those tools returned.

{primer}

Investigation rules:
- Prefer curated tools (the `{tool_prefix}*` functions); exploration
  primitives are a fallback for questions the curated catalog cannot answer.
- Never repeat a tool call you already made with identical arguments.
- Read any knowledge card at most once, then ACT on what it says.
{skills_block}
Rigor — do not answer from incomplete or fuzzy evidence:
- A grep / ILIKE result is a FUZZY sample, never an authoritative count or
  list. Do not report a total or enumerate items from a grep — run a precise
  query with an explicit WHERE; use COUNT(*) for totals.
- "List / give me / show me <items>" means ENUMERATE the actual rows — run a
  query that returns one row per item with its business attributes. A COUNT
  is not a list; never substitute a count, a sample, or an offer for the rows
  asked.
- If the items' attributes live in a related table (e.g. process variables,
  node properties), run the join/pivot query that returns the actual
  attributes (codes, names, references) before answering.
- Never state a number or list you have not obtained from a real tool result.
- Do not answer while a query you already identified as needed is still
  unrun, and do not defer it ("I can run it if you want") — run it now.

Answer rules (write in the same language as the question; be concise,
<= 200 words):
- Quote what is in the evidence; do not invent rows or numbers.
- If the evidence is empty or insufficient, say what you don't know.
- When asked what query you ran, quote the tool result's `executed_sql`
  verbatim.
- If a tool result is marked stale (`is_stale` / `freshness_status`), caveat
  the answer and cite its `refreshed_at` timestamp.
- Do not mention the internal pipeline or raw tool names in the answer.
- Prior assistant turns in this conversation were produced by real curated
  tools. Treat their numbers, tables, and claims as authoritative evidence —
  do NOT claim you fabricated them.
"""


_SKILLS_BLOCK_TEMPLATE = """
Skills (domain playbooks — the index below is intentionally terse):
{index}
When the question matches a skill's trigger, call `load_skill` with its id
BEFORE planning queries, then follow the loaded instructions. Load each
skill at most once per conversation.
"""


def render_skills_index(
    bundle: ContextSkillsBundle | None, profile: DataSourceProfile
) -> str:
    """One line per eligible playbook for the frozen prefix.

    Resolved against `profile.tenant_lock` (an open profile sees only
    global skills) and filtered to this profile's connection — the same
    scoping as the legacy planner catalog, and the same the loop re-applies
    when a `load_skill` call arrives — so the text is a pure function of
    (profile, bundle) and the cache prefix stays byte-stable. Returns ""
    when nothing is eligible; the skills block is omitted entirely then.
    """
    if bundle is None:
        return ""
    lines: list[str] = []
    for loaded in bundle.playbooks_for(
        profile.tenant_lock or "", connection=profile.name
    ):
        skill = loaded.skill
        assert isinstance(skill, PlaybookSkill)  # playbooks_for guarantees
        # Collapse whitespace: one entry is one line, and an author's
        # newline must not forge extra index bullets.
        trigger = " ".join(
            (skill.when_to_use or skill.description or skill.name).split()
        )
        steps = f" Steps: {' → '.join(skill.tools)}." if skill.tools else ""
        guide = " Full guide: `load_skill`." if loaded.playbook_body else ""
        lines.append(f"- {skill.id}: {trigger}{steps}{guide}")
    return "\n".join(lines)


def build_agent_system_prompt(
    profile: DataSourceProfile, *, skills_index: str = ""
) -> str:
    skills_block = (
        _SKILLS_BLOCK_TEMPLATE.format(index=skills_index) if skills_index else ""
    )
    return _AGENT_SYSTEM_TEMPLATE.format(
        display_name=profile.display_name,
        tenant_display=(profile.tenant_lock or profile.display_name).capitalize(),
        primer=profile.primer,
        tool_prefix=profile.tool_prefix,
        skills_block=skills_block,
    )


def cached_system_message(text: str) -> SystemMessage:
    """System message with the prefix cache breakpoint.

    Marking the last (only) system block caches `tools + system` together —
    the API renders tools before system, so one breakpoint covers both.
    """
    return SystemMessage(
        content=[{"type": "text", "text": text, "cache_control": {"type": "ephemeral"}}]
    )
