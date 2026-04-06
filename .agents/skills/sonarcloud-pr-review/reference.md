# SonarCloud PR Review – Reference

## CLI tool

| Command | Purpose |
|---------|---------|
| `node turbo-repo/packages/sonarcloud-tools/dist/cli.js issues` | Fetch open issues for project, optionally by branch or PR, in list or context format. |
| `node turbo-repo/packages/sonarcloud-tools/dist/cli.js rule-doc <rule-key>` | Fetch rule documentation by rule key (e.g. `typescript:S1192`). |

## issues subcommand

**Auth:** Set `SONAR_TOKEN` or pass `-t TOKEN`.

**Scope:**
- `--pr` – current PR (uses `gh` or CI env).
- `--branch-current` – current git branch.
- `-b BRANCH` – specific branch.
- `-p PR_NUMBER` – specific PR.

**Output:**
- `-o list` (default) – table: `SEVERITY  RULE  FILE:LINE  MESSAGE`.
- `-o context` – one block per issue: File, Line, Rule, Severity, Message (good for LLM).
- `--with-docs` – with `-o context`, appends rule documentation for each unique rule (extra API calls).

**Example (used by the skill):**
```bash
source ~/.zshrc 2>/dev/null; node turbo-repo/packages/sonarcloud-tools/dist/cli.js issues -k microboxlabs_modulariot --pr -o context --with-docs
```

## rule-doc subcommand

**When to use:** To get documentation for a single rule key (e.g. from the "Rule" line in context output).

```bash
source ~/.zshrc 2>/dev/null; node turbo-repo/packages/sonarcloud-tools/dist/cli.js rule-doc typescript:S1192
source ~/.zshrc 2>/dev/null; node turbo-repo/packages/sonarcloud-tools/dist/cli.js rule-doc -o url typescript:S1192   # print rule URL only
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

- SonarCloud project key: `microboxlabs_modulariot` (passed via `-k`; required).
- Token: [SonarCloud → Account → Security](https://sonarcloud.io/account/security). Do not commit; set in env or pass via `-t`.
