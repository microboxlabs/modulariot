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
- [ ] P0-05: Base layout + global nav shell (with visible GitHub button) + footer shell.
       — (acceptance: layout renders on `/`, links are placeholder hrefs, GitHub button
       links to https://github.com/microboxlabs/modulariot)

## Phase 1 — Hero & header (the first impression)
- [ ] P1-01: Promo ribbon component — dismissible via localStorage, server-renderable
       — (acceptance: dismissed state persists, no FOUC)
- [ ] P1-02: Header polish — live GitHub star count fetched at build time
       (`fetch` in a Server Component with `revalidate: 3600`), graceful fallback if rate-limited
- [ ] P1-03: Hero section — promise + subtext (BRIEF copy) + dual CTA (primary "See it running",
       secondary "Star on GitHub") + animated telemetry visual (small canvas / SVG; respects
       `prefers-reduced-motion`)

## Phase 2 — Narrative core (the symptom-intelligence story)
- [ ] P2-01: "Telemetry → Symptoms" section — 5-step horizontal flow:
       signals → behaviors → symptoms → treatments → evidence. Each step has a one-sentence
       explainer and a small visual. Hero claim: "A symptom is not just an alert."
- [ ] P2-02: Feature bento (7 cards) — ingestion, symptom intelligence, real-time dashboards,
       orchestration, evidence/audit, OSS deployment, developer APIs.
       Bento grid (Supabase-style asymmetric), each card uses brand color accent.
- [ ] P2-03: Architecture section — `Capture → Stream → Symptom Intelligence → Orchestrate → Visualize/Audit`.
       Replaceable-components framing. NO mention of Postgres/Pulsar/n8n by name on this section.

## Phase 3 — Trust & showcase
- [ ] P3-01: Domain strip — "Built for logistics, fleet operations, and industrial telemetry"
       (NO fake logos)
- [ ] P3-02: Hardware/cloud compatibility banner — generic icons for GPS providers,
       cloud providers, deployment models
- [ ] P3-03: Dashboard showcase — composite mock (map + symptom timeline + incident state +
       control-tower view). Static image OR a stylized SVG composition; do NOT embed live app.

## Phase 4 — Developer surface
- [ ] P4-01: Examples gallery — link-out shells (GitHub examples, Helm charts, n8n flow examples,
       API quickstart). Real links go to repo paths if they exist; placeholder href="#" otherwise
       with a TODO entry in PROGRESS.md.
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
- [ ] P3-04: Restyle `showcase/dashboard-map.svg` and `showcase/symptom-timeline.svg`
       to brand palette. (iter-2 discovery) Current colors are generic slate-50/900/red-500;
       must move to blue/yellow/orange/gray brand tokens before P3-03 ships. Belongs in
       Phase 3 alongside the dashboard showcase.
<!-- new tasks discovered mid-iteration get appended here with iter id -->
