---
name: Modular IoT Web Backlog
description: Ordered, phased task queue for the ralph loop. Top unblocked task is picked each iteration. Append discovered work as new tasks; mark done by checking the box and adding the iteration id.
---

# Backlog

Status legend: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked
Format: `- [STATUS] PHASE-NN: title — (acceptance: ...)`

## Phase A — Design alignment (run-2)
Design ref landed at `apps/web/.ralph/design-ref/ModularIoT Design System-landing/`.
Diff complete. Tasks below ordered for safe execution: foundation first, then
section-by-section rewrites, then voice/cleanup last. Each PA-NN is one iter.

- [x] PA-00: Diff complete (2026-05-07). Design system read; 30+ deltas captured;
       12-iter alignment plan generated with user approval (full-rewrite + Mintral-purge).

- [x] PA-01: Foundation tokens (PA-iter-1, 2026-05-07). Hard evals green.

- [x] PA-02: Purge Mintral assets + new BrandMark (PA-iter-2, 2026-05-07).

- [x] PA-03: Hero rewrite — flat + terminal-window pipeline (PA-iter-3, 2026-05-07).

- [x] PA-04: Promo dark-bar (PA-iter-4, 2026-05-07).

- [x] PA-05: Marquee tenants strip (PA-iter-5, 2026-05-07).

- [x] PA-06: Symptom narrative dense data flow (PA-iter-6, 2026-05-07).

- [x] PA-07: Bento rewrite — 6-col with 6 mini-visuals (PA-iter-7, 2026-05-07).

- [x] PA-08: Framework banner replaces CompatibilityBannerSection (PA-iter-8, 2026-05-07).

- [x] PA-09: Showcase Kanban + Map + check-list (PA-iter-9, 2026-05-07).

- [x] PA-10: Quick start 3-up cards + ExamplesGallery absorbed (PA-iter-10, 2026-05-07).

- [x] PA-11: Community + Final CTA + Footer rewrites (PA-iter-11, 2026-05-07).

- [x] PA-12: Voice + cleanup + EN/ES toggle + theme toggle (PA-iter-12, 2026-05-07).

## Phase 6 — Ops pages (deferred again — out of 12-iter alignment scope)
- [ ] P6-01: `/docs` stub
- [ ] P6-02: `/pricing` stub (OSS-first framing — "self-host free / managed coming")
- [ ] P6-03: `/open-source` page (deeper OSS story, contribution guide link)
- [ ] P6-04: `/status` placeholder

## Phase 0 — Foundation (must finish before Phase 1)
- [x] P0-01: Audit `apps/app` → write `STACK.md` (iter-1, 2026-05-07)
- [x] P0-02: Rescue brand assets from `apps/web-site` (iter-2, 2026-05-07)
- [x] P0-03: Bootstrap `apps/web` (iter-3, 2026-05-07). H-01/02/03/10 all green.
- [x] P0-04: Token-skin + `/dev/tokens` demo (iter-4, 2026-05-07). H-01/02/03 green.
- [x] P0-05: Base layout + nav + footer shells (iter-5, 2026-05-07). H-01/02/03 green.

## Phase 1 — Hero & header (the first impression)
- [x] P1-01: Promo ribbon (iter-6, 2026-05-07). Hard evals green.
- [x] P1-02: Live GitHub star count (iter-7, 2026-05-07). Hard evals green.
- [x] P1-03: Hero section (iter-8, 2026-05-07). Hard evals green. Soft eval self-pass.

## Phase 2 — Narrative core (the symptom-intelligence story)
- [x] P2-01: Telemetry → Symptoms section (iter-9, 2026-05-07). Hard evals green. Soft 9.4 avg.
- [x] P2-02: Feature bento, 7 primitives (iter-10, 2026-05-07). Hard evals green, soft 8.4 avg.
- [x] P2-03: Architecture section (iter-11, 2026-05-07). Hard evals green, soft 8.6 avg.

## Phase 3 — Trust & showcase
- [x] P3-01: Domain strip (iter-12, 2026-05-07). Hard evals green, soft 8.2 avg.
- [x] P3-02: Compatibility banner (iter-13, 2026-05-07). Hard evals green, soft 9.0 avg.
- [x] P3-03: Dashboard showcase (iter-14, 2026-05-07). Hard evals green, soft 8.4 avg.

