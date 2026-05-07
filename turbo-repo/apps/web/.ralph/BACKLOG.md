---
name: Modular IoT Web Backlog
description: Ordered, phased task queue for the ralph loop. Top unblocked task is picked each iteration. Append discovered work as new tasks; mark done by checking the box and adding the iteration id.
---

# Backlog

Status legend: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked
Format: `- [STATUS] PHASE-NN: title — (acceptance: ...)`

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
- [ ] P4-02: Quick start code block — copyable `docker compose` snippet + `git clone` + a
       2-line API call example. Use shiki or a minimal highlighter.
- [ ] P4-03: Community / OSS section — GitHub link, contributors strip (placeholder), roadmap stub link

## Phase 5 — Polish
- [ ] P5-01: Final CTA section — three paths: "See it running" / "Read the docs" / "Star on GitHub"
- [ ] P5-02: Footer (product / developers / company / resources columns)
- [ ] P5-03: Motion pass — subtle data-flow animation on architecture section,
       `prefers-reduced-motion` respected everywhere
- [ ] P5-04: A11y pass — axe clean (0 critical/serious), focus rings, contrast on brand colors,
       skip-to-content link
- [ ] P5-05: Perf pass — LCP < 2.0s, CLS < 0.05, first-load JS < 180KB on `/`. Convert any
       hero animations to CSS-only or WAAPI if framer-motion bloats the bundle.
- [ ] P5-06: Delete `/dev/tokens` route from P0-04 (note: actual path uses `dev/`,
       not `_dev/` — leading underscore is reserved as a private folder in App Router)

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
- [ ] P1-05: LCP/perf review of the hero. (iter-8 deferred) framer-motion entrance
       animations set `opacity:0` in SSR HTML, which can hurt LCP. If P5 perf eval
       shows LCP > 2.0s, swap framer-motion entrance animations for CSS-only
       @keyframes (the data-flow sweep is already CSS-only).
- [ ] P5-08: Standardize on Heroicons v2 (`react-icons/hi2`) across all marketing
       sections. (iter-10 discovered) Currently `hi` is used in promo-ribbon + hero +
       part of P2-01, while `hi2` is used in P2-02 and the rest of P2-01. Pick one
       family for visual consistency.
- [ ] P5-07: Replace promo-ribbon localStorage check with an inline-script pattern
       (matching ThemeModeScript) so returning dismissed visitors get zero FOUC.
       (iter-6 discovered) Currently 1-frame flicker is acceptable for Phase 1.
<!-- new tasks discovered mid-iteration get appended here with iter id -->
