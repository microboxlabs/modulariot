# Brand assets — provenance and usage

All assets here were rescued from `apps/web-site/public/` (the legacy marketing site)
during ralph iter-2 (P0-02). Treat this directory as the canonical brand source for
`apps/web`. Do not reach into `apps/web-site` from app code.

## Inventory

| file                              | role                                                  | notes                                                                                                                     |
|-----------------------------------|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| `logo.svg`                        | Primary mark (square, full color)                     | 38 KB — usable in hero, OG image base, social profile.                                                                    |
| `headlogo.svg`                    | Header / nav lockup (light theme)                     | 9 KB. **WARNING**: byte-identical to `headlogo-dark.svg` in source. A real dark variant must be produced in Phase 1.      |
| `headlogo-dark.svg`               | Header / nav lockup (dark theme)                      | Currently a duplicate of the light variant. Do not ship as-is. Tracked as a discovered task in BACKLOG.                   |
| `hero-pipeline.svg`               | Hero visual — telemetry pipeline illustration         | Intended for the P1-03 hero. Verify it composes with the brand palette before shipping.                                   |
| `architecture.svg`                | Architecture diagram (Capture → Stream → ... → Audit) | Intended for P2-03 architecture section. Likely needs restyling to match brand tokens.                                    |
| `pattern-light.svg`               | Decorative background pattern (light theme)           | Optional; useful for section backgrounds.                                                                                 |
| `pattern-dark.svg`                | Decorative background pattern (dark theme)            | Optional; useful for section backgrounds.                                                                                 |
| `showcase/dashboard-map.svg`      | Dashboard mock — fleet map preview (P3-03)            | **Was mislabeled as `.png` in source — actually inline SVG.** Renamed during rescue. Color palette is generic slate;       |
|                                   |                                                       | restyle to brand (blue/yellow/orange/gray) when used in the showcase.                                                     |
| `showcase/symptom-timeline.svg`   | Dashboard mock — symptom timeline preview (P3-03)     | Same caveat as above.                                                                                                     |

## What was deliberately NOT rescued

- `apps/web-site/public/mintral-logo.svg` — client-specific (Mintral fleet), not Modular IoT brand.
- `apps/web-site/public/figma.svg`, `flowbite.svg`, `flowbite-react.svg`, `vercel.svg` — third-party badges, irrelevant for the new site.

## Missing pieces (open work)

- **Favicon set** — no `favicon.ico` / `apple-touch-icon.png` / `icon.png` was found in `apps/web-site`. Needs to be generated from `logo.svg` during Phase 1. Tracked as discovered task in BACKLOG.
- **Real dark-variant header logo** — see warning above.
- **OG / social card image** — none found. Generate in Phase 1 or Phase 5 polish.
