# Dependabot remediation — Goal Loop contract

## 1. Goal

Resolve all open Dependabot security alerts in
`microboxlabs/modulariot`, verify that vulnerable versions are absent,
exercise the affected applications, push the feature branch, and open a draft
pull request. The bootstrap scope spans two ecosystems and 20 package
families, so the work is split into independently verifiable rungs.

## 2. Architecture

- `GOAL-LADDER.md` is the ordered source of truth.
- `GOAL-STATE.md` records the active rung, base SHA, results, and blockers.
- `ALERT-INVENTORY.md` maps alerts to dependency parents and resolutions.
- Git history is the immutable audit; rung commits use
  `feat(depsec-pN):`.
- The active Codex goal drives one rung at a time and re-reads these files
  before advancing.

## 3. Per-rung contract

1. **Turn 1** — read `GOAL-LOOP.md` + `GOAL-STATE.md`; record the rung
   **base SHA** (`git rev-parse HEAD`) in `GOAL-STATE.md`; restate the
   acceptance list.
2. **Guard** — branch != main/trunk, working tree sane.
3. **Implement** toward the condition. <=5 files per commit.
4. **Gates** after each change — lint / compile / types / tests, stop
   on first failure (see `GOAL-LOOP.md` for the project's commands).
5. **Self-review** — simplify the diff before each commit.
6. **Commit** `feat(depsec-pN): <verb> <one-line>` and push.
7. When every acceptance clause holds, write the rung result to
   `GOAL-STATE.md`.
8. **Blocker** — on a genuine escalation trigger, write
   `STATUS: BLOCKED` + reason to `GOAL-STATE.md` and stop changing
   code.

## 4. Cross-rung contract

1. Read `GOAL-LADDER.md`; pick the first rung not `done`. If none, proceed to
   final review and draft PR creation.
2. Record the rung base SHA in `GOAL-STATE.md` and mark the rung
   `in_progress`.
3. Execute the rung, verify every acceptance clause, and record exact gate
   results.
4. Mark a successful rung `done` and advance. Mark a genuine escalation
   `blocked`, notify the human, and stop.
5. Re-fetch the live alert set whenever a pushed dependency change can cause
   Dependabot to reconcile.

## 5. Gates

### npm monorepo

```bash
cd turbo-repo
npm ci
npm run lint
npm run check-types
npm run --workspace=@microboxlabs/miot-chat build
CI=1 npx turbo run test
```

Affected Next.js production builds are required after framework or browser
dependency changes:

```bash
cd turbo-repo
npx turbo run build --filter=@modulariot/app --filter=@modulariot/web
```

Add affected `web-admin` or docs builds when their manifests change.

### Python harness

```bash
cd miot-harness
uv lock --check
uv sync --locked --all-extras --dev
uv run pytest
```

### Security verification

```bash
cd turbo-repo
npm audit --audit-level=low
```

The Dependabot API remains authoritative for GitHub alert state.

## 6. Hard rules

- Editable implementation paths: `turbo-repo` dependency manifests,
  `turbo-repo/package-lock.json`, compatibility code/tests required by a
  security upgrade, `miot-harness` dependency metadata, and this plan.
- Do not touch `ecm-srv`, `quarkus-srv`, `ops`, or `releases`.
- Do not edit generated application artifacts or commit caches/build output.
- Prefer direct/parent upgrades; use root overrides only when the parent
  cannot express a safe compatible release, and document why.
- Do not dismiss alerts for `tolerable_risk`, `not_used`, or `inaccurate`
  without human approval.
- Keep each commit to at most five changed files and one logical change.
- No secrets, real credentials, force-push, merge, or deployment.

## 7. Escalation triggers

Stop and ask the human when:

- a fix requires replacing a product dependency with a different library;
- a breaking API change offers more than one materially different migration;
- a baseline gate fails on `origin/trunk` and the failure cannot be isolated;
- a required package has no safe version or workable mitigation;
- a proposed resolution would dismiss or accept a security risk;
- authentication, authorization, or spreadsheet behavior cannot be preserved
  without a product decision;
- repository/network credentials or external permissions are missing;
- the ladder contradicts repository instructions.

Security findings already represented by the 77-alert bootstrap scope are not
new escalations. Newly discovered critical findings are.

## 8. Review and delivery

- Review each lockfile diff for package source, integrity, and unintended
  major upgrades.
- Review the full branch diff before pushing.
- Push only `codex/fix-dependabot-alerts`.
- Open a draft PR with the alert inventory and verification results.
- Never merge or deploy; those remain human actions.
