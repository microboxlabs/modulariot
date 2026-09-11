---
name: pr-certify
description: >
  Drive a pull request to merge-ready by looping over its AI reviewers. Requests Copilot code
  review (and CodeRabbit where enabled), reads SonarCloud quality-gate issues and hotspots,
  triages every finding, applies fixes, replies to and resolves each review thread, pushes,
  re-requests review on the new head, and repeats until all reviewers are clean on the current
  head SHA — then stamps the PR so `gh pr merge` is unblocked. Use when the user asks to certify
  a PR, get a PR reviewed and merge-ready, fix Copilot/CodeRabbit/SonarCloud findings, check
  whether a PR is ready to merge, or when a PR was just created or pushed to.
---

# PR certification loop

Drive a pull request until every reviewer is clean on the current head SHA, answering each
finding on the way.

## Prerequisites

- `gh` authenticated (`gh auth status`).
- `SONAR_TOKEN` exported for SonarCloud. The shell is often non-login, so prefix commands with
  `source ~/.zshrc 2>/dev/null;` when the token lives in a shell rc.
- The PR's org must be in the allowlist: `prcert config --enable-org <org>`.

All commands below are `prcert`, at `<skill-dir>/bin/prcert`. It defaults to the PR of the
current branch in the current repo; override with `--repo owner/name --pr N`.

## The loop

### 0. Read the state

```bash
prcert status
```

One screen: review depth, each reviewer's verdict, whether that verdict is against the **current
head SHA** or a stale one, check results, unresolved threads, blockers, warnings.

`prcert status --json` gives the same thing structured. Everything else in this skill is a
reaction to what this prints.

Stop here and report if:
- the org is not in the allowlist (the warning names the command to fix it),
- the PR is a draft — ask whether to mark it ready or certify the draft anyway,
- the PR conflicts with its base — rebase first; a review of a conflicted diff is not useful.

Drafts and conflicts are blockers, not advice: neither can certify.

### 1. Classify the depth

```bash
prcert classify
```

`lite` or `balanced`, with the reasons. The heuristic flags size (>300 changed lines, >20 files),
sensitive paths (auth, security, token, payment, tenant, migration, …), `security`/`breaking`
labels, and PRs spanning more than two top-level directories.

**GitHub does not expose Lite/Balanced through the API** — `CopilotCodeReviewParameters` carries
only `reviewOnPush` and `reviewDraftPullRequests`, and `requested_reviewers` takes no depth. The
effort level is whatever the repo or org default is, changeable only in the web UI.

So when the verdict is `balanced`, close the gap locally: run `/code-review high` over the PR diff
and fold its findings into the same triage queue in step 4.

Copilot does state the level it used, in its review body, and `prcert` reads it back as
`providers.copilot.effort`. When the classification says `balanced` and Copilot reviewed at `lite`,
`status` warns about the mismatch — tell the user, and that Copilot's own Balanced pass has to be
picked in the PR's Reviewers menu.

### 2. Request reviews on the current head

```bash
prcert request --all
```

Re-requests `Copilot` through the GraphQL `requestReviews` mutation, and posts
`@coderabbitai review` when CodeRabbit is active on the PR. SonarCloud needs no request — it
analyses on push.

Do not reach for `gh pr edit --add-reviewer @copilot` or the REST `requested_reviewers` endpoint
instead — both exit 0 without reliably queuing anything. And do not check the result over REST:
`GET /pulls/{n}` reports `requested_reviewers: []` even while Copilot is queued.

Use `--full` for a CodeRabbit full re-review instead of an incremental one, after a rebase or a
large rewrite.

### 3. Wait for the reviewers to land

Reviews take minutes. Do not poll in the foreground — arm one bounded background wait:

```bash
n=0; until prcert status --settled; do n=$((n+1)); [ $n -gt 30 ] && exit 1; sleep 40; done
```

Run that with `run_in_background: true`. It exits once every active reviewer has a verdict against
the current head and no check is still running, and you get a single notification.

Keep the cap. If `prcert request` reported `ok: false` for Copilot, Copilot code review is not
available on that repo and no verdict is ever coming — set `requireCopilot: false` for the org and
treat it as a warning instead of waiting out the cap every round.

While waiting, do the local work from step 1 (`/code-review high` for `balanced` PRs) instead of
sitting idle.

### 4. Collect and triage

```bash
prcert findings --json --with-rule-docs
```

Returns every open item in one list:

| `source` | what it is |
|---|---|
| `copilot` | unresolved Copilot review thread |
| `coderabbit` | unresolved CodeRabbit thread, with `severity`, `tags`, `agentPrompt`, `suggestedFix` |
| `sonar` | open SonarCloud issue or `TO_REVIEW` security hotspot, with `rule` and rule documentation |
| `checks` | a failing check — fix these before the review findings |

Outdated threads are skipped by default; `--include-outdated` brings them back.

Then judge each one against the actual code. Never apply a suggestion unread.

- Read the file at the referenced line before deciding.
- Prefer `agentPrompt` over `suggestedFix` when they disagree — it is written for an agent.
- For SonarCloud, follow the rule documentation over any habit; where they conflict, the rule doc wins.
- Reject a finding when it misreads the context, conflicts with a project convention, or the code
  already changed. Every rejection has to be justified in the reply in step 6.
- Security hotspots are a review obligation, not always a code change: if the code is safe, the
  reply explains why and the hotspot is marked Safe in SonarCloud (the loop cannot do that for you —
  say so in the report).

### 5. Fix, verify, push

Group fixes by file, apply top-to-bottom so line numbers stay valid, one logical edit per finding.
Match the surrounding code and change nothing the finding does not require.

