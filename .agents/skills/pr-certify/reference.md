# prcert reference

## Layout

```
pr-certify/
  SKILL.md            the loop
  reference.md        this file
  bin/prcert          the CLI (python3 stdlib + gh + curl, no install)
  hooks/pr-gate.py    PreToolUse(Bash)  — denies `gh pr merge` without a valid stamp
  hooks/pr-nudge.py   PostToolUse(Bash) — points at the loop after `gh pr create` / `gh pr ready`
  hooks/_cmd.py       shared: does this command really invoke that gh subcommand?
```

## Install

Symlink the skill so it loads in every repo, and register the hooks globally:

```bash
ln -s <repo>/.agents/skills/pr-certify ~/.claude/skills/pr-certify
```

`~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [
        { "type": "command", "command": "$HOME/.claude/skills/pr-certify/hooks/pr-gate.py", "timeout": 40 } ] }
    ],
    "PostToolUse": [
      { "matcher": "Bash", "hooks": [
        { "type": "command", "command": "$HOME/.claude/skills/pr-certify/hooks/pr-nudge.py", "timeout": 10 } ] }
    ]
  }
}
```

Both hooks read the command from stdin and exit 0 immediately for anything that is not a
`gh pr merge` / `gh pr create` / `gh pr ready`, so every other Bash call costs one short python
start.

The match is not a substring test. `_cmd.invokes()` strips heredoc bodies, tokenizes with `shlex`
so quoted text stays one token, and requires `gh pr <sub>` at a command position — start of line,
after an operator, after a shell keyword that is itself at a command position, or behind
`VAR=value` assignments. A commit message that mentions `gh pr merge`, a `grep` for it, an `echo`
of it, or `printf '%s' '; gh pr merge 42'` does not trip the hook; `if x; then gh pr merge 5; fi`
does.

`_cmd.bypasses()` applies the same parse to `PR_CERTIFY_BYPASS=1`, so the bypass counts only as an
environment assignment on the merge command itself — `gh pr merge 42; echo PR_CERTIFY_BYPASS=1`
does not skip the gate.

`python3 hooks/test_cmd.py` runs the 29 cases that pin this down.

## Subcommands

Global flags: `--repo owner/name`, `--pr N`. Both default to the current repo and the PR of the
current branch.

| command | does | exit |
|---|---|---|
| `status` | full state; `--json` for the structured form | 0 |
| `status --certified` | state to stderr, exit code is the answer | 0 certified, 3 not |
| `status --settled` | every active reviewer has a verdict on head and no check is running | 0 settled, 3 waiting |
| `classify` | `lite` / `balanced` + reasons; `--json` | 0 |
| `findings` | open items from all sources; `--json`, `--limit N`, `--include-outdated`, `--with-rule-docs` | 0 |
| `request` | `--copilot`, `--coderabbit`, `--full`, `--all` | 0 |
| `reply` | `--thread-id ID` or `--comment-id ID`, `--body TEXT\|-` | 0 |
| `resolve` | `--thread-id ID` (repeatable) | 0 |
| `stamp` | `--rounds N`, `--notes TEXT\|-` | 0 |
| `gate` | the merge gate's verdict | 0 allow, 3 deny |
| `ruleset` | create a `copilot_code_review` ruleset with `review_on_push` (needs repo admin) | 0 |
| `config` | `--enable-org`, `--disable-org`, `--gate on\|off` | 0 |

## `status --json` shape

```jsonc
{
  "repo": "owner/name", "pr": 1174, "title": "...", "url": "...",
  "head": "<sha>", "base": "trunk", "defaultBranch": "trunk",
  "isDraft": false, "mergeable": "MERGEABLE",
  "classification": { "level": "balanced", "reasons": [...], "loc": 4934,
                      "changedFiles": 85, "topLevel": [...] },
  "providers": {
    "copilot":    { "available": true, "fresh": false, "verdict": "changes",
                    "pending": false, "headline": "### 🟡 Changes recommended",
                    "reviewedSha": "...", "reviewedAt": "..." },
    "coderabbit": { "available": false, "reason": "Review rate limited", ... },
    "sonar":      { "available": true, "verdict": "clean",
                    "projects": [ { "key": "...", "gate": "OK", "openIssues": 0,
                                    "hotspotsToReview": 0, "error": null } ] }
  },
  "checks": { "total": 26, "failing": [...], "pending": [...], "settled": true, "green": true },
  "unresolvedThreads": [ { "threadId": "PRRT_...", "source": "coderabbitai",
                           "path": "...", "line": 21, "isOutdated": false,
                           "replyToId": 3624779841, "url": "...", "body": "..." } ],
  "outdatedUnresolvedThreads": [...],
  "stamp": { "sha": "...", "verdict": "ok", "level": "balanced", "rounds": "3" },
  "blockers": [...], "warnings": [...],
  "certified": false, "settled": true, "orgEnabled": true
}
```

`verdict` is one of `clean`, `changes`, `unclear`, or `null` (no review yet). A verdict counts only
when `fresh` is true, which means `reviewedSha == head`.

## `findings --json` shape

