# Brand assets

The Modular IoT brand mark is **rendered in code as CSS**, not loaded as an SVG.
See `apps/web/src/features/layout/components/brand-mark.tsx`.

The mark spec from the design system (`design-ref/.../landing/landing.css`):

- **Outer**: 24×24 square, ink-1 background (`#0B1220`), 6px corner radius
- **Inset top-left**: 8×8 square, blue-600 (`#1C64F2`), 1.5px radius, 5px from top/left
- **Inset bottom-right**: 8×8 square, `#FFB017` (legacy yellow art-piece color),
  1.5px radius, 5px from bottom/right

Wordmark: **`modulariot`** lowercase, weight 600, ink-1 color, tracking -0.01em.

## What used to be here

Run-1 of the ralph loop rescued SVG logos from `apps/web-site/public/` thinking
they were Modular IoT brand. They were actually **Mintral tenant** assets
(Selective Yellow `#FFB017`, Blaze Orange `#C54600` — Mintral's mining-logistics
brand). Those were purged in PA-iter-2 of run-2 once the design system clarified
the platform-vs-tenant split. See `.ralph/PROGRESS.md` PA-iter-2 entry.

This folder is intentionally empty other than this README. Brand visuals are now:
- `BrandMark` — CSS pattern in `features/layout/components/`
- favicon — `apps/web/src/app/favicon.ico` (still the rescued one; will be
  regenerated from the BrandMark in P0-08 / a later polish iter)