Verify before pushing: type-check and run the tests for the modules you touched. A fix that breaks
a check costs a full review round.

Commit with a message that names what the reviewers found, and push.

### 6. Answer every thread

Each finding gets a reply, whether you took it or not:

```bash
prcert reply --thread-id <id> --body "Fixed in <sha>: <what changed>."
prcert reply --thread-id <id> --body "Skipping: <why, concretely>."
prcert resolve --thread-id <id>
```

`--body -` reads stdin, for anything longer than a line. Reply first, resolve second: a resolved
thread with no reply leaves no record of the decision.

Do not resolve a thread you did not act on. If a finding needs a product decision, leave it open,
say so in the reply, and carry it into the final report as a blocker for the human.

### 7. Loop

Go back to step 2 with the new head. Stop when `prcert status` reports certified, or after
`maxRounds` (default 5) — whichever comes first. Do not start a round that changes nothing.

### 8. Stamp

```bash
prcert stamp --rounds <n>
```

Posts (or updates) a comment on the PR carrying `<!-- pr-certify:v1 sha=… verdict=… -->` plus a
readable table of every reviewer's verdict. The stamp is bound to the head SHA: one more commit
and it is void.

Stamp even when the PR is **not** certified. `verdict=blocked` plus the blocker list records where
the loop stopped, for the next session and for the user.

### 9. Report

Tell the user: the depth verdict, how many rounds it took, what was fixed, what was rejected and
why, and anything still blocking. Link the PR.

## The merge gate

`hooks/pr-gate.py` denies `gh pr merge` unless the PR carries a stamp with `verdict=ok` for the
exact current head **and** nothing has gone wrong since that stamp was written — a late CodeRabbit
review, a check flipping to failure, a new unresolved thread. It re-reads GitHub but skips the
SonarCloud calls, whose verdict the stamp already carries, so it answers in a couple of seconds.

It fails open on errors: if `gh` is down, the org is not allowlisted, or anything else goes wrong,
the merge proceeds. It does **not** fail open on ambiguity. A `gh pr merge` the hook can see in live
shell code but cannot resolve into a target is denied, because a gap in the command parser must not
read as "no merge here".

To merge anyway: prefix the merge command itself with `PR_CERTIFY_BYPASS=1`. It has to be an
environment assignment on that command — the same text anywhere else in the line does not count.

Check the gate by hand with `prcert gate` (exit 0 certified, 3 blocked).

## Reading the verdicts

| Reviewer | clean | needs work |
|---|---|---|
| Copilot | review headline `### 🟢 Approval recommended` | `### 🟡 Changes recommended`; `### 🔵 Needs a closer look` blocks too — it means Copilot could not decide, so a human has to, and then re-request |
| CodeRabbit | `**Actionable comments posted: 0**` | any count above zero |
| SonarCloud | quality gate `OK`, zero open PR issues, zero hotspots to review | anything else |

One rule decides every reviewer: only a **fresh, clean** verdict is not a blocker. Stale, pending,
unreadable, errored — all block. A reviewer degrades to a warning only when it said it is switched
off (rate-limited, disabled for the base branch, not configured) or when the org turned it off with
`requireCopilot: false`.

A verdict only counts against the **current head**. `prcert status` prints `STALE` when the newest
review is for an older commit. That is the most common reason a PR looks green without being
reviewed. Treat stale as unreviewed.

## Known failure modes

- **CodeRabbit can report `pass` without reviewing.** Its check carries `Review rate limited` or
  `reviews are disabled for this base branch` and no review arrives. `prcert` marks it `n/a` and
  downgrades it to a warning rather than waiting. Say so in the report.
- **Stacked PRs get no CI.** A PR whose base is not the default branch may run no checks at all,
  and `skipping` is not `pass`. `prcert` counts skipped checks separately: a PR whose checks all
  skipped reports `ran 0` and is never green. It also warns when the check list is empty or the
  base is not the default branch.
- **SonarCloud drops old PR analyses.** A 404 on the quality gate means there is no analysis for
  this PR, not a bad token.
- **A repo can have several Sonar projects.** `prcert` discovers the keys from the PR's Sonar
  check URLs, falling back to `sonar-project.properties`, and requires all of them to be clean. A
  project whose API call errors counts as unknown, never as clean.
- **More than 100 checks truncates the rollup.** `prcert` blocks rather than reporting green on a
  connection it could not read in full.
- **A dismissed review is not a verdict.** Only `COMMENTED`, `APPROVED` and `CHANGES_REQUESTED`
  count; a dismissed clean review cannot certify.
- **An org outside the allowlist never certifies.** It is not merely ungated.
- **Copilot has two review formats.** The older one has no emoji headline; `prcert` falls back to
  counting unresolved Copilot threads there.

## Making re-review automatic

Copilot can re-review on every push, which removes step 2 from the loop:

```bash
prcert ruleset          # creates a branch ruleset with copilot_code_review, review_on_push
```

Needs repo admin. Do it once per repo you certify regularly.

## Configuration

`~/.claude/pr-certify/config.json`, edited through `prcert config`:

```bash
prcert config                              # show
prcert config --enable-org acme            # certify (and gate) acme's repos
prcert config --disable-org acme
prcert config --gate off                   # stop blocking gh pr merge everywhere
```

Per-org overrides go under `orgs.<name>`: `maxRounds`, `sonarHost`, `sonarOrg`, `sonarTokenEnv`,
and a `balanced` block (`loc`, `files`, `pathHints`, `labels`) to retune the depth heuristic.

See [reference.md](reference.md) for the JSON shapes, every subcommand's flags, and the underlying
GitHub and SonarCloud calls.
