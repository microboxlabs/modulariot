# @microboxlabs/miot-calendar-ui

A reusable, **domain-agnostic** calendar planning UI: a sidebar element list, item
cards/chips, day/week/month grids, the plan flow, an optional assign slot, and the
calendar-rules managers. It renders from a generic `CalendarItem` plus a single
injected **host contract** — it knows nothing about your domain (no "service",
"truck", or "booking-of-X"), so you can drop it into any project by mapping your
domain object to `CalendarItem` and wiring a few actions.

Transport is handled by the sibling [`@microboxlabs/miot-calendar-client`](https://github.com/microboxlabs/modulariot/tree/trunk/packages/miot-calendar-client)
(framework-agnostic REST over `fetch`); this package is the React UI on top of it.

---

## Install

```bash
npm install @microboxlabs/miot-calendar-ui
# or: pnpm add @microboxlabs/miot-calendar-ui  ·  yarn add @microboxlabs/miot-calendar-ui
```

`@microboxlabs/miot-calendar-client` is a **dependency** of this package, so it
installs automatically — you don't add or import it directly. The consumer-facing
client types (`ClientConfig`, `BookingRequest`/`BookingResponse`/`BookingUpdateRequest`/
`BookingListResponse`, `MoveBookingRequest`) are re-exported from
`@microboxlabs/miot-calendar-ui`, so everything comes from this one package.

### Peer dependencies

You provide these in the host app (the package does not bundle them):

| Peer | Version |
|------|---------|
| `react` | `^19` |
| `react-dom` | `^19` |
| `next` | `>=15` |
| `tailwindcss` | `^4` (v4 — the `@import "tailwindcss"` / `@source` model) |
| `flowbite-react` | `^0.12` |

The whole package is a **React Client Component** boundary (it ships a
`"use client"` banner). Import it from inside your client tree; React Server
Components may still import its **types** freely.

---

## Styling setup (required for the look-and-feel)

The calendar renders Tailwind v4 + flowbite-react classes — including the
`TIME_WINDOW_COLORS` shift tints (emerald/blue/violet/rose/amber/cyan/lime/orange
`50`·`100` + their `dark:` variants) and a flowbite `primary` palette. Those class
literals live **inside this package**, outside your app's default content roots, so
your Tailwind build won't generate them unless it scans the package. Tailwind/CSS
cannot be bundled into the JS — the consumer's build must produce these utilities.

In your Tailwind entry (e.g. `globals.css`):

```css
@import "tailwindcss";
@import "flowbite-react/plugin/tailwindcss";
/* Generates every calendar class by scanning this package's built dist. */
@import "@microboxlabs/miot-calendar-ui/styles.css";
```

`styles.css` is a one-line convenience entry that does `@source "./dist"` relative
to itself, so Tailwind scans `node_modules/@microboxlabs/miot-calendar-ui/dist`
(which inlines every class literal) — no path juggling on your side.

The `primary-*` palette comes from `@import "flowbite-react/plugin/tailwindcss"`
(flowbite's default `primary`). To rebrand, override `primary` in your Tailwind
config; nothing else needs to change.

### flowbite theme

The calendar's buttons expect your brand accent on the default button color. Wrap
it in flowbite's `ThemeProvider` with the shipped theme:

```tsx
import { ThemeProvider } from "flowbite-react";
import { miotCalendarTheme } from "@microboxlabs/miot-calendar-ui";

<ThemeProvider theme={miotCalendarTheme}>
  {/* calendar */}
</ThemeProvider>;
```

`miotCalendarTheme` is intentionally minimal (just the primary-button accent). It
composes with any theme you already use.

---

## Map your domain object → `CalendarItem`

`CalendarItem` is the canonical, domain-agnostic descriptor the package renders.
Map your own object to it via `host.toItem`; the opaque `raw` field carries your
original object back to any render overrides.

```ts
import type { CalendarItem } from "@microboxlabs/miot-calendar-ui";

interface Appointment {
  id: string;
  patientName: string;
  clinic: string;
  durationMin: number;
}

const toItem = (raw: Appointment): CalendarItem => ({
  id: raw.id,
  title: raw.patientName,
  subtitle: raw.clinic,
  badges: [{ label: `${raw.durationMin} min`, tone: "blue" }],
  raw, // opaque — handed back to renderItemCard/renderItemChip
});
```

The package ships default `ItemCard`/`ItemChip` that render from these fields
(title/subtitle/badges/metrics/occupancy). Provide `renderItemCard` /
`renderItemChip` only when you need full control of the card/chip markup.

---

## Wire the `CalendarHost`

Everything domain-specific flows through one object. The package stays generic.

```tsx
import type { CalendarHost } from "@microboxlabs/miot-calendar-ui";

const host: CalendarHost<Appointment> = {
  // ── data source ─────────────────────────────────────────────
  client: { baseUrl: "/api/calendar" }, // miot-calendar-client config; see auth note
  calendarId: "<calendar-id>",
  toItem,

  // ── optional overrides ──────────────────────────────────────
  bookingApi: undefined,   // omit → package builds CRUD from `client`; override to proxy
  getLiveTask: undefined,  // optional workflow-task resolver, keyed by a business code
  renderItemCard: (item) => <MyCard appt={item.raw as Appointment} />,
  renderItemChip: undefined, // omit → default chip
  assignPanel: undefined,    // optional => the assign flow is opt-in

  // ── domain side-effects (workflow / notifications stay host-side) ──
  hooks: {
    // Return false to skip the package's booking POST (e.g. a backend that
    // writes the row itself); omit for the default persist-everything behavior.
    shouldPersistBooking: undefined,
    afterPlan: async (item, slot, ctx) => {/* sync category, advance workflow… */},
    afterCancel: async (item) => {/* reverse workflow, notify binding… */},
    onUnassign: async (raw) => raw, // clear assignment tuple, return updated raw
  },

  // ── infra (injected) ────────────────────────────────────────
  i18n: { dict: myDict, tr: (path, dict, params) => translate(path, dict, params) },
  notify: (n) => toast[n.type](n.message),
  permissions: { canPlan: true, canAssign: true, canView: true },
};
```

Mount it by wrapping your calendar subtree in the providers (the host carries all
the seams; the data layer is injected as provider props):

```tsx
import {
  PlanningSelectionProvider,
  CalendarProvider,
} from "@microboxlabs/miot-calendar-ui";

<ThemeProvider theme={miotCalendarTheme}>
  <PlanningSelectionProvider host={host} calendarId={host.calendarId} /* + data props */>
    <CalendarProvider host={host} initialView="week">
      {/* sidebar shell + grid views from the package */}
    </CalendarProvider>
  </PlanningSelectionProvider>
</ThemeProvider>;
```

### Contract reference

| Field | Required | Purpose |
|-------|----------|---------|
| `client` | ✓ | `miot-calendar-client` config (`baseUrl`, `headers?`, `fetch?`). |
| `calendarId` | ✓ | Which calendar this instance operates on. |
| `toItem` | ✓ | Map your domain object → `CalendarItem`. |
| `bookingApi` | — | Override booking CRUD (default is built from `client`). |
| `getLiveTask` | — | Resolve a host workflow task for an item (returns `{ taskId, stage }`). |
| `renderItemCard` | — | Override the sidebar card. |
| `renderItemChip` | — | Override the grid chip. |
| `assignPanel` | — | Opt-in assign UI (`ReactNode` or `(ctx) => ReactNode`). |
| `hooks` | — | `shouldPersistBooking` / `afterPlan` / `afterAssign` / `afterMove` / `afterCancel` / `onUnassign` — domain side-effects. |
| `i18n` | ✓ | `{ dict, tr(path, dict, params?) }` translation seam. |
| `notify` | ✓ | `(n: { type, message }) => void` toast seam. |
| `permissions` | ✓ | `{ canPlan, canAssign, canView }`. |

---

## Authentication & `baseUrl`

The package never owns auth — it calls `miot-calendar-client` with whatever
`client` config you pass. Two common setups:

- **Direct** — point `client.baseUrl` straight at the calendar service and pass a
  token via `headers` (or a custom `fetch`):

  ```ts
  client: {
    baseUrl: "https://calendar.example.com",
    headers: { Authorization: `Bearer ${token}` },
  }
  ```

- **Proxy** (recommended for session-cookie / JWT apps) — point `client.baseUrl`
  at **your own backend route** that injects the credential server-side and
  forwards to the calendar service. The host app does exactly this: `baseUrl:
  "/api/calendar"`, with a Next route that attaches the session JWT. You can also
  pass a custom `fetch` to add headers per request. Either way the package's
  request shape is unchanged — your proxy just needs to mirror the
  `miot-calendar-client` REST paths (a transparent passthrough).

When your backend also drives workflow side-effects, override `bookingApi` so its
CRUD calls hit your proxy routes, and use `hooks.*` for the post-booking domain
work (category sync, workflow advance, binding notifications).

---

## License

Apache-2.0
