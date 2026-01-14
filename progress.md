## Summary: Trip Planning Module Progress

### Parent Issue

**#931 - Módulo de Planificación de Viajes** (Epic)

- Status: Backlog
- Purpose: Master specification for the Trip Planning module
- Key concepts documented:
  - Dual-level quota system (origin departure + destination arrival via ETA)
  - Workflow: `PL (planService)` → Planning → `assignDriver` task
  - Multi-view calendar (day/week/month)
  - Right sidebar for service assignment form

---

### Child Issues

| Issue | Title                                   | Status      | Branch                               |
| ----- | --------------------------------------- | ----------- | ------------------------------------ |
| #932  | Add Calendar page to sidebar navigation | ✅ Complete | `based/932-calendar-sidebar`         |
| #934  | Calendar Planning page layout structure | ✅ Complete | `based/934-calendar-planning-layout` |
| #936  | Calendar Planning Header component      | ✅ Complete | `based/936-planning-header`          |
| #938  | Calendar Week View component (MVP)      | ✅ Complete | `based/938-calendar-week-view`       |
| #949  | Planning Sidebar - Service Assignment Form | Ready    | `based/949-planning-sidebar-form`    |

---

### Code Implemented

#### Issue #932 - Sidebar Navigation

| Component      | Path                                   | Purpose                                                                                 |
| -------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| `CalendarIcon` | `src/features/icons/calendar.tsx`      | Sidebar icon using `HiOutlineCalendar` from react-icons                                 |
| Sidebar entry  | `src/features/layout/models/pages.ts`  | Multi-level menu between Home and Kanban, restricted to `GROUP_ALFRESCO_ADMINISTRATORS` |
| Translations   | `src/lang/es.json`, `src/lang/en.json` | Added "calendar"/"Calendario" label                                                     |

**Menu structure:**

```
Calendar (HiOutlineCalendar)
  └── Planning → /calendar/planning
```

---

#### Issue #934 - Page Layout Structure

