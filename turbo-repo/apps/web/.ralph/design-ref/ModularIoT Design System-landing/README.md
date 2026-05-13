# ModularIoT Design System

**ModularIoT (MIOT)** is an AI-first, open-source platform for fleet and
asset monitoring that operates at the integration layer — standardizing data
from hardware integrators (GPS, sensors, ERPs) into a coordinated operational
view. Internally we call it "the Datadog of operational execution."

The platform is **white-label by design**. ModularIoT ships a base visual
language — tokens, type, iconography, layout primitives — that each tenant
extends with its own brand, vocabulary, and domain-specific glyphs. This
design system documents both layers:

- The **platform layer** (ModularIoT core) — the reusable foundation:
  operator-facing density, Flowbite-based UI primitives, Inter type ramp,
  status semantics, motion, kanban and control-tower patterns.
- The **tenant layer** — the overrides a specific implementation applies on
  top: logo, accent color, domain vocabulary, bespoke iconography.

**Mintral is the reference tenant** captured here in hi-fi. It is the mining-
logistics implementation of ModularIoT built for Grupo Ultramar. Everything
marked *(tenant: Mintral)* in this document is a concrete example of how the
platform is skinned for a specific vertical, not a property of the platform
itself. Other active tenants (Gama, and pipeline clients like SQM, CCU,
Melón, Sitrans) follow the same pattern with their own overrides.

When generating new UI:
- If the screen is part of the **platform** (operator shells, kanban mechanics,
  auth, settings, directory services), follow the core layer and leave brand
  slots (logo, accent) as tokens.
- If the screen is **tenant-specific** (Mintral trip-signature flow, Gama
  contract-supervisor portal), layer the tenant's overrides over the platform.

---

## Sources used to build this system

- **Figma — "Projecto MBL - Mintral.fig"** — mounted as a virtual filesystem.
  Used as the hi-fi source of truth for the Mintral reference tenant; patterns
  generalizable to the platform were extracted explicitly. Key pages:
  - `/Log-in-Recuperar-clave` — auth surfaces (light/dark, web/tablet/mobile) *(platform)*
  - `/Kanban-viajes` — the core operator view, 26+ variants *(platform pattern, Mintral copy)*
  - `/Onboarding-Tutorial` — first-run flow *(platform)*
  - `/Tabla`, `/Formularios`, `/Mapa-Reporte`, `/Expediente` — secondary views *(platform)*
  - `/UI-Components` — atoms: buttons, inputs, badges, avatars, cards,
    timeline, sidebar, filter pills, icons *(platform)*
  - `/MBL` — the MicroBoxLabs marketing site (light + dark) *(corporate)*
  - `/Guia-de-estilos` — declared color swatches + Flowbite icon references *(platform)*

- **Codebase (`app/`)** — Next.js + TypeScript app, current Mintral deployment
  - `tailwind.config.ts` — animation + keyframe definitions *(platform)*
  - `src/features/auth/**` — login flow, SSO/credentials *(platform, via Auth0/Entra ID)*
  - `src/features/layout/**` — secured shell: sidebar, topbar, secondary panel *(platform)*
  - `src/features/sidebar/**` *(platform)*
  - `src/lang/en.json` — product copy (tone reference; some entries are Mintral-specific)
  - `src/features/theme/flowbite-theme.ts` — Flowbite React theme overrides *(platform)*
  - `public/` — logos, icons, medical/condition/pin SVGs, kanban assets (mixed: platform + Mintral)

- **GitHub** — `microboxlabs/modulariot` (browsed on demand, not pre-imported)

None of these are required to consume the design system — everything needed
has been copied into this project. Links are recorded so a future maintainer
can go back to the source of truth.

---

## Index

