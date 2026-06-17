"""Externalized Context & Skills subsystem.

The harness ships as an immutable image: its grounding primer lives in
source and there was no way to add information about the *system around
the harness* (Quarkus proxy, Auth0, ECM, env specifics) or new skills
per environment without rebuilding.

This package loads that material from files at boot, behind a `Source`
seam so a runtime API/DB source can replace the file source later with
no rework. It exposes three surfaces, resolved per request on
`ctx.tenant_id` (global base + optional per-tenant overlay):

1. a small always-injected context primer (composed *with*, never
   replacing, the active datasource primer);
2. a queryable "system facts" store surfaced through the meta path;
3. skills — `playbook` (guidance over existing tools) and `http`
   connector (registers a new callable `HarnessTool`).

Boot follows the datasource contract: `boot_context_skills` never raises
on bad input — it returns diagnostics the lifespan logs and continues
past, so one malformed file can never crash the harness.

Import names directly from their defining module (no re-exports here):
`context_skills.loader.boot_context_skills`,
`context_skills.registry.ContextSkillsBundle`, etc.
"""
