---
name: sonarcloud-pr-review
description: Reviews the current pull request against SonarCloud and fixes reported issues. Fetches PR issues with rule documentation, then applies code changes per rule guidance. Use when the user asks to review the PR, fix SonarCloud issues, or address SonarCloud findings.
---

# SonarCloud PR Review and Fix

Review the current branch's PR against SonarCloud and fix all reported issues using rule documentation as context.

## Prerequisites

- **SONAR_TOKEN** must be set (SonarCloud → Account → Security). The agent cannot fix issues without fetching them.
- CLI tool: `@microboxlabs/sonarcloud-tools` (built from `packages/sonarcloud-tools/`). Run from repo root via `node packages/sonarcloud-tools/dist/cli.js`.
- For `--pr` auto-detect: `gh` CLI or a CI env (e.g. `GITHUB_REF`).

**Loading token from shell config:** The shell used to run commands is often non-login and does not load `~/.zshrc` or `~/.bashrc`. If the user says the token is in their shell rc, source it before running the command, e.g. `source ~/.zshrc 2>/dev/null; node packages/sonarcloud-tools/dist/cli.js ...`.

## Workflow

### 1. Fetch PR issues with rule documentation

From the repository root, run (source shell rc if SONAR_TOKEN is set there, e.g. in `.zshrc`):

```bash
source ~/.zshrc 2>/dev/null; node packages/sonarcloud-tools/dist/cli.js issues -k microboxlabs_modulariot --pr -o context --with-docs
```

- Use `--branch-current` instead of `--pr` if PR detection fails (e.g. no `gh` or CI env).
- Capture the full output: it contains one block per issue (File, Line, Rule, Severity, Message) plus a **Rule documentation** section for each unique rule. This is the context the LLM must use to fix correctly.

If the command fails (e.g. missing token or no PR), stop and ask the user to set `SONAR_TOKEN` or pass the token, and to confirm they are on a PR branch or to use `--branch-current` or `-b <branch>`.

### 2. Plan fixes by file

- Group issues by **File** so edits are done per file and avoid conflicting changes.
- Order fixes by file path, then by line number (top to bottom) so later line numbers remain valid after edits.
- For each issue, use the **Rule** key and the **Rule documentation** section to decide the exact change.

### 3. Apply fixes

- **One edit per logical change**.
- Follow the rule text and examples in the documentation.
- Preserve existing behavior and style (formatting, naming, project patterns). Do not refactor beyond what the rule requires.
- After editing a file, re-read the affected regions to ensure no new issues (e.g. unused imports, broken references).

### 4. Verify

- Run the issues command again and confirm the fixed issues no longer appear:

```bash
source ~/.zshrc 2>/dev/null; node packages/sonarcloud-tools/dist/cli.js issues -k microboxlabs_modulariot --pr -o context
```

- If the build is available, run tests (e.g. `npm test` or `npx vitest` for changed modules).

## Fix patterns (quick reference)

| Rule intent | Action |
|------------|--------|
| Duplicated string literal | Define a constant and use it everywhere the literal appeared. |
| Unused variable / import | Remove the unused variable or import. |
| Cognitive complexity too high | Extract helper functions to reduce nesting and complexity. |
| Code smell: no-duplicate-case | Remove or fix the duplicate case in switch statements. |
| Redundant type assertion | Remove unnecessary `as` casts or type assertions where TypeScript can infer the type. |
| Unused function parameter | Prefix with `_` or remove if not needed by the interface/signature. |
| Missing return type | Add explicit return type annotations to exported functions. |
| Console statement in production | Remove `console.log` / `console.debug` or replace with a proper logger. |
| Promises must be awaited or returned | Ensure async calls are properly awaited or returned. |

When the rule documentation disagrees with this table, follow the rule documentation.

## Output to the user

After applying fixes, report briefly:

- Number of issues addressed and in which files.
- Any issue that could not be fixed (e.g. needs product decision, or rule doc unclear) with a one-line reason.
- Reminder to run the command again and the test suite to confirm.

For CLI options and output format details, see [reference.md](reference.md).