| File / folder                | Layer        | Purpose |
|------------------------------|--------------|---------|
| `README.md`                  | —            | This file — platform vs. tenant context, content rules, visual foundations, iconography |
| `SKILL.md`                   | —            | Agent-invocable skill front matter |
| `colors_and_type.css`        | Platform     | Token layer: colors, type, spacing, radii, shadows, motion |
| `fonts/`                     | Platform     | Self-hosted webfont files (Inter, DM Sans) |
| `assets/platform/`           | Platform     | Core icons: Flowbite re-exports, kanban primitives, generic pins |
| `assets/tenants/mintral/`    | Tenant       | Mintral logo, medical/condition/faena glyphs, SOVOS/Overlord affordances |
| `preview/`                   | —            | Design-system cards rendered in the DS tab |
| `ui_kits/modulariot-shell/`  | Platform     | The secured app shell with no tenant skin applied |
| `ui_kits/mintral-app/`       | Tenant       | Hi-fi recreation of the Mintral operator app (secured layout, kanban, login) |
| `ui_kits/mbl-marketing/`     | Corporate    | Marketing site recreation (MicroBoxLabs landing) |

> The `assets/` and `ui_kits/` split above is the target state. The current
> codebase still colocates tenant and platform assets; cleanup is tracked
> separately.

---

## CONTENT FUNDAMENTALS

### Platform voice (applies to every tenant)

ModularIoT is an operator product: dense, status-first, imperative. The
platform voice is **neutral-operational — like a radio dispatch.** Not
friendly, not cold.

