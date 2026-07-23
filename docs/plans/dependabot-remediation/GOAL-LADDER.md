# Dependabot remediation — Goal Ladder

> Source of truth for what is next. Each rung is one focused phase.
> Climb top-down; the first rung not `done` is active. See
> `GOAL-LOOP.md` for the execution contract.

## Scope snapshot

- Repository: `microboxlabs/modulariot`
- Snapshot date: 2026-07-23
- Open alerts at bootstrap: 77 (75 npm, 2 pip)
- npm package families: 19
- pip package families: 1
- Branch: `codex/fix-dependabot-alerts`
- Base SHA: `3804ea88dee4bca6bcb52499cdccc2d8ed6cc615`

## Status legend

- `todo` / `in_progress` / `blocked` / `done`

## Rung index

| Rung | Phase | Status |
|------|-------|--------|
| R0 | Inventory and resolution map | in_progress |
| R1 | Python lockfile remediation | todo |
| R2 | Next.js and native image stack | todo |
| R3 | Runtime auth and networking dependencies | todo |
| R4 | Build and development toolchain dependencies | todo |
| R5 | Browser rendering and spreadsheet dependencies | todo |
| R6 | Full verification and alert reconciliation | todo |

---

## R0 — Inventory and resolution map

- **Status**: in_progress
- **Base SHA**: recorded in `GOAL-STATE.md` when the rung starts

```text
/goal Follow docs/plans/dependabot-remediation/GOAL-LOOP.md.
On branch codex/fix-dependabot-alerts, rung R0 is achieved when ALL hold:
(a) ALERT-INVENTORY.md records all 77 bootstrap alerts grouped by package,
severity, manifest, relationship, affected range, target version, and parent;
(b) every package family has a concrete bump, parent-upgrade, override,
replacement, or evidence-based dismissal strategy;
(c) baseline npm and Python verification results are recorded, including any
pre-existing failures;
(d) git log shows >=1 commit since the rung base SHA matching
`feat(depsec-p0):`.
Constraints: read-only GitHub inspection; no alert dismissal; <=5 files per
commit; no secrets. Stop after 12 turns if not achieved.
```

## R1 — Python lockfile remediation

- **Status**: todo
- **Base SHA**: —

```text
/goal Follow docs/plans/dependabot-remediation/GOAL-LOOP.md.
On branch codex/fix-dependabot-alerts, rung R1 is achieved when ALL hold:
(a) miot-harness/uv.lock resolves pyasn1 >=0.6.4;
(b) `cd miot-harness && uv lock --check` exits 0;
(c) `cd miot-harness && uv run pytest` exits 0;
(d) git log shows >=1 commit since the rung base SHA matching
`feat(depsec-p1):`.
Constraints: edit only miot-harness dependency metadata and goal state; <=5
files per commit; no secrets. Stop after 10 turns if not achieved.
```

## R2 — Next.js and native image stack

- **Status**: todo
- **Base SHA**: —

```text
/goal Follow docs/plans/dependabot-remediation/GOAL-LOOP.md.
On branch codex/fix-dependabot-alerts, rung R2 is achieved when ALL hold:
(a) every Next.js 16 workspace resolves next >=16.2.11 and matching @next/mdx
and eslint-config-next packages where present;
(b) every Next.js 15 workspace resolves next >=15.5.21 and matching
eslint-config-next packages;
(c) sharp resolves >=0.35.0 and no installed next or sharp version is in a
bootstrap vulnerable range;
(d) affected workspace type checks, tests, and production builds exit 0;
(e) git log shows >=1 commit since the rung base SHA matching
`feat(depsec-p2):`.
Constraints: edit only turbo-repo manifests, lockfile, and goal state; <=5
files per commit; no secrets. Stop after 20 turns if not achieved.
```

## R3 — Runtime auth and networking dependencies

- **Status**: todo
- **Base SHA**: —

