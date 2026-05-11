# Drop the Modular IoT Landing design here

The ralph alignment-run picks up whatever's in this folder. Any of these works:

## Option A — single HTML export (best)
`Modular IoT Landing.html` (whatever the design tool exports as) plus any
referenced `.css` / `.js` / `.svg` / image assets. I'll parse it directly.

## Option B — screenshots
Section-by-section PNG/JPG screenshots, ideally at desktop (1280px) and mobile
(375px) widths. Name them like `01-hero-desktop.png`, `02-symptoms-desktop.png`,
etc. so I can map them to the existing sections.

## Option C — both
Even better — HTML for ground-truth comparison plus screenshots for visual
sanity-check.

Once anything is here, run `/loop` again and the alignment ralph picks up
PA-00 (diff) → generates PA-01..PA-12 (adjustments) → executes.