- **Person**: mostly **third-person status reports** ("Viaje iniciado", "Trip
  started") and **second-person imperatives** ("Confirm delivery", "Start
  trip"). First person is almost never used. The homepage task counter says
  `"My tasks"` / `"Mis tareas"` — that's the one exception.
- **Casing**:
  - Screen titles and section headers: **Sentence case** ("Confirm delivery",
    "Driver validation"), not Title Case.
  - Buttons & primary CTAs: Sentence case ("Sign in to your account",
    "Continue with Google").
  - Status badges / kanban column headers: **Sentence case** too — "Pendiente",
    "Aprobada", "En curso", not ALL CAPS.
  - The only uppercase treatment is the **tenant logo wordmark** (e.g.
    MINTRAL) and tiny eyebrow labels.
- **Terse imperative commands**: no apologizing, no pleasantries, no
  exclamation marks.
- **Error messages** are direct and formal: *"Access denied. Please verify
  your credentials and try again."* — blame-neutral, no "oops", no emoji.
- **Numerics**: plain numbers + unit suffix ("12 visibles", "ETA: 14:32",
  "3 días"). No "just", "only", "about".
- **Emoji**: **not used anywhere** in product copy. Don't add them.
- **Bilingual**: Spanish (Chile/LatAm) is the primary voice; English is a
  direct translation. Copy strings live in locale files per tenant.

### Tenant vocabulary (example: Mintral)

Each tenant brings its own domain vocabulary. These terms are kept **in
Spanish even in English UI** when they are proper nouns for roles/places/
providers. For the Mintral tenant:

- *Faena* — mining work-site
- *Sovos* — digital-signature provider (external)
- *Overlord* — secondary authorization role
- *Código negro* — top-urgency alert (literally "black code")
- *Torre de Control* / Control Tower — dispatch hub
- *Conductor* — driver
- *Viaje* — trip

Gama, SQM and other tenants bring their own terms (contratos, supervisores,
claims, etc.). When building a new tenant skin, capture its vocabulary in a
similar glossary and treat it as a translation override, not as platform copy.

### Voice examples (platform-level, copy faithfully)

- "Welcome back" (not "Hey there!")
- "Sign in to your account" (not "Let's get you signed in")
- "Confirm trip destination arrival" (not "Arrived? Confirm it here")
- "Trip started · Confirm finalization" — single line, middle-dot separator
- "{count} visibles" — tight count + unit

---

## VISUAL FOUNDATIONS

### Palette

**Platform tokens (every tenant inherits these):**

- **Primary action**: Flowbite **blue `#1C64F2`** (hover `#1A56DB`). This is
  the one platform-level blue — CTAs, focus rings, selected states.
- **Neutrals**: Flowbite gray ramp `gray-50 → gray-900`. The entire product
  is built on this ramp.
- **Status semantics** (fixed across tenants):
  - green `#0E9F6E` = approved / success
  - amber `#F59E0B` = pending / warning
  - rose `#E11D48` = rejected / urgent
  - blue `#1C64F2` = in progress / info
- **Dark mode** is first-class. Gray-800/900 surfaces, inverse text.

**Tenant brand overrides (example: Mintral):**

- Brand accent: Selective Yellow `#FFB017` on the "M" mountain glyph, Nevada
  slate `#262626` on the wordmark, Blaze Orange `#C54600` as the warm shadow.
  The yellow is scarce — logo, highlight dots, occasional marketing hero.
  In-product it reads as warning-adjacent.

Other tenants (Gama, etc.) replace the brand accent with their own. The
platform blue and the four status colors do **not** change per tenant —
operators moving between implementations need a stable status language.

### Type

**Platform (no tenant override):**

- **Inter** is the system workhorse — mostly Medium (500) at 11/12/14 px for
  dense UI, Semi Bold (600) for titles. `font-feature-settings: "cv02",
  "cv03", "cv11"` is on.
- **DM Sans** Bold appears on display/marketing numerals (counters at 100 px).
- Scale: 11 / 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 px. Body default
  **14 px** (not 16 — this is a dense operator UI).
- Line-height: 1.5 for body, 1.15–1.3 for headings.

**Tenant-optional:**

- **Havelock Titling Black** is a proprietary serif used ONCE on the MBL
  marketing hero. Substituted with Oswald/Anton — **see Font substitutions**.
  A tenant may bring its own display face for marketing; product UI stays on
  Inter.

### Backgrounds

- **Flat white** `#FFFFFF` canvas, **gray-50** `#F9FAFB` page bg. No gradients
  in product UI. No textures. No patterns.
- Full-bleed imagery is reserved for (a) the map view (real satellite /
  road tiles from a map provider) and (b) marketing surfaces.
- **Login hero imagery is tenant-owned**: Mintral uses a mining truck photo;
  Gama would use a leasing fleet photo. The split-layout pattern (photo
  right, form left on flat white) is platform.
- No hand-drawn illustrations. No emoji cards.

### Borders & cards

- **1 px borders** (`gray-200` / `gray-900` dark) are the primary separator.
  Cards are `border-1 + radius-lg (8px) + white bg` — **no shadow by default**.
- Shadow is reserved for floating chrome: popovers, dropdowns, modals,
  hovered kanban cards. Use the `--shadow-sm` / `--shadow-md` ramp.
- Radii: `8px` everywhere (buttons, cards, inputs), `9999px` for pills/badges
  and avatars. Nothing is sharp-cornered.

### Elevation / blur / transparency

- The sidebar is **opaque** (not translucent). The secondary panel too.
- Modals have a `rgba(0,0,0,0.5)` backdrop, no blur.
- Transparency is used rarely — status-badge backgrounds in dark mode
  (`rgba(14,159,110,0.15)` etc.), the rose alert glow
  (`0 0 10px rgba(225,29,72,0.6)`).

### Motion

- Short and utilitarian. The Tailwind config ships `hide / show / fade-in
  / fade-out / scale / width` keyframes all **200 ms**, plus a few 5 s
  fades for overlay content.
- The signature motion is the **`shadow-toggle`** — a 0.5 s infinite alternate
  rose-pulse box-shadow on rows that need operator attention (`animate-
  shadow-toggle`). This is a platform primitive; tenants use it for their
  own alert semantics.
- Orbit animations (5–6 s) are used on the login loader — two dots circling.
- Easing defaults to `ease-in-out`. No bounces. No spring. No scale-on-click.
- **Hover**: background darkens one step on the gray ramp (`gray-50 →
  gray-100`), or the blue steps from `blue-600 → blue-700`. No opacity tricks.
- **Press / active**: one further ramp-step darker; no scale transform.
- **Focus**: 4 px blue ring (`focus:ring-4`, `--blue-200`) — Flowbite default.

### Layout

- Secured app shell: fixed left sidebar (256 px expanded / 64 px collapsed),
  fixed top navbar 60 px, content area with a 24 px gutter. The sidebar
  collapses below lg breakpoint into a bottom nav.
- Kanban columns are 280 px wide, horizontal-scroll container. The kanban
  **mechanics** are platform; the **column set** and **card content** are
  tenant-defined (Mintral has 8 columns from driver-validation to monitoring-
  finalized; Gama's contract-supervisor flow would define its own).
- Content max-width: **1440 px** — the Figma canvases are almost all
  1440 × 800.
- A 4 px grid underlies all spacing (`--space-1 = 4px` → `--space-16 = 64px`).

### Color vibe of imagery

- Imagery is tenant-owned and matches each tenant's operational context
  (mining ochre for Mintral, automotive neutrals for Gama leasing, etc.).
  The platform rule is: warm, real, on-site photography. Not desaturated,
  not black-and-white, not stock-looking.
- UI does not tint imagery. No duotones.

---

## ICONOGRAPHY

Icons split cleanly along the platform/tenant line:

1. **Flowbite Icons (Outline + Solid)** — *(platform)* — the workhorse UI
   icon set. Every navigation item, form field, button affordance comes from
   here. Stroke width 1.5–2 px, rounded joins, 20 × 20 px display size
   (24 × 24 native). Available on CDN — this system links **`flowbite` via
   CDN** and re-exports named SVGs from the app's public folder where they
   were pre-rasterized.

2. **Tenant domain glyphs** — bespoke icons that encode operator semantics
   no generic set covers. Stored under `assets/tenants/<tenant>/icons/`.
   For Mintral: `ambulance`, `medical-cross`, `therapy-1/2`, `alerta-critica`,
   `codigo-negro`, `en-observacion`, `estable`, blue/red/yellow pins, QR,
   fingerprint, control-tower, id-card. Gama's set will be different
   (vehicle-return, contract-signature, claim-declared, etc.). Treat this
   layer as the tenant's vocabulary made visual.

3. **Lordicons (animated GIFs)** — *(platform pattern, tenant content)* —
   used for kiosk / totem feedback states (fingerprint OK, approve-checked,
   error). Referenced by JSON config (`lordicons.json`,
   `lordicons-smartcard.json`) — these are the only animated icons in the
   system. The animation-as-feedback pattern is platform; the specific
   states are tenant-driven.

No emoji. No Unicode glyph substitution (no `✓`, `→`, `★`). Use the SVG.

When generating new UI:
- Reach for **Flowbite Icons via CDN** first:
  `<script src="https://unpkg.com/flowbite@2/dist/flowbite.min.js"></script>`
  or import individual SVGs from `unpkg.com/flowbite@2/dist/icons/`.
- If the semantic concept is tenant-specific (a condition, a pin colour, a
  driver-verification state), use the custom SVG already in
  `assets/tenants/<tenant>/icons/`.
- If nothing exists, draw NOTHING — leave a `20×20` placeholder box with a
  dashed border and flag it to the user.

### Logos

- **Platform**: ModularIoT mark lives at `assets/platform/logo-modulariot.svg`
  (and dark variant). Used on platform-level surfaces (admin, docs, OSS
  landing).
- **Tenant (Mintral)**: `assets/tenants/mintral/logo-mintral.png` — yellow
  "M" mountain + slate "MINTRAL" wordmark + "LOGÍSTICA MINERA" tagline. Use
  on white. Mono variants: `logo.svg`, `logo2.svg`. Dark surface:
  `logo-mintral-dark.png`.
- Tenant logos occupy a fixed slot in the sidebar and the login split-layout.
  The slot dimensions and padding are platform; the artwork is tenant.

---

## Font substitutions (please confirm)

| Original                | Substitute                                        | Reason |
|-------------------------|---------------------------------------------------|--------|
| Inter (variable)        | **Inter variable from rsms/inter** (self-hosted)  | exact match |
| DM Sans                 | **DM Sans from Google Fonts** (self-hosted)       | exact match |
| Havelock Titling Black  | **Oswald / Anton** (system fallback)              | proprietary Monotype font, no license |

**If you have the Havelock Titling Black license/files, drop them in
`/fonts/` and we'll update `colors_and_type.css`.** It only affects a single
marketing hero in `/MBL`, so the substitution is low-risk.
