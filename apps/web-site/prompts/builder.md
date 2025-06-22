## Prompt: Build Modular IoT Landing Page (Next .js 15 + Tailwind + Flowbite Pro)

> You are an autonomous front-end engineer.
> Your task is to scaffold and implement a production-ready marketing landing page for **Modular IoT**, following the specs below.

---

### 1. Tech & tooling

1. **Framework** : Next.js 15, App Router, `pages` disabled.
2. **Language** : TypeScript, ESLint + Prettier.
3. **Styling** : Tailwind CSS v4 with Flowbite plugin; extend brand colors (`primary`, `accent`) in `tailwind.config.ts`.
4. **UI kit** : Flowbite Pro React components only. If a Flowbite component is missing, build it with plain Tailwind utility classes.
5. **Animation** : Framer-motion for subtle fade/slide on scroll (section stagger).
6. **Assets** : Optimise images via `next/image`; GIF/MP4 loops under `/public/demo`.
7. **Icons** : Flowbite-icons for icons.
8. **CI** : `npm run lint` + `npm run build` must succeed.

---

### 2. Page anatomy (desktop → mobile)

> Use semantic HTML5; wrap each numbered block in its own section component under `/components/sections`.

1. #### Hero

   - **Layout**: two-column grid (`lg:grid-cols-2`).
   - **Headline**: “Own your fleet data in real time—without SaaS handcuffs.”
   - **Subline**: “Stream every GPS ping, sensor value and driver event through _your_ cloud in milliseconds.”
   - **CTAs**

     - Primary: “Schedule a 20-min Tech Demo” → `#cta-form`.
     - Secondary text-link: “Read 5-min Architecture Guide” → smooth-scroll to block 4.

   - **Visual**: right column shows animated SVG of the pipeline (placeholder asset `/public/hero-pipeline.svg`).

### 2. **Brand Colour Palette** (Tailwind v4 `@theme`)

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-blue-50: #ebf7ff;
  --color-blue-100: #d1e8ff;
  --color-blue-200: #aee2ff;
  --color-blue-300: #76d2ff;
  --color-blue-400: #35b7ff;
  --color-blue-500: #0790ff; /* ← primary brand (Selective Blue 500) */
  --color-blue-600: #006aff;
  --color-blue-700: #0051ff;
  --color-blue-800: #0043d7;
  --color-blue-900: #003da5;
  --color-blue-950: #062665;

  --color-yellow-50: #fffde7;
  --color-yellow-100: #fffac1;
  --color-yellow-200: #fff186;
  --color-yellow-300: #ffe141;
  --color-yellow-400: #ffce0d;
  --color-yellow-500: #ffb300;
  --color-yellow-600: #d18900;
  --color-yellow-700: #a66102;
  --color-yellow-800: #894b0a;
  --color-yellow-900: #743e0f;
  --color-yellow-950: #441f04;

  --color-gray-50: #f4f5f7;
  --color-gray-100: #e4e8e9;
  --color-gray-200: #ccd1d5;
  --color-gray-300: #a8b1b8;
  --color-gray-400: #7d8a93;
  --color-gray-500: #5b6770;
  --color-gray-600: #545e66;
  --color-gray-700: #484f56;
  --color-gray-800: #40454a;
  --color-gray-900: #383b41;
  --color-gray-950: #232529;

  --color-orange-50: #fff6ed;
  --color-orange-100: #ffebd4;
  --color-orange-200: #ffd3a8;
  --color-orange-300: #ffb470;
  --color-orange-400: #ff8837;
  --color-orange-500: #ff6a14; /* blaze accent */
  --color-orange-600: #f04c06;
  --color-orange-700: #c73707;
  --color-orange-800: #9e2c0e;
  --color-orange-900: #7f270f;
  --color-orange-950: #451005;
}
```

2. #### Pain ↔ Outcome strip

   - Dark background (`bg-gray-900 text-white`).
   - Two equal columns:

     - Pain bullets with `HiExclamation` icon.
     - Outcome bullets with `HiCheckCircle` icon (Flowbite-icons).

3. #### Feature Trio

   - Implement as Flowbite `Tabs` + icon tops:

     1. “Realtime Streaming Pipeline”
     2. “Symptom-based Alerting”
     3. “Workflow & Evidence Vault”

   - Inside each tab show a code-looking block (`<pre>` with Tailwind `bg-gray-800`).

4. #### Architecture Diagram

   - Full-width (`max-w-7xl`). Import `/public/architecture.svg`.
   - Caption: “< 56 ms median end-to-end latency”.

5. #### Live Demo Carousel

   - Use Flowbite `Carousel` component, 3 slides (GIF loops):

     - Driver fatigue trigger → SMS.
     - Deck.gl geofence breach.
     - BPMN auto-advance.

6. #### Deployment Flavours

   - Three Flowbite `Card` components in a responsive grid.
   - Cards: “Your Cloud”, “Managed by MBL”, “Hybrid Edge”.
   - Each card includes a secondary CTA link “See reference cost”.

7. #### Case Study

   - Quote block with company logo placeholder `/public/mintral-logo.svg`.
   - Italic pull-quote: “We cut driver-fatigue incidents by 32 % within two weeks.”

8. #### Pricing Teaser

   - Simple three-column table (`Starter / Growth / Enterprise`).
   - Focus metric: **events / month**.
   - Starter line: “from 60 UF / month incl. L1 support”.

9. #### FAQ Accordion

   - Flowbite `Accordion` with at least five Q\&As (Pulsar vs Kafka, GDPR, egress IP, etc.).

10. #### Final CTA Banner

    - Centered text, primary button “Book Integration Call”. Smooth-scroll to page-bottom form.

11. #### Footer

    - Four-column grid: Docs & GitHub • Blog • About MicroboxLabs • Social links (LinkedIn / X).

---

### 3. Global behaviours & polish

- Top nav becomes sticky after first viewport.
- Dark-mode ready (Tailwind `dark:` variants); default to OS preference.
- All CTAs trigger a Flowbite `Modal` containing an embedded Calendly widget (`ENV.NEXT_PUBLIC_CALENDLY_URL`).
- Add canonical link, OpenGraph meta, `robots.txt`.
- Lighthouse scores ≥ 95 on mobile & desktop.

---

### 4. Deliverables

1. **Repo structure**

```
/app                                   # Next.js app router
│  layout.tsx
│  page.tsx
/components
│  /sections/*
│  CTAButton.tsx
/public
  hero-pipeline.svg
  architecture.svg
  /demo/*.gif
```

2. **README.md**: install, dev, deploy to Vercel instructions.
3. **Deployment preview** on Vercel (auto PR comments).

---

### 5. Acceptance criteria

- Code compiles with no TypeScript errors and passes `npm run lint`.
- Design matches Flowbite Pro spec; responsive down to 320 px.
- All interactive elements keyboard-accessible; `aria-*` labels present.
- Form + Calendly integration tested via Vercel preview link.

---

### 6. Stretch (optional)

- Add `/docs` route placeholder using Nextra (brand-colors imported) for future technical docs.
- Integrate `@vercel/analytics` for page-view tracking.

---

**Begin implementation now.** Report progress with commit messages prefixed `feat(landing):` and open a pull request when ready for review.