| Component         | Path                                                             | Purpose                                         |
| ----------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| `page.tsx`        | `src/app/[lang]/(secured)/calendar/planning/page.tsx`            | Server component with auth + dictionary loading |
| `Planning`        | `src/features/calendar/components/planning/planning.tsx`         | Feature orchestrator                            |
| `PlanningLayout`  | `src/features/calendar/components/planning/planning-layout.tsx`  | Layout skeleton (header + main area + sidebar)  |
| `PlanningHeader`  | `src/features/calendar/components/planning/planning-header.tsx`  | Header placeholder (enhanced in #936)           |
| `PlanningSidebar` | `src/features/calendar/components/planning/planning-sidebar.tsx` | Right sidebar placeholder (empty for now)       |

**Layout structure:**

```
+--------------------------------------------------+
|  Header (Planificación)                          |
+----------------------------------+---------------+
|                                  |               |
|  Main Area (flex-1)              |  Sidebar      |
|  - Calendar placeholder          |  (w-80)       |
|                                  |               |
+----------------------------------+---------------+
```

---

#### Issue #936 - Planning Header Component

| Component               | Path                                                                      | Purpose                                      |
| ----------------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| `PlanningHeader`        | `src/features/calendar/components/planning/planning-header.tsx`           | Main header with title, navigation, controls |
| `planning-header.types` | `src/features/calendar/components/planning/planning-header.types.ts`      | ViewMode type and PlanningHeaderProps        |
| `CalendarNavigation`    | `src/features/calendar/components/planning/calendar-navigation.tsx`       | Today button + Prev/Next navigation          |
| `CalendarViewSwitcher`  | `src/features/calendar/components/planning/calendar-view-switcher.tsx`    | Day/Week/Month toggle buttons                |
| Translations            | `src/lang/es.json`, `src/lang/en.json`                                    | Added `layout.calendar` keys                 |

**Header layout:**

```
+------------------------------------------------------------------------+
|  Planificación     [Hoy] [<][>]     enero 2026     [Día|Semana|Mes]    |
+------------------------------------------------------------------------+
```

**Features:**
- Date navigation with dayjs (prev/next/today)
- View mode switcher (day/week/month)
- Date display formats per view mode
- i18n support via `lang` prop chain
- Isolated reusable components (CalendarNavigation, CalendarViewSwitcher)
- Alternative button style with gray background for active/disabled state
- **URL state persistence** - date and view mode synced to URL query params (`?date=2026-01-09&view=week`)
  - Uses Next.js `useSearchParams`, `useRouter`, `usePathname`
  - State derived from URL via `useMemo` (no local useState)
  - `router.replace()` with `{ scroll: false }` for seamless updates
  - Validation helpers: `isValidViewMode()`, `parseUrlDate()` with graceful fallbacks
  - Enables: shareable links, refresh recovery, browser back/forward navigation

---

#### Issue #938 - Calendar Week View (MVP)

| Component                    | Path                                                                       | Purpose                              |
| ---------------------------- | -------------------------------------------------------------------------- | ------------------------------------ |
| `PlanningWeekView`           | `src/features/calendar/components/planning/planning-week-view.tsx`         | Week grid with time slots            |
| `planning-week-view.types`   | `src/features/calendar/components/planning/planning-week-view.types.ts`    | Props and helper types               |

**Week grid layout:**

```
+------+--------+--------+--------+--------+--------+--------+--------+
|      |  LUN   |  MAR   |  MIÉ   |  JUE   |  VIE   |  SÁB   |  DOM   |
|      |   6    |   7    |   8    |   9    |   10   |   11   |   12   |
+------+--------+--------+--------+--------+--------+--------+--------+
| 8:00 |        |        |        |        |        |        |        |
| 8:30 |        |        |        |        |        |        |        |
| ...  |        |        |        |        |        |        |        |
|21:30 |        |        |        |        |        |        |        |
+------+--------+--------+--------+--------+--------+--------+--------+
```

**Features:**
- Mon-Sun work week (7 days)
- 30-minute time slot intervals (8:00 - 22:00)
- Reads `?date=` from URL (synced with header navigation)
- ISO week calculation (`startOf("isoWeek")`) - Monday always first
- Today highlighting (day number in colored circle)
- Sticky header row
- Hover effect on cells
- Dark mode support
- Responsive with min-width scroll
- Localized day names (es/en)

**Scope (MVP):** Visual grid only - no events, no click interactions, no cupos

---

### Design Decisions

#### Admin/Config Actions Placement

The header contains **navigation controls** (date nav, view switcher) - things used constantly while planning.

**Admin features** (cupos, blocking) are separated into future issues:

| Feature | Complexity | Planned Approach |
|---------|------------|------------------|
| **Cupos management** | High - per destination, per time window, with temp overrides | Separate modal/panel triggered from header dropdown |
| **Block hours** (horizontal) | Medium - select time ranges | Header dropdown → modal, OR direct calendar interaction |
| **Block days** (vertical) | Medium - select dates | Same as above |
| **Approval groups config** | High - user/group selection | Admin settings, separate from planning view |

**Rationale**: Keep the header clean for daily navigation. Config features are used less frequently and deserve dedicated UI (modals/panels) to handle their complexity.

---

### Issue #949 - Planning Sidebar (Specification)

| Component | Path | Purpose |
| --------- | ---- | ------- |
| `PlanningSidebar` | `src/features/calendar/components/planning/planning-sidebar.tsx` | Client component with service assignment form |
| `planning-sidebar.types` | `src/features/calendar/components/planning/planning-sidebar.types.ts` | TypeScript interfaces |
| `ServiceSelector` | `src/features/calendar/components/planning/service-selector.tsx` | Dropdown with sorting options |
| `ServiceDetails` | `src/features/calendar/components/planning/service-details.tsx` | Service details display |
| Mock data | `src/features/calendar/mocks/services.mock.ts` | Mock services for development |

**Interaction flow:**

```
Click calendar slot → Sidebar activates → Select service from dropdown → View details → Assign
```

**Service filter criteria:**
- State = `PL` (planService task)
- Has associated cargo (`carga asociada`)

**Selector sorting options:** Prioridad, Urgencia, Shutdown, Ocupación, Lead Time

**Display fields (priority order):**

| Priority | Section | Fields |
|----------|---------|--------|
| 1️⃣ | Flags | Urgencia (badge), Shutdown (badge), Incidencias (count) |
| 2️⃣ | KPIs | Lead Time (date + status color), ETA, Ocupación (%) |
| 3️⃣ | Static | Cliente, Origen, Lugar Cargío, Destino, Tipo Viaje, Permanencia |
| 4️⃣ | Notes | Observaciones |

**Key field clarifications:**
- **Lugar de Cargío** = Loading dock within the warehouse (driver instruction: where to present)
- **Andén** = Platform/checkout (capacity quota - separate from Lugar de Cargío)
- **Lead Time** = Deadline date + status (`on_time` 🟢 / `warning` 🟡 / `delayed` 🔴) - API provides status
- **Shutdown** = Boolean flag (for now)

**Mock data contract:**

```typescript
interface Service {
  id: string;
  cliente: string;
  origen: string;
  lugarCarguio: string;
  destino: string;
  tipoViaje: 'Sider' | 'Doble Sider' | 'Rampla';
  ocupacion: number;  // percentage 0-100
  permanencia: string;
  leadTime: {
    deadline: string;  // ISO date
    status: 'on_time' | 'warning' | 'delayed';
  };
  eta: string;  // ISO datetime
  urgencia: boolean;
  shutdown: boolean;
  incidencias: number;
  observaciones: string;
  prioridad: number;
}
```

---

### What's Next (Not Implemented Yet)

1. **Week View: Events Display** - Fetch and render services in calendar slots
2. **Week View: Slot Interaction** - Click slot → open sidebar form
3. **Day/Month Views** - Alternative calendar views
4. ~~**Sidebar Form** - Service assignment form content~~ → **#949 created**
5. **Cupo Management** - Modal/panel for quota configuration
6. **Blocking System** - Hour and day blocking features
7. **API Design** - BFF endpoints + Alfresco contracts
8. **Business Logic** - Quota validation, ETA-based capacity checks
