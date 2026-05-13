---
name: Modular IoT Web Evals
description: Hard gates and soft scored checks run each iteration. Hard red blocks the iteration; soft < 7 spawns a follow-up task in BACKLOG.
---

# Evals

## Hard evals — any red blocks the iteration

| id   | eval              | command / tool                                                              | threshold                                |
|------|-------------------|------------------------------------------------------------------------------|------------------------------------------|
| H-01 | typecheck         | `npx turbo run check-types --filter=@modulariot/web`                         | exit 0, 0 errors                          |
| H-02 | lint              | `npx turbo run lint --filter=@modulariot/web`                                | exit 0, 0 errors / 0 warn on touched files |
| H-03 | build             | `npx turbo run build --filter=@modulariot/web`                               | exit 0                                    |
| H-04 | knip (dead code)  | `npx turbo run knip:check --filter=@modulariot/web`                          | no new unused exports vs prior iteration  |
| H-05 | bundle budget     | parse `.next/analyze` or check `Page Size` in build stdout                   | first-load JS < 180 KB on `/`             |
| H-06 | console clean     | `mcp__claude-in-chrome__read_console_messages` after navigate                | 0 errors, 0 unhandledrejection            |
| H-07 | network clean     | `mcp__claude-in-chrome__read_network_requests`                               | 0 4xx/5xx for first-party paths           |
| H-08 | a11y axe          | `mcp__claude-in-chrome__javascript_tool` injecting axe-core, run on body    | 0 critical, 0 serious                     |
| H-09 | visual presence   | screenshot via chrome MCP at 375 / 768 / 1280                                | non-empty, no overflow, no layout collapse |
| H-10 | dev server boots  | run `npm run dev -w @modulariot/web` (or turbo equivalent) in background     | 200 OK on `/` within 30s                  |

### Hard eval execution order
H-01 → H-02 → H-03 → H-04 → H-05, then start dev server (H-10), then H-06 → H-07 → H-08 → H-09.
Stop at first red and attempt a fix in the same iteration. Do not advance to soft evals.

### claude-in-chrome MCP usage notes
- Always call `mcp__claude-in-chrome__tabs_context_mcp` first — never reuse cross-session tab IDs
- Use `mcp__claude-in-chrome__tabs_create_mcp` to open a fresh tab for evals; close it at end of
  iteration via `mcp__claude-in-chrome__tabs_close_mcp`
- Avoid pages that trigger `alert/confirm/prompt` — they freeze the extension
- For multi-step interaction recording, use `mcp__claude-in-chrome__gif_creator` named
  `iter-<N>-<phase>.gif`

## Soft evals — LLM-as-judge, scored 0–10

Run each via a fresh sub-prompt. The judge sees the changed section's screenshot + diff +
relevant BRIEF.md excerpt only — not the full conversation.

| id   | dimension          | judge prompt                                                                                                                                                                      |
|------|--------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| S-01 | Narrative fidelity | "Reading only the changed section, does the visitor learn one of BRIEF.md's core ideas (symptom intelligence / OSS-first / modular / real-time / operational evidence)? Score 0-10 and name which idea." |
| S-02 | Voice              | "Is the copy serious-but-not-corporate, technical-but-understandable per BRIEF? Flag every line that reads as generic SaaS. Score 0-10."                                          |
| S-03 | Design coherence   | "Compare the screenshot to the design reference at `apps/web/.ralph/design-ref/`. Score visual alignment 0-10. List the top 3 specific deltas with element names." **DISABLE this eval entirely if design-ref/ is empty or missing — record `S-03: SKIPPED (no ref)` instead of a fake number.** |
| S-06 | Design diff        | "For the changed section only, list the top 3 visual deltas vs the corresponding section in `apps/web/.ralph/design-ref/`. Each delta as `<element>: <observed> → <design says>`. These deltas auto-generate next-iter BACKLOG entries." Only runs if design-ref/ exists. |
| S-04 | Reuse discipline   | "Did this iteration use existing apps/app primitives, or invent new ones? Cite specific filenames and components. Score 0-10."                                                    |
| S-05 | OSS signal         | "Is the open-source identity visible in this section (badge, repo link, deployable banner, license callout, contributor reference)? Score 0-10."                                  |

### Soft eval rules
- Each score lands in `eval-results/iter-<N>.json` keyed by id.
- Scores < 7 → spawn a follow-up task in `BACKLOG.md` (`Discovered` section), referencing
  the iter id and judge feedback.
- Do NOT block the iteration on soft evals — record and continue.
- Two consecutive iterations with a same-dimension score < 7 → escalate: the next iteration's
  top-of-queue task becomes "address persistent <dimension> regression".

## Trend tracking

Every 10 iterations the loop computes:
- mean / median / min / max for each soft dimension across the last 10
- pass-rate for each hard eval across the last 10
- bundle-size delta vs iter 1
- LCP / CLS / first-load-JS delta vs iter 1 (when available)

Writes the trend block to PROGRESS.md so the next iteration can see drift early.

## Halt-condition evidence

When the loop halts, it writes a final block to PROGRESS.md:
- which halt condition fired
- last 5 PROGRESS entries
- final eval scores
- list of open tasks in BACKLOG
- screenshot dir paths for the latest iteration

This block is what the user reads when re-engaging with the project.
