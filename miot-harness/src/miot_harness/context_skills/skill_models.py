"""Skill manifest schema.

Two skill kinds, discriminated by `kind`:

- `playbook` — instructions + which EXISTING registered tools to use +
  when to use them. Surfaced as progressive-disclosure guidance; adds no
  new executable capability.
- `http` — a declarative HTTP tool definition compiled into a callable
  `HarnessTool` at boot (see `connector_factory.build_http_tool`).

MCP connectors are a later variant: add an `McpConnectorSkill` to the
`Skill` union and a matching branch in the connector factory — no other
code changes.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

from miot_harness.context_skills.models import ContextScope

HttpMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE"]


class _ConnectionBinding(BaseModel):
    """Optional binding of a skill to a live connection / capability (Phase 4).

    - `connection`: a connection NAME. The skill is eligible only when an
      enabled connection with that name booted (so its tools resolve).
    - `requires_capability`: a capability flag. Eligible only when some
      enabled connection declares that capability True.

    Both may be set (AND semantics). A skill that sets neither is always
    eligible — unchanged behaviour. Binding composes with `scope`: a skill
    may be both tenant-scoped and connection-bound. The loader gates
    eligibility against the active connection set at boot.
    """

    # min_length guards against an empty-string binding (e.g. `connection: ""`
    # from YAML), which would otherwise look bound and be dropped/warned in a
    # confusing way. An empty value fails validation → a load diagnostic.
    connection: str | None = Field(default=None, min_length=1)
    requires_capability: str | None = Field(default=None, min_length=1)


class PlaybookSkill(_ConnectionBinding):
    """Guidance over existing tools. No new executable capability."""

    kind: Literal["playbook"]
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str = ""
    # Progressive-disclosure trigger text shown in the skills index.
    when_to_use: str = ""
    # Names of tools that must already be registered (datasource or
    # connector). Validated against the live registry at boot — an unknown
    # tool is a warning, not a hard failure (the datasource may be
    # legitimately disabled, so its tools aren't registered).
    tools: tuple[str, ...] = ()
    # Relative path (from the manifest's dir) to a Markdown playbook body,
    # loaded on demand rather than dumped into every prompt.
    playbook_ref: str | None = None
    scope: ContextScope = ContextScope()


class HttpConnectorSkill(_ConnectionBinding):
    """A declarative HTTP tool definition → a callable `HarnessTool`."""

    kind: Literal["http"]
    id: str = Field(min_length=1)
    # Base tool name; the loader namespaces it as `skill_<id>` (global) or
    # `skill_<tenant>_<id>` (tenant) before registering.
    tool_name: str = Field(min_length=1)
    description: str = ""
    method: HttpMethod = "GET"
    # May contain {placeholders} bound from validated input into the
    # path/query of a FIXED base URL. Placeholders may not alter
    # scheme/host (SSRF guard enforced in the connector factory).
    url: str = Field(min_length=1)
    # read_only tools execute without approval; mutating ones route
    # through the existing "ask" → approval-gate path in HarnessTool.
    read_only: bool = True
    destructive: bool = False
    # JSON-schema-lite object: {type: object, properties: {...},
    # required: [...]}. Compiled into a pydantic input model at boot.
    input_schema: dict[str, Any] = Field(default_factory=lambda: {"type": "object"})
    # Header values may ONLY be "${ENV_VAR}" secret references, resolved
    # from os.environ at call time. A literal-looking secret is rejected
    # at load with a diagnostic — secrets never live in mounted files.
    headers: dict[str, str] = Field(default_factory=dict)
    timeout_seconds: float = Field(default=10.0, gt=0)
    scope: ContextScope = ContextScope()


Skill = Annotated[PlaybookSkill | HttpConnectorSkill, Field(discriminator="kind")]


class LoadedSkill(BaseModel):
    """A validated skill plus material resolved at load time."""

    skill: Skill
    # Resolved Markdown body for playbook skills (None for connectors or
    # when no playbook_ref was given).
    playbook_body: str | None = None
    source_path: str = ""


class SkillSummary(BaseModel):
    """Compact, API-facing projection of a skill for listing / autocomplete.

    Mirrors the meta-catalog skill index: `description` / `when_to_use` are
    the trigger text a `/skills`-style picker shows. `source` distinguishes
    an Agent-Skills `SKILL.md` directory skill from a YAML manifest.
    """

    id: str
    name: str
    description: str = ""
    when_to_use: str = ""
    scope: Literal["global", "tenant"] = "global"
    source: Literal["skill_md", "manifest"] = "manifest"
    # Phase 4 connection binding, surfaced so a `/skills` picker can badge a
    # skill with the connection / capability it lights up for. None when the
    # skill is unbound (eligible everywhere). The skill only appears at all when
    # its binding is already satisfied (the loader gates eligibility at boot).
    connection: str | None = None
    requires_capability: str | None = None
