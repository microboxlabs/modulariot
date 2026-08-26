"""Parity tests for the packaged `miot-search` skill.

The skill body embeds a page inventory of the apps/app frontend (routes +
filter params) so the harness can answer spotlight searches with deep links.
That inventory must stay in lockstep with the app's navigation registry
(`pages-config.json`) and the actual Next.js pages:

- every navigable registry entry must be covered by the skill body, and
- every route the skill teaches must exist as a real page.

The checks read the frontend sources from the monorepo checkout and are
skipped when they are absent (e.g. running the tests from an installed
wheel/sdist) — only monorepo CI enforces parity.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

import miot_harness.context_skills as context_skills_pkg
from miot_harness.context_skills.file_source import FileSkillSource
from miot_harness.context_skills.skill_models import PlaybookSkill

_DEFAULT_SKILLS_DIR = Path(context_skills_pkg.__file__).parent / "defaults" / "skills"
_SKILL_MD = _DEFAULT_SKILLS_DIR / "miot-search" / "SKILL.md"

_REPO_ROOT = Path(__file__).resolve().parents[3]
_APP_ROOT = _REPO_ROOT / "turbo-repo" / "apps" / "app"
_PAGES_CONFIG = _APP_ROOT / "src" / "features" / "layout" / "models" / "pages-config.json"
_SECURED_PAGES_DIR = _APP_ROOT / "src" / "app" / "[lang]" / "(secured)"

# Backticked app-relative routes in the skill body, e.g. `/fleet-management`
# or `/mytasks?status=...`. Captures the static path prefix only: the capture
# stops at `?` (query) and `{` (dynamic-segment placeholder).
_ROUTE_RE = re.compile(r"`(/[a-z0-9\-/]+)[^`]*`")

requires_frontend_sources = pytest.mark.skipif(
    not (_PAGES_CONFIG.is_file() and _SECURED_PAGES_DIR.is_dir()),
    reason="apps/app sources not present (not a monorepo checkout)",
)


def _skill_body() -> str:
    return _SKILL_MD.read_text(encoding="utf-8")


def _body_routes() -> set[str]:
    """Static route paths the skill body references in inline code."""
    routes: set[str] = set()
    for match in _ROUTE_RE.finditer(_skill_body()):
        route = match.group(1).rstrip("/")
        if route:
            routes.add(route)
    return routes


def _registry_hrefs() -> set[str]:
    """Static hrefs from the app nav registry (sections + nested items).

    Excludes the "dev" section: per `pages.ts`, it's reference-only tooling
    (an extensions/components gallery for whoever builds harness chat tool
    integrations) filtered out of real navigation unless ENABLE_DEV_TOOLS is
    explicitly set — not a page real users reach, so the search skill has no
    business teaching the AI to route users there.
    """
    sections = json.loads(_PAGES_CONFIG.read_text(encoding="utf-8"))
    hrefs: set[str] = set()
    for section in sections:
        if section.get("label") == "dev":
            continue
        for entry in (section, *(section.get("items") or ())):
            href = entry.get("href")
            if href:
                hrefs.add(href.split("?")[0].rstrip("/"))
    hrefs.discard("")
    return hrefs


def _page_exists(route: str) -> bool:
    """True when a page.tsx exists at `route` or under it (dynamic details)."""
    base = _SECURED_PAGES_DIR / route.lstrip("/")
    return base.is_dir() and any(base.rglob("page.tsx"))


def test_packaged_miot_search_skill_loads() -> None:
    result = FileSkillSource(_DEFAULT_SKILLS_DIR).load()

    assert not [d for d in result.diagnostics if d.level == "error"]
    loaded = next(s for s in result.skills if s.skill.id == "miot-search")
    assert isinstance(loaded.skill, PlaybookSkill)
    assert loaded.skill.scope.kind == "global"
    assert loaded.skill.description
    assert loaded.playbook_body
    # The body must carry the spotlight output contract.
    for marker in ('"intent"', '"markdown"', '"url"'):
        assert marker in loaded.playbook_body


@requires_frontend_sources
def test_registry_pages_are_in_skill_inventory() -> None:
    """Every navigable nav-registry href must appear in the skill body.

    Registry hrefs without a real page (e.g. section-header stubs like
    `/reports`) are exempt — the skill must not teach dead routes.
    """
    body_routes = _body_routes()
    navigable = {href for href in _registry_hrefs() if _page_exists(href)}

    missing = sorted(navigable - body_routes)
    assert not missing, (
        "pages-config.json hrefs missing from the miot-search page inventory "
        f"({_SKILL_MD}): {missing}"
    )


@requires_frontend_sources
def test_skill_inventory_routes_exist_as_pages() -> None:
    """Every route the skill teaches must resolve to a real app page."""
    dead = sorted(route for route in _body_routes() if not _page_exists(route))
    assert not dead, (
        "miot-search page inventory references routes with no page.tsx under "
        f"{_SECURED_PAGES_DIR}: {dead}"
    )