```text
/goal Follow docs/plans/dependabot-remediation/GOAL-LOOP.md.
On branch codex/fix-dependabot-alerts, rung R3 is achieved when ALL hold:
(a) installed fast-jwt >=6.2.4, fast-uri >=3.1.4, form-data >=4.0.6,
ws >=8.21.0, uuid >=11.1.1, and cookie >=0.7.0;
(b) installed qs is outside GitHub's vulnerable range and at least the
advisory's effective fixed release;
(c) `npm ls fast-jwt fast-uri form-data ws qs uuid cookie` shows no vulnerable
installed version;
(d) affected BFF/auth package tests and type checks exit 0;
(e) git log shows >=1 commit since the rung base SHA matching
`feat(depsec-p3):`.
Constraints: prefer parent upgrades over root overrides; document every
override; <=5 files per commit; no secrets. Stop after 18 turns if not
achieved.
```

## R4 — Build and development toolchain dependencies

- **Status**: todo
- **Base SHA**: —

```text
/goal Follow docs/plans/dependabot-remediation/GOAL-LOOP.md.
On branch codex/fix-dependabot-alerts, rung R4 is achieved when ALL hold:
(a) installed vite >=7.3.5, js-yaml >=4.3.0, postcss >=8.5.10,
@babel/core >=7.29.6, tmp >=0.2.6, and esbuild >=0.28.1;
(b) every installed brace-expansion release is outside its corresponding
vulnerable range (1.x >=1.1.16, 2.x >=2.1.2, 3-5.x >=5.0.7 or removed);
(c) `npm ls` confirms no bootstrap-vulnerable toolchain version remains;
(d) root lint and type-check gates exit 0;
(e) git log shows >=1 commit since the rung base SHA matching
`feat(depsec-p4):`.
Constraints: prefer parent upgrades over root overrides; document every
override; <=5 files per commit; no secrets. Stop after 18 turns if not
achieved.
```

## R5 — Browser rendering and spreadsheet dependencies

- **Status**: todo
- **Base SHA**: —

```text
/goal Follow docs/plans/dependabot-remediation/GOAL-LOOP.md.
On branch codex/fix-dependabot-alerts, rung R5 is achieved when ALL hold:
(a) installed DOMPurify >=3.4.12, ECharts >=6.1.0, and xlsx is outside
GitHub's affected ranges for GHSA-5pgg-2g8v-p4x9 and
GHSA-4r6h-8v6p-xvw6;
(b) any xlsx source change uses an official SheetJS distribution and existing
spreadsheet behavior remains covered by tests;
(c) `npm ls dompurify echarts xlsx` and lockfile inspection confirm no
bootstrap-vulnerable version remains;
(d) @modulariot/app lint, type-check, tests, and production build exit 0;
(e) git log shows >=1 commit since the rung base SHA matching
`feat(depsec-p5):`.
Constraints: do not dismiss the four xlsx alerts merely because npm lacks a
patched registry release; <=5 files per commit; no secrets. Stop after 20
turns if not achieved.
```

## R6 — Full verification and alert reconciliation

- **Status**: todo
- **Base SHA**: —

```text
/goal Follow docs/plans/dependabot-remediation/GOAL-LOOP.md.
On branch codex/fix-dependabot-alerts, rung R6 is achieved when ALL hold:
(a) npm clean install, lint, type-check, test, and affected production build
gates exit 0;
(b) Python locked sync and test gates exit 0;
(c) a local advisory audit reports no known vulnerable installed dependency;
(d) the branch is pushed and GitHub's open Dependabot alert count reaches 0,
or any delayed reconciliation is proven resolved by installed-version and
advisory-range evidence without dismissing alerts;
(e) ALERT-INVENTORY.md records final status and verification evidence;
(f) git log shows >=1 commit since the rung base SHA matching
`feat(depsec-p6):`.
Constraints: no false-positive or tolerable-risk dismissals without human
approval; no force-push, merge, or deploy; <=5 files per commit; no secrets.
Stop after 24 turns if not achieved.
```

## Sequencing

```text
R0 -> R1 -> R2 -> R3 -> R4 -> R5 -> R6 -> review -> draft PR
```

Mode: Codex persistent goal, human-approved ladder. Seven rungs.
