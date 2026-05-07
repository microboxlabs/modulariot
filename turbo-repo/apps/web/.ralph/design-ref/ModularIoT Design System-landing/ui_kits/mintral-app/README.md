# Mintral App — UI Kit

A hi-fi recreation of the **Mintral** operator web app (mining-logistics
control tower, Next.js + Flowbite in production). This kit is a pixel-lookalike
— component internals are simplified, but the visuals mirror the codebase
(`app/src/features/...`) and the Figma (`/Kanban-viajes`, `/Log-in-Recuperar-clave`,
`/UI-Components`).

## Files
- `index.html` — app-shell click-thru: sidebar → kanban view. Sidebar links
  are wired; clicking a kanban card opens the side drawer.
- `login.html` — bilingual login screen (email + SSO + external user).
- `App.jsx` — composes the secured layout and routes between views.
- `Sidebar.jsx` — fixed left sidebar with collapse; nav from real `pages.ts`.
- `Topbar.jsx` — breadcrumb + counter + user menu.
- `KanbanBoard.jsx` — horizontal scrolling columns for the shipping flow.
- `TripCard.jsx` — the core kanban trip card with status, meta, alert pulse.
- `Drawer.jsx` — right-side details drawer opened on card click.
- `atoms.jsx` — Button, Badge, Input, Avatar, IconButton primitives.

## What this kit faithfully recreates
- The 8-column kanban swim lanes (Transport Validation → Mission Control → …
  → Monitoring Finalized) from `en.json / pages/shipping/kanban`.
- Trip-card density: trip number, route, driver, ETA, status pill, avatar.
- Sidebar nav (Home, Calendar, Kanban, Tasks, Control Tower, Live Streams,
  Collaborators, Fleet, Where-Is-My-Load) from `features/layout/models/pages.ts`.
- Login form styled to the Figma (`/Log-in-Recuperar-clave/Login`).

## What it intentionally skips
- Auth plumbing, role gating (`requiredGroups` / `blockedGroups`), i18n,
  real map tiles, Sovos digital-signature, live GPS.
- All data is static/mocked.