```jsonc
{
  "head": "<sha>",
  "findings": [
    { "source": "coderabbit", "kind": "review-thread", "threadId": "PRRT_...",
      "replyToId": 3624779841, "path": "...", "line": 21, "isOutdated": false,
      "severity": "major", "tags": ["data integrity  integration", "major", "heavy lift"],
      "title": "Persist and reload permission requests through an API.",
      "body": "...", "agentPrompt": "...", "suggestedFix": "...", "url": "..." },
    { "source": "sonar", "kind": "issue", "project": "microboxlabs_modulariot",
      "id": "...", "rule": "typescript:S1854", "severity": "major", "type": "CODE_SMELL",
      "path": "turbo-repo/apps/app/...", "line": 51, "title": "...", "url": "..." },
    { "source": "sonar", "kind": "hotspot", "severity": "high", "type": "SECURITY_HOTSPOT", ... },
    { "source": "checks", "kind": "failing-check", "title": "Lint & Test",
      "severity": "major", "state": "FAILURE", "url": "..." }
  ],
  "ruleDocs": { "typescript:S1854": { "name": "...", "severity": "MAJOR",
                                      "type": "CODE_SMELL", "doc": "..." } }
}
```

## Config

`~/.claude/pr-certify/config.json`:

```jsonc
{
  "orgs": {
    "microboxlabs": {
      "maxRounds": 5,
      "sonarOrg": "microboxlabs",           // defaults to the project key's prefix
      "balanced": { "loc": 300, "files": 20, "pathHints": [...], "labels": [...] }
    }
  },
  "gate": { "enforce": true },
  "defaults": { "maxRounds": 5, "sonarHost": "https://sonarcloud.io",
                "sonarTokenEnv": "SONAR_TOKEN", "balanced": { ... } }
}
```

An org absent from `orgs` is not certified and not gated: `status` says so and `gate` allows the
merge. Onboarding an org is one command: `prcert config --enable-org <org>`.

Per-org keys: `maxRounds`, `sonarHost`, `sonarOrg`, `sonarTokenEnv`, `requireCopilot` (set it
`false` where Copilot code review is not available, so a missing Copilot verdict is a warning
rather than a blocker that never clears), and a `balanced` block.

`prcert config` writes back only what you set. Defaults are merged at read time, so a later change
to the built-in defaults reaches every config; `config` prints the merged view plus `_stored`, the
part that is actually on disk.

## The calls underneath

**GitHub** — one GraphQL query per invocation pulls the PR, its files, labels, head commit, check
rollup, reviews, review threads and comments.

| action | call |
|---|---|
| request Copilot | GraphQL `requestReviews(botIds:[<copilot bot node id>], union:true)` |
| request CodeRabbit | `POST /repos/{o}/{r}/issues/{n}/comments` with `@coderabbitai review` |
| reply in a thread | `addPullRequestReviewThreadReply`, or `POST /pulls/{n}/comments/{id}/replies` |
| resolve a thread | `resolveReviewThread` |
| stamp | `POST`/`PATCH` `/repos/{o}/{r}/issues[/comments]` |
| auto re-review | `POST /repos/{o}/{r}/rulesets` with rule `copilot_code_review` |

**SonarCloud** — over `curl` (macOS python has no usable CA bundle), basic auth `$SONAR_TOKEN:`.

| what | endpoint |
|---|---|
| quality gate | `api/qualitygates/project_status?projectKey&pullRequest` |
| open issues | `api/issues/search?componentKeys&pullRequest&resolved=false` |
| hotspots | `api/hotspots/search?projectKey&pullRequest&status=TO_REVIEW` |
| rule docs | `api/rules/show?key&organization` — `organization` is required |

## What GitHub does not give you

As of September 2026:

- **No API for Lite/Balanced.** `CopilotCodeReviewParameters` exposes `reviewOnPush` and
  `reviewDraftPullRequests` only; `requested_reviewers` takes no depth argument; there is no
  Copilot mutation in the GraphQL schema. Effort level is a repo/org default set in the web UI,
  overridable per review only in the Reviewers menu. Tracked as cli#14188.
- **Request Copilot through GraphQL, by node id.** `requestReviews(botIds:[…], union:true)` is the
  only form observed to queue a review every time. `prcert` reads the id off the PR when Copilot has
  touched it before, and otherwise uses the global `BOT_kgDOCnlnWA`.

  The REST route is unreliable. A `DELETE` followed by a `POST` on
  `/pulls/{n}/requested_reviewers` with `reviewers[]=Copilot` returned 200 twice and produced no
  `review_requested` event and no review; `gh pr edit --add-reviewer @copilot` also exits 0 without
  raising anything (cli#11245). Do not use either to drive a loop.
- **Bot reviewers are invisible over REST.** `GET /pulls/{n}` reports `requested_reviewers: []` even
  while Copilot is queued. Read GraphQL `reviewRequests` instead, which is what `prcert` does.
- **Re-requesting is the re-review trigger.** Calling `requestReviews` again after Copilot has
  reviewed queues a fresh review of the new head. That is what `prcert request --copilot` does.
- **Copilot never approves.** Its reviews are always `COMMENTED`; the verdict is in the body's
  headline emoji, not in the review state. CodeRabbit behaves the same way. Do not wait for
  `APPROVED`.
