## Prompt (REV 5 — Supabase-Style Structure)

> **Context**: The landing page currently follows REV 4 (hero, architecture, etc.).
> **Goal**: Re-order and extend sections to match the Supabase public site layout while re-using our existing components, brand palette, and GitHub emphasis.

---

### 1 · New high-level section order

| #   | ID / Component             | Notes & mappings                                                                                                                                                                             |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | **PromoRibbon** (optional) | Thin strip, dismissible. CMS-driven text (launch week, survey, etc.).                                                                                                                        |
| 1   | **TopNav** (existing)      | Keep GitHub button. Add “Docs”, “Blog”, “Pricing” placeholders (scroll anchors for now).                                                                                                     |
| 2   | **Hero** (existing)        | No change, but ensure dual CTAs line up with Supabase style (primary + ghost).                                                                                                               |
| 3   | **LogoWall**               | Auto-scrolling grid of client logos (Mintral, …). Use Flowbite Carousel in “marquee” mode.                                                                                                   |
| 4   | **FeatureBento**           | 6–7 square cards in a responsive grid: <br> 1 Data Ingestion · 2 Symptom Engine · 3 Orchestration · 4 Realtime Dashboards · 5 Developer APIs · 6 Open Source Swap-a-Box · 7 (Edge optional). |
| 5   | **FrameworkBanner**        | Strip: “Use Modular IoT with any fleet hardware & any cloud.” Icons for MQTT, REST, Pulsar, GCP, Azure, AWS.                                                                                 |
| 6   | **CustomerStories**        | Carousel of 3 case-study cards (logo, pull quote, link).                                                                                                                                     |
| 7   | **QuickStartGallery**      | “Start monitoring in minutes” – three example tiles linking to GitHub templates (Helm chart, Pulsar connector, n8n flow).                                                                    |
| 8   | **DashboardShowcase**      | Two side-by-side screenshots (deck.gl map & Symptom timeline) + bullet list of UX perks.                                                                                                     |
| 9   | **CommunityTweets**        | Grid of 4 embedded tweets / LinkedIn posts praising DX.                                                                                                                                      |
| 10  | **FinalCTA** (existing)    | Re-use current banner; tweak wording to echo hero headline.                                                                                                                                  |
| 11  | **SecurityStrip**          | Mini strip: “SOC 2-Type 2 • ISO 27001 • GDPR-ready”.                                                                                                                                         |
| 12  | **MegaFooter**             | Multi-column footer à la Supabase: Product, Developers, Company, Resources; status page link.                                                                                                |

---

### 2 · Implementation tasks

1. **Create new section components** under `/components/sections/` for LogoWall, FeatureBento, FrameworkBanner, CustomerStories, QuickStartGallery, DashboardShowcase, CommunityTweets, SecurityStrip, PromoRibbon.
2. **Update `/app/page.tsx`** to render sections in the order above.
3. **Tailwind layouts**

   - Use `max-w-7xl mx-auto px-6 lg:px-8` wrappers.
   - FeatureBento: CSS Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
   - LogoWall: continuous scroll via `animate-[scroll_20s_linear_infinite]`.

4. **Flowbite Pro components**

   - Carousel for LogoWall & CustomerStories.
   - Accordion not needed in new flow (FAQ section dropped).
   - Cards for FeatureBento, QuickStart, CustomerStories.

5. **Framer-motion**

   - Apply `fadeInUp` on section viewport entry (same animation, new refs).

6. **Content placeholders**

   - Logos: place under `/public/logos/*.svg`.
   - Screenshots: `/public/screens/dashboard-map.png`, `/public/screens/symptom-timeline.png`.
   - Tweets: use static image thumbnails first; real embeds later.

---

### 3 · Acceptance criteria

- Page renders sections in new order with no visual regressions on ≤ 320 px.
- Top-nav, hero CTAs, and GitHub button unchanged.
- Lighthouse mobile & desktop ≥ 95.
- All new images lazy-loaded with `next/image`.
- No ESLint / TypeScript errors; `npm run build` passes.

---

### 4 · Deliverables

1. **Branch & PR** `feat/layout: supabase-style refactor`.
2. Updated components, screenshots, asset stubs.
3. PR body with before/after screenshots (desktop & mobile) and Lighthouse scores.

---

**Begin implementation now.** Continue commit prefix convention `feat/layout): …`.