## Phase 4 — Developer surface
- [x] P4-01: Examples gallery (iter-15, 2026-05-07). Hard evals green, soft 9.0 avg.
- [x] P4-02: Quick start code block (iter-16, 2026-05-07). Hard evals green, soft 9.2 avg.
- [x] P4-03: Community / OSS section (iter-17, 2026-05-07). Hard evals green, soft 9.2 avg.

## Phase 5 — Polish
- [x] P5-01: Final CTA (iter-18, 2026-05-07). Hard evals green, soft 9.4 avg (new high).
- [x] P5-02: Footer polish (iter-19, 2026-05-07). Hard evals green.
- [x] P5-03: Motion pass (iter-20, 2026-05-07). Hard evals green.
- [x] P5-04: A11y pass (iter-21, 2026-05-07). Hard evals green. Live axe deferred to user-attended iter.
- [x] P5-05: Perf pass (iter-22, 2026-05-07). Bundle 764 KB → 644 KB (-120 KB) by removing framer-motion.
- [x] P5-06: Deleted `/dev/tokens` route (iter-23, 2026-05-07). Build dropped 5→4 routes.

## Phase 6 — Ops pages (after halt; may roll into next ralph run)
- [ ] P6-01: `/docs` stub
- [ ] P6-02: `/pricing` stub (OSS-first framing — "self-host free / managed coming")
- [ ] P6-03: `/open-source` page (deeper OSS story, contribution guide link)
- [ ] P6-04: `/status` placeholder

## Discovered (added during the loop)
- [!] P0-06: Resolve design-file reference. (iter-1) WebFetch 404'd on the Anthropic
       design URL. Ask user to drop an HTML/screenshot export at
       `apps/web/.ralph/design-ref/`. Until then S-03 is downgraded to brief-alignment
       only. **BLOCKED on user**.
- [ ] P0-07: Produce a real dark-variant header logo. (iter-2) `headlogo.svg` and
       `headlogo-dark.svg` rescued from web-site are byte-identical — bug in source.
       Likely Phase 1 work; do not ship Phase 1 nav until this is resolved.
- [ ] P0-08: Generate full favicon set. (iter-2/iter-3 update) `favicon.ico` was rescued
       from web-site in iter-3 and lives at `apps/web/src/app/favicon.ico`. Still missing:
       `apple-touch-icon.png`, `icon-192/512.png`, OG card 1200x630. Source: `public/brand/logo.svg`.
       Tooling: `sharp` or `realfavicongenerator`. Schedule before Phase 5 polish.
- [ ] P3-04: Restyle `showcase/dashboard-map.svg`, `showcase/symptom-timeline.svg`,
       AND `architecture.svg` to brand palette + Inter font. (iter-2/iter-11 discovery)
       Current colors are generic slate-50/900/red-500; arch.svg uses Arial. Move to
       blue/yellow/orange/gray + Inter via `font-family` overrides or rebuild as React
       components. Schedule in Phase 3 alongside the dashboard showcase.
- [ ] P1-04: After flowbite-theme.ts has fully-skinned Button/Card primitives, refactor
       hero CTAs from bare `<a>` / `<Link>` + Tailwind to the skinned `<Button>` primitive.
       (iter-8 deferred) Hero currently uses bare elements for tighter visual control;
       worth the brand consistency once the skin matures.
- [x] P1-05: LCP/perf review (iter-22, 2026-05-07). Folded into P5-05. Hero entrance
       converted to CSS-only @keyframes; SSR HTML now ships visible (no opacity:0
       LCP risk); framer-motion dep removed entirely; -120 KB bundle savings.
- [ ] P5-09: Add copy-to-clipboard buttons on the QuickStartSection code blocks.
       (iter-16 deferred) Requires "use client" leaf — defer until P5 polish so other
       Phase 4-5 work stays in RSC.
- [ ] P5-08: Standardize on Heroicons v2 (`react-icons/hi2`) across all marketing
       sections. (iter-10 discovered) Currently `hi` is used in promo-ribbon + hero +
       part of P2-01, while `hi2` is used in P2-02 and the rest of P2-01. Pick one
       family for visual consistency.
- [x] P5-07: ~~Promo-ribbon FOUC fix~~ — OBSOLETE. PA-04 dropped client state entirely;
       the ribbon is now pure RSC with no dismiss → no FOUC possible.
<!-- new tasks discovered mid-iteration get appended here with iter id -->
