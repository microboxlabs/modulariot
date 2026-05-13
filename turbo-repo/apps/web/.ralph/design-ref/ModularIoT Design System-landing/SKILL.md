---
name: Mintral Design System
description: Design system for Mintral — "Logística Minera", a mining-logistics control-tower web app built by MicroBoxLabs. Covers the brand (yellow + slate wordmark), Flowbite-blue product UI, Spanish/English dispatcher copy voice, and the 8-column shipping kanban workflow (driver validation → mission control → Sovos signature → monitoring → delivery → finalized). Invoke when designing anything in the Mintral product surface (kanban, trip cards, sidebar, drawer, login), the MicroBoxLabs marketing site, or any operator UI that shares this vocabulary (torre de control, faena, overlord, código negro).
---

# Mintral Design System — Quick reference

## Where things live
- `README.md` — full context, content voice, visual foundations, iconography.
- `colors_and_type.css` — tokens. Import first: `<link rel="stylesheet" href="/colors_and_type.css">`.
- `assets/logo-mintral.png` — primary wordmark (yellow M + slate MINTRAL).
- `assets/logo-mintral-dark.png` — inverse for dark surfaces.
- `assets/icons/conditions/*.svg` — mining-state glyphs (código-negro, alerta-crítica, estable, en-observación, etc).
- `assets/icons/pin/{blue,red,yellow}.svg` — map cluster pins.
- `assets/icons/totem/*.svg` — kiosk check-in (QR, fingerprint, ID card).
- `ui_kits/mintral-app/` — working hi-fi recreation you can lift components from.

## Commit to these tokens
- **Primary CTA**: `--blue-600 #1C64F2` (hover `#1A56DB`). One blue.
- **Ink**: `--fg-1 #111928`. **Body default**: 14 px Inter 400 (dense operator UI — not 16 px).
- **Brand yellow** `#FFB017`: logo mark and occasional warning. Never a button background except the "Requiere Overlord" solid badge.
- **Radius**: 8 px on buttons / inputs / cards. Pill on badges and avatars.
- **Card**: white + 1 px `--border-subtle` border + **no shadow by default**. Shadow only on hover / floating chrome.
- **Kanban columns**: 280 px wide, `--bg-sunken` background, 12 px padding.

## Voice — copy faithfully
- **Spanish first**, English is a 1:1 translation. Sentence case on screen titles AND on status badges ("Aprobada", "Pendiente", "En curso" — never ALL CAPS).
- Third-person status reports ("Trip started", "Viaje iniciado") + terse second-person imperatives ("Confirm delivery", "Return to Overlord").
- Specialised vocabulary stays in Spanish even in the English UI: *faena* (mine site), *torre de control*, *overlord*, *código negro*, *conductor*, *viaje*, *sovos*.
- No emoji. No exclamation marks. No "oops" / "let's" / "just".
- Counts read `"{count} visibles"` / `"{count} visible"`.

## The kanban flow (shipping)
`Driver/Transport Validation → Mission Control: Start Trip → SOVOS Digital Signature → Monitoring In Course → Confirm Destination Arrival → Confirm Delivery → Confirm Departure → Monitoring Finalized`

Every card shows: trip code (`VJ-24-8710`, monospace 11 px) + status pill (top row), route title (14 px semibold), driver + truck icon (12 px), ETA/weight meta + driver avatar (11 px). Use the rose-pulse (`animate-shadow-toggle`) only for alerts that need operator action — nothing else pulses.

## Iconography rule
1. UI icons → **Flowbite Outline**, 20 px, stroke 2. Use `https://flowbite.com/icons/` or lift from the `Icon` object in `ui_kits/mintral-app/atoms.jsx`.
2. Domain semantics (driver states, pins, kiosk) → `assets/icons/{conditions,pin,totem}/*.svg` — bespoke.
3. Animated kiosk feedback → GIFs in `assets/icons/totem/*.gif` (not re-exported here; copy from source on demand).
4. **No emoji, ever.** No Unicode glyph substitution. If nothing exists, leave a 20 × 20 dashed placeholder and flag to user.

## Light / dark
Dark mode is first class. `[data-theme="dark"]` selector in `colors_and_type.css` flips the neutral ramp. The login / onboarding surfaces have explicit dark treatments in Figma; the main app runs light by default.

## Font substitution
Inter + DM Sans are loaded from Google Fonts. **Havelock Titling Black** (marketing hero only) is proprietary — currently substituted with Oswald 700. Flag to user if the hero visual matters.
