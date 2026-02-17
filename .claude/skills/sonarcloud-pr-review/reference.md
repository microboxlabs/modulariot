# SonarCloud PR Review – Reference

## Scripts (from repo root)

| Script | Purpose |
|--------|--------|
| `generative_ai/tools/sh/sonarcloud-issues.sh` | Fetch open issues for project, optionally by branch or PR, in list or context format. |
| `generative_ai/tools/sh/sonarcloud-rule-doc.sh` | Fetch rule documentation by rule key (e.g. `typescript:S1192`). |

## sonarcloud-issues.sh

**Auth:** Set `SONAR_TOKEN` or pass `-t TOKEN`.

**Scope:**
- `--pr` – current PR (uses `gh` or CI env).
- `--branch` – current git branch.
- `-b BRANCH` – specific branch.
- `-p PR_NUMBER` – specific PR.

**Output:**
- `-o list` (default) – table: `SEVERITY  RULE  FILE:LINE  MESSAGE`.
- `-o context` – one block per issue: File, Line, Rule, Severity, Message (good for LLM).
- `--with-docs` – with `-o context`, appends rule documentation for each unique rule (extra API calls).

**Example (used by the skill):**
```bash
./generative_ai/tools/sh/sonarcloud-issues.sh --pr -o context --with-docs
```

## sonarcloud-rule-doc.sh

**When to use:** To get documentation for a single rule key (e.g. from the "Rule" line in context output).

```bash
./generative_ai/tools/sh/sonarcloud-rule-doc.sh typescript:S1192
./generative_ai/tools/sh/sonarcloud-rule-doc.sh -o url typescript:S1192   # print rule URL only
```

## Context output shape

When using `-o context --with-docs`, output looks like:

```
=== SonarCloud issues (open): N === project: microboxlabs_modulariot pullRequest: 14

---
File: src/components/SomeFile.tsx
Line: 100
Rule: typescript:S1192
Severity: CRITICAL
Message: Define a constant instead of duplicating this literal "..." 3 times.
---

... (more blocks) ...

=== Rule documentation ===

--- Rule: typescript:S1192 ---
Rule: typescript:S1192
Name: ...
Severity: ...
...
```

Use the **Rule** value (e.g. `typescript:S1192`) to match each issue to its block in the **Rule documentation** section when applying fixes.

## Project config

- SonarCloud project key: `microboxlabs_modulariot` (overridable with `-k` or `SONAR_PROJECT_KEY`).
- Token: [SonarCloud → Account → Security](https://sonarcloud.io/account/security). Do not commit; set in env or pass via `-t`.
