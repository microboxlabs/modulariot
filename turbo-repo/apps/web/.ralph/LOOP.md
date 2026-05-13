---
name: Ralph Loop Charter — Modular IoT Operational Website
description: Read every iteration. Governs how the loop picks tasks, runs evals, commits, and halts.
---

# Ralph: Modular IoT Operational Website

## Mission
Ship a production-quality Modular IoT site at `apps/web` (workspace `@modulariot/web`).
Supabase-structured. NextJS App Router. Flowbite-React (token-skinned to brand).
Tells the symptom-intelligence story per `BRIEF.md`.

## Non-negotiable stack
- NextJS 16+ App Router, React 19, TS strict — mirror `apps/web-site/package.json`
- Tailwind v4 + flowbite-react (match `apps/app` patterns and tokens)
- Brand assets rescued from `apps/web-site/public/` only
- Workspace name: `@modulariot/web`
- npm + turbo (NOT pnpm). Repo uses `npm@10.2.4`, turbo `^2.5.4`
- No barrel files. No real URLs/secrets in versioned config.

## Each iteration
1. `git status` — clean tree or commit in-flight first; verify HEAD didn't move (Conductor)
2. Tail `PROGRESS.md` (last 5 entries) and `BACKLOG.md`
3. Pick TOP unblocked task from BACKLOG
4. Plan in ≤3 bullets (no doc, no commentary)
5. Implement — Edit/Write only inside `apps/web/`
6. Run hard evals (see `EVALS.md`):
   - `npx turbo run check-types --filter=@modulariot/web`
   - `npx turbo run lint --filter=@modulariot/web`
   - `npx turbo run build --filter=@modulariot/web`
   Any red → fix this iteration, do not advance to step 7.
7. Visual + console + a11y evals via **claude-in-chrome MCP**:
   - `mcp__claude-in-chrome__tabs_context_mcp` first to ground tab IDs
   - `mcp__claude-in-chrome__navigate` to `http://localhost:3040` (or the running dev port)
   - `mcp__claude-in-chrome__read_console_messages` — must be 0 errors, 0 unhandled rejections
   - `mcp__claude-in-chrome__javascript_tool` to inject axe-core and run a11y check
   - `mcp__claude-in-chrome__resize_window` + screenshot at 375 / 768 / 1280
   Save artifacts to `.ralph/screenshots/iter-<N>/`.
8. Run soft evals (LLM-as-judge, see EVALS.md). Any score < 7 → spawn follow-up task in BACKLOG.
9. Append to `PROGRESS.md`: iter id, task id, files touched, eval JSON path, screenshot dir
10. Update `BACKLOG.md` (mark done; record discovered work as new tasks)
11. Atomic commit with a descriptive message; never `--amend`, never `--no-verify`
12. Every 5th iteration → invoke `/checkpoint` to capture resumable state
13. Every 10th iteration → write trend summary to PROGRESS.md (eval deltas across last 10)

## Tie-breakers
- Narrative > polish. Symptom story before pixel-fidelity.
- Steal from `apps/app`. Same primitives, same tokens. Grep before you invent.
- Real `BRIEF.md` copy > placeholder. No lorem.
- OSS signals everywhere (GitHub button, deployable banners, repo links).
- Sections small. One section component per file.

## Out of scope (defer; do NOT implement even if tempting)
- Auth-gated dashboards (link out only)
- Blog / CMS beyond a stub
- Analytics wiring (placeholder only)
- Spanish i18n (Phase 7+, post-halt)

## When stuck
- Don't invent. Grep `apps/app` and `apps/web-site` for the pattern first.
- One `/codex` consult per iteration max — second opinion, not a crutch.
- `/design-shotgun` only for visuals BRIEF.md leaves ambiguous. If BRIEF pins it, just build.
- If the design-file URL (`api.anthropic.com/v1/design/...`) doesn't fetch with WebFetch,
  write `BLOCKER: design-file-fetch` in PROGRESS.md and ask the user for an export.

## Halt conditions (loop stops, hands back to user)
- All phase-aligned tasks complete AND hard evals green for 2 consecutive iterations
  → write `READY FOR REVIEW` in PROGRESS.md and stop.
- Same hard eval red 3 iterations running → write `BLOCKER: <eval>` and stop.
- **Any BACKLOG task in `[!]` BLOCKED state for more than 2 iterations → halt**
  with `BLOCKER STUCK: <task-id>` so the user can unblock. Do NOT march past.
- **Iteration counter reaches 12** → stop regardless. (Tightened from 30 in the
  alignment-run charter; smaller batches force more user check-ins.)
- User-set token budget exceeded → stop.

## Decision principles (when soft evals or codex disagree)
1. Brief alignment beats aesthetic preference.
2. Reuse beats novelty.
3. Real content beats placeholder, even if rougher.
4. Halting cleanly beats half-finishing.
5. One commit per task — squash later if needed.
6. If two reviewers agree and one disagrees, follow the majority and log the dissent.
