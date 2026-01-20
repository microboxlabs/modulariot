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

| Issue | Title                                      | Status         | Branch                               |
| ----- | ------------------------------------------ | -------------- | ------------------------------------ |
| #932  | Add Calendar page to sidebar navigation    | ✅ Complete    | `based/932-calendar-sidebar`         |
| #934  | Calendar Planning page layout structure    | ✅ Complete    | `based/934-calendar-planning-layout` |
| #936  | Calendar Planning Header component         | ✅ Complete    | `based/936-planning-header`          |
| #938  | Calendar Week View component (MVP)         | ✅ Complete    | `based/938-calendar-week-view`       |
| #949  | Planning Sidebar - Service Assignment Form | 🔄 In Progress | `based/949-planning-sidebar-form`    |

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

| Component               | Path                                                                   | Purpose                                      |
| ----------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| `PlanningHeader`        | `src/features/calendar/components/planning/planning-header.tsx`        | Main header with title, navigation, controls |
| `planning-header.types` | `src/features/calendar/components/planning/planning-header.types.ts`   | ViewMode type and PlanningHeaderProps        |
| `CalendarNavigation`    | `src/features/calendar/components/planning/calendar-navigation.tsx`    | Today button + Prev/Next navigation          |
| `CalendarViewSwitcher`  | `src/features/calendar/components/planning/calendar-view-switcher.tsx` | Day/Week/Month toggle buttons                |
| Translations            | `src/lang/es.json`, `src/lang/en.json`                                 | Added `layout.calendar` keys                 |

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

| Component                  | Path                                                                    | Purpose                   |
| -------------------------- | ----------------------------------------------------------------------- | ------------------------- |
| `PlanningWeekView`         | `src/features/calendar/components/planning/planning-week-view.tsx`      | Week grid with time slots |
| `planning-week-view.types` | `src/features/calendar/components/planning/planning-week-view.types.ts` | Props and helper types    |

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

| Feature                      | Complexity                                                   | Planned Approach                                        |
| ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| **Cupos management**         | High - per destination, per time window, with temp overrides | Separate modal/panel triggered from header dropdown     |
| **Block hours** (horizontal) | Medium - select time ranges                                  | Header dropdown → modal, OR direct calendar interaction |
| **Block days** (vertical)    | Medium - select dates                                        | Same as above                                           |
| **Approval groups config**   | High - user/group selection                                  | Admin settings, separate from planning view             |

**Rationale**: Keep the header clean for daily navigation. Config features are used less frequently and deserve dedicated UI (modals/panels) to handle their complexity.

---

### Issue #949 - Planning Sidebar (Implementation)

| Component                        | Path                                                                           | Purpose                                               |
| -------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `PlanningLayoutClient`           | `src/features/calendar/components/planning/planning-layout-client.tsx`         | Layout wrapper that provides selection context        |
| `PlanningSelectionProvider`      | `src/features/calendar/components/planning/planning-selection-context.tsx`     | React Context for slot/service selection state        |
| `PlanningSidebarClient`          | `src/features/calendar/components/planning/planning-sidebar-client.tsx`        | Main sidebar - handles selection state, two-phase UI  |
| `PlanningSidebarForm`            | `src/features/calendar/components/planning/planning-sidebar-form.tsx`          | Service details form with KPIs, flags, and info       |
| `ServiceEvent`                   | `src/features/calendar/components/planning/service-event.tsx`                  | Service card component for the services list          |
| `planning-sidebar-form-elements` | `src/features/calendar/components/planning/planning-sidebar-form-elements.tsx` | Reusable form components (FormSection, InfoRow, etc.) |
| Translations                     | `src/lang/es.json`, `src/lang/en.json`                                         | Added `pages.planning.sidebar` keys                   |

---

#### Interaction Flow

```
User clicks calendar slot
    ↓
Sidebar opens with slot context displayed at top
    ↓
Phase 1: Services List
    - Search bar to filter services
    - Scrollable list of ServiceEvent cards (sorted by priority)
    - User clicks a service card
    ↓
Phase 2: Service Details Form
    - Back button to return to list
    - Service details displayed (Flags → KPIs → Information → Notes)
    - "Confirmar" button to assign service to slot
    ↓
User can change the selected slot before confirming (click different calendar cell)
    ↓
Click "Confirmar" → Assignment complete → Sidebar closes
```

---

#### State Management

**Context:** `PlanningSelectionContext`

```typescript
interface PlanningSelectionContextType {
  selectedSlot: SelectedSlot | null;
  selectedService: SelectedService | null;
  selectSlot: (slot: SelectedSlot) => void;
  selectService: (service: SelectedService) => void;
  clearService: () => void;
  closeSidebar: () => void;
  clearSelection: () => void;
  isSidebarOpen: boolean;
}
```

**Key State Types:**

```typescript
export interface SelectedSlot {
  date: Date;
  hour: number;
  minutes: number;
  dayIndex?: number; // For week view
}

export type LeadTimeStatus = "on_time" | "warning" | "delayed";
export type TripType = "Sider" | "Doble Sider" | "Rampla";

export interface SelectedService {
  id: string;
  cliente: string;
  origen: string;
  lugarCarguio: string;
  destino: string;
  tipoViaje: TripType;
  ocupacion: number; // percentage 0-100
  permanencia: string;
  leadTime: {
    deadline: string; // ISO date
    status: LeadTimeStatus;
  };
  eta: string; // ISO datetime
  incidencias: string[]; // e.g. ['urgencia', 'shutdown', 'c5']
  observaciones: string;
  prioridad: number;
}
```

---

#### UI Layout

**Phase 1: Services List**

```
┌─────────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  ← Slot display (gray bg)
│  jueves 15 ene, 08:00               │
├─────────────────────────────────────┤
│  Servicios del día              [X] │  ← Header with close button
├─────────────────────────────────────┤
│  🔍 Buscar servicio...              │  ← Search input
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐│
│  │ [svc-001] Santiago → Valparaíso ││  ← ServiceEvent card
│  │ Acme Corp                       ││
│  │ [URGENTE] [SHUTDOWN]            ││
│  │ 🕐 15 ene  │  Ocup. ████░░ 85%  ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ [svc-002] Concepción → Temuco   ││
│  │ ...                             ││
│  └─────────────────────────────────┘│
│  ...                                │
├─────────────────────────────────────┤
│  Seleccione un servicio para        │  ← Hint text
│  asignar conductor y vehículo       │
└─────────────────────────────────────┘
```

**Phase 2: Service Details Form**

```
┌─────────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  ← Slot display (gray bg)
│  jueves 15 ene, 08:00               │
├─────────────────────────────────────┤
│  [←] Planificar viaje               │  ← Header with back button
├─────────────────────────────────────┤
│                                     │
│  ═══ Flags ═══════════════════════  │
│  🔴 URGENTE    🟠 SHUTDOWN          │
│  ⚠️ 2 Incidencias                   │
│                                     │
│  ═══ KPIs ════════════════════════  │
│  Lead Time   15 ene   🟢 En tiempo  │
│  ETA         16 ene, 14:30          │
│  Ocupación   85%  ████████░░        │
│                                     │
│  ═══ Información ═════════════════  │
│  Cliente       Acme Corp            │
│  Origen        Bodega Central       │
│  Lugar Cargío  Dock 5               │
│  Destino       Terminal Norte       │
│  Tipo Viaje    Sider                │
│  Permanencia   24h                  │
│                                     │
│  ═══ Observaciones ═══════════════  │
│  Presentar documentación antes      │
│  de las 10:00. Contactar a Juan.    │
│                                     │
├─────────────────────────────────────┤
│            [Confirmar]              │  ← Single action button
└─────────────────────────────────────┘
```

---

#### ServiceEvent Card Styling

Each service card displays with a color accent based on status:

| Condition | Gradient Colors               |
| --------- | ----------------------------- |
| Urgent    | `from-red-500 to-orange-500`  |
| Delayed   | `from-red-400 to-red-500`     |
| Warning   | `from-amber-400 to-amber-500` |
| On Time   | `from-blue-400 to-blue-500`   |

**Sorting Priority** (in services list):

1. Urgent services first (`incidencias.includes('urgencia')`)
2. Delayed (`leadTime.status === 'delayed'`)
3. Warning (`leadTime.status === 'warning'`)
4. On time (last)

---

#### Form Components

**File:** `src/features/calendar/components/planning/planning-sidebar-form-elements.tsx`

| Component     | Props                                 | Purpose                        |
| ------------- | ------------------------------------- | ------------------------------ |
| `FormSection` | `title: string, children`             | Section divider with title     |
| `InfoRow`     | `label: string, value: string`        | Label-value pair row           |
| `KpiRow`      | `label, value, status?, statusLabel?` | KPI with optional status badge |
| `ProgressBar` | `value: number, max?: number`         | Horizontal progress bar        |

---

#### Lead Time Status Colors

| Status    | Color                                       | Label       |
| --------- | ------------------------------------------- | ----------- |
| `on_time` | Green (`text-green-600`, `bg-green-100`)    | "En tiempo" |
| `warning` | Yellow (`text-yellow-600`, `bg-yellow-100`) | "Próximo"   |
| `delayed` | Red (`text-red-600`, `bg-red-100`)          | "Atrasado"  |

---

#### Animation & Styling

- Sidebar width: **320px** (`w-80`)
- Animation: `transition-all duration-300 ease-in-out`
- Hidden on small screens: `hidden lg:block`
- Border: `border-l border-gray-200 dark:border-gray-700`
- Selected card: `ring-2 ring-primary-500/50 bg-primary-50`

---

#### Key Differences from Original Spec (#949 Issue)

| Aspect            | Original Spec              | Actual Implementation                         |
| ----------------- | -------------------------- | --------------------------------------------- |
| Service selection | Dropdown with sort options | Searchable list with ServiceEvent cards       |
| Slot display      | Below header               | **Top of sidebar** (above service selector)   |
| Slot modification | Not specified              | User can click different slot before confirm  |
| Action buttons    | Cancel + Asignar           | Single "Confirmar" button                     |
| Navigation        | Not specified              | Back button returns to list, X closes sidebar |

---

#### Incidencias Dictionary

**File:** `src/features/calendar/components/planning/incidencias.types.ts`

```typescript
/** Configuration for incidencia display overrides */
interface IncidenciaConfig {
  label?: string; // Display label (defaults to key)
  color?: string; // Tailwind color class (defaults to gray/lead)
  priority?: number; // Sort priority (lower = first, defaults to 999)
  visibility?: "primary" | "secondary"; // Defaults to 'secondary'
}

/** Dictionary with optional overrides - unlisted incidencias use defaults */
const INCIDENCIA_DICTIONARY: Record<string, IncidenciaConfig> = {
  urgencia: {
    label: "Urgencia",
    color: "purple",
    priority: 1,
    visibility: "primary",
  },
  shutdown: {
    label: "Shutdown",
    priority: 2,
    visibility: "primary",
  },
  // c4, c5, c7, etc. not listed = use defaults (gray, secondary, priority 999)
};
```

**Default behavior** (for incidencias not in dictionary or with missing properties):

- `label`: Use the incidencia key as-is (e.g., `'c5'` → "c5")
- `color`: Gray/lead (neutral)
- `priority`: 999 (lowest)
- `visibility`: `'secondary'` (hidden behind "+N more")

**Visibility tiers:**

- **Primary**: Always visible (urgencia, shutdown)
- **Secondary**: Collapsed behind "+N more" badge; click to expand inline

**Extensibility:** New incidencia types from API automatically render with defaults. Only add to dictionary when special styling or primary visibility is required.

---

### What's Next (Not Implemented Yet)

1. ~~**Week View: Events Display** - Fetch and render services in calendar slots~~ → **Implemented**
2. ~~**Week View: Slot Interaction** - Click slot → open sidebar form~~ → **Implemented in #949**
3. ~~**Day/Month Views** - Alternative calendar views~~ → **Implemented (MVP)**
4. ~~**Sidebar Form** - Service assignment form content~~ → **Implemented in #949**
5. **API Integration** - Replace mock data with real service endpoints
6. ~~**Cupo Management** - Modal/panel for quota configuration~~ → **Implemented (QuotaManager)**
7. **Blocking System** - Hour and day blocking features
8. **API Design** - BFF endpoints + Alfresco contracts
9. **Business Logic** - Quota validation, ETA-based capacity checks

---

### Quota Management System (Time Windows)

#### Components

| Component             | Path                                                                         | Purpose                                            |
| --------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| `QuotaManager`        | `src/features/calendar/components/planning/calendar-rules/quota-manager.tsx` | Main UI for managing time windows with quotas      |
| `PortalDatepicker`    | (internal component)                                                         | Portal-based datepicker for daily-override windows |
| `ColorPickerDropdown` | (internal component)                                                         | Portal-based color selector dropdown               |

---

#### Time Window Types

```typescript
export interface TimeWindow {
  id: string;
  name: string;
  type: "weekly" | "daily-override";
  startHour: number;
  startMinutes: number;
  endHour: number;
  endMinutes: number;
  days: number[]; // 1 = Monday, ..., 7 = Sunday (for weekly type)
  date?: string; // ISO date string (YYYY-MM-DD) for daily-override type
  weeks: number[]; // 1-5 for weeks of month, empty = all weeks
  quota: number;
  color?: TimeWindowColor;
}
```

**Window Types:**

| Type             | Description                                          | Use Case                     |
| ---------------- | ---------------------------------------------------- | ---------------------------- |
| `weekly`         | Applies to multiple days per week                    | Regular scheduling patterns  |
| `daily-override` | Applies to a specific date, overrides weekly windows | Holidays, special exceptions |

---

#### Color System

```typescript
export const TIME_WINDOW_COLORS = {
  emerald: { bg, hover, badge, dot },
  blue: { bg, hover, badge, dot },
  violet: { bg, hover, badge, dot },
  rose: { bg, hover, badge, dot },
  amber: { bg, hover, badge, dot },
  cyan: { bg, hover, badge, dot },
  lime: { bg, hover, badge, dot },
  orange: { bg, hover, badge, dot },
} as const;
```

Each color provides:

- `bg`: Background color for calendar slots
- `hover`: Hover state color
- `badge`: Badge/label styling (background + text)
- `dot`: Solid color dot for indicators

---

#### QuotaManager UI Layout

```
┌─────────────────────────────────────────────────────┐
│  No hay ventanas definidas                          │  ← Empty state
│                                                     │
│  [+ Ventana]                                        │  ← Add button
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  ⚠️ Ventana 1            [-] 3 [+]            [🗑]  │  ← Header: name, quota, delete
├─────────────────────────────────────────────────────┤
│  [Semanal] [Excepción día]              [🟢 Color]  │  ← Type toggle + color picker
├─────────────────────────────────────────────────────┤
│  🕐 [08:00] → [12:00]                               │  ← Time range selectors
├─────────────────────────────────────────────────────┤
│  [✓] [L] [M] [X] [J] [V] [S] [D]                    │  ← Day selector (weekly)
│  OR                                                 │
│  📅 15/01/2026 - lunes                              │  ← Date picker (daily-override)
├─────────────────────────────────────────────────────┤
│  [S1] [S2] [S3] [S4] [S5]                           │  ← Week selector (weekly only)
└─────────────────────────────────────────────────────┘
```

---

#### Features

**Time Window Management:**

- Add/remove time windows
- Editable name (inline input)
- Quota adjustment (+/- buttons or direct input)
- Time range selection (30-min intervals, 00:00 - 23:00)
- Collision detection (warns when weekly windows overlap)

**Weekly Windows:**

- Day-of-week multi-select (L M X J V S D)
- "Select all" toggle button
- Week-of-month multi-select (S1 S2 S3 S4 S5)
- Empty weeks array = all weeks

**Daily-Override (Exception) Windows:**

- Single date picker (Flowbite Datepicker via portal)
- Cannot select past dates (`minDate` restriction)
- Auto-deleted when date passes (useEffect cleanup)
- Overrides weekly windows for that specific date

**Color Picker:**

- Portal-based dropdown (escapes overflow:hidden)
- 8 color presets with Spanish labels
- Color dot indicator on trigger button
- Checkmark on selected color

---

#### Calendar Integration

**Context Extensions:**

```typescript
interface PlanningSelectionContextType {
  // ... existing
  timeWindows: TimeWindow[];
  setTimeWindows: (windows: TimeWindow[]) => void;
  getTimeWindowForSlot: (
    date: Date,
    hour: number,
    minutes: number
  ) => TimeWindow | null;
  getRemainingQuota: (window: TimeWindow, date: Date) => number;
}
```

**Slot Rendering (Week/Day Views):**

| State      | Background Color         | Badge        |
| ---------- | ------------------------ | ------------ |
| Has window | `windowColor.bg`         | Name + quota |
| Quota full | `bg-red-50`              | `0/N` in red |
| Past day   | `bg-gray-100 opacity-50` | Hidden       |
| No window  | Default                  | None         |

**Slot Interaction:**

- Past days: Disabled, grayed out, no interaction
- Quota full: Disabled, red indicator
- Available: Clickable, shows remaining quota

---

#### Format String Output

Time windows can be serialized to a compact format:

```
W1-4 1-5 0900-1700    → Weeks 1-4, Mon-Fri, 9am-5pm
W* 1,3,5 0800-1200    → All weeks, Mon/Wed/Fri, 8am-12pm
D:2026-01-20 0900-1700 → Daily override for Jan 20, 2026
```

---

#### Portal Components

Both `PortalDatepicker` and `ColorPickerDropdown` use `createPortal` to render to `document.body`:

- Escapes parent `overflow-hidden` containers
- Uses `fixed` positioning with calculated coordinates
- Closes on click outside or Escape key
- z-index: `9999` to appear above all content

---

### Recent Development Session - Planned Services & Calendar Views

#### Confirm Service Functionality

**Context:** `PlanningSelectionContext` extended with planned services state

```typescript
interface PlanningSelectionContextType {
  // ... existing properties
  plannedServices: PlannedService[];
  confirmService: () => void;
  getServicesForSlot: (slot: SelectedSlot) => PlannedService[];
  canAddToSlot: (slot: SelectedSlot) => boolean;
}

interface PlannedService {
  service: SelectedService;
  slot: SelectedSlot;
}

const MAX_SERVICES_PER_SLOT = 3;
```

**Features:**

- `confirmService()` - Adds selected service to the selected slot
- `getServicesForSlot()` - Returns all services planned for a specific slot
- `canAddToSlot()` - Checks if slot has room (max 3 services)
- Re-planning support - Same service can be moved to a different slot

---

#### Day View Implementation

| Component | Path                                                         | Purpose                       |
| --------- | ------------------------------------------------------------ | ----------------------------- |
| `DayGrid` | `src/features/calendar/components/planning/day/day-grid.tsx` | Single day grid with services |

**Day grid layout:**

```
+----------------------------------------------------------+
|                    jueves                                 |
|                      15                                   |
|                   enero 2026                              |
+------+---------------------------------------------------+
| 8:00 | [Service 1] [Service 2] [Service 3]              |  ← Horizontal row
| 8:30 |                                                   |
| 9:00 | [Service 4]                                       |
| ...  |                                                   |
+------+---------------------------------------------------+
```

**Features:**

- Horizontal service layout (services side-by-side in row)
- Fixed height rows (`h-8`)
- Slot selection with highlight
- Displays planned services with left border accent
- Reads date from URL (synced with header)

---

#### Month View Implementation

| Component                   | Path                                                                     | Purpose                  |
| --------------------------- | ------------------------------------------------------------------------ | ------------------------ |
| `PlanningMonthView`         | `src/features/calendar/components/planning/planning-month-view.tsx`      | Full month calendar grid |
| `planning-month-view.types` | `src/features/calendar/components/planning/planning-month-view.types.ts` | Props and MonthDay type  |

**Month grid layout:**

```
+------+------+------+------+------+------+------+
| LUN  | MAR  | MIÉ  | JUE  | VIE  | SÁB  | DOM  |
+------+------+------+------+------+------+------+
|  29  |  30  |  31  |   1  |   2  |   3  |   4  |
|      |      |      | ▌Svc |      |      |      |
+------+------+------+------+------+------+------+
|   5  |   6  |   7  |   8  |   9  |  10  |  11  |
|      | ▌Svc | ▌Svc |      |      |      |      |
|      | ▌Svc |      |      |      | +2 más      |
+------+------+------+------+------+------+------+
```

**Features:**

- Full month with preceding/following days (grayed out)
- ISO week start (Monday first)
- Click on day → navigates to day view
- Shows up to 3 services per day
- Overflow indicator: `+N más` (centered pill style)
- Today highlighting (primary color circle)
- Service cards with left border accent

---

#### Service Cards in Calendar

**Styling (all views):**

| Property | Value                                                        |
| -------- | ------------------------------------------------------------ |
| Regular  | `bg-blue-100 text-blue-800 border-l-4 border-blue-600`       |
| Urgencia | `bg-purple-100 text-purple-800 border-l-4 border-purple-600` |
| Layout   | Left-aligned text (`justify-start`), truncated ID            |

**Week View:**

- Vertical stacking (column layout)
- Dynamic row height: `h-12` for 0-1 services, `h-20` for 2+ services
- Max 3 services per slot

**Day View:**

- Horizontal row layout
- Fixed row height (`h-8`)
- Max 3 services per slot

**Month View:**

- Vertical stacking in day cell
- Shows up to 3, then `+N más` pill
- Taller cards with padding (`px-2 py-1`)

---

#### Design Language Updates

**Colors - "No green in our design":**

| State   | Old              | New                                    |
| ------- | ---------------- | -------------------------------------- |
| Healthy | Green indicators | Gray (`text-gray-600`, `HiCheck` icon) |
| Warning | Yellow           | Gray text + `HiExclamation` icon       |
| Delayed | Red              | Yellow (`text-yellow-400`, `HiClock`)  |

**Lead Time Status Icons:**

| Status    | Icon            | Color  |
| --------- | --------------- | ------ |
| `on_time` | `HiCheck`       | Gray   |
| `warning` | `HiExclamation` | Gray   |
| `delayed` | `HiClock`       | Yellow |

**Occupancy Bar:**

- 100%: Yellow (`bg-yellow-300`)
- <100%: Gray (`bg-gray-400`)

---

#### Sidebar UI Refinements

**Component heights reduced:**

| Element         | Before  | After       |
| --------------- | ------- | ----------- |
| ServiceEvent    | `p-3`   | `p-2`       |
| Internal gap    | `2.5`   | `1.5`       |
| Flags gap       | `1.5`   | `1`         |
| KPIs gap        | `3`     | `2`         |
| Header padding  | `p-4`   | `px-4 py-2` |
| Content padding | `p-4`   | `p-3`       |
| Services list   | `gap-2` | `gap-1.5`   |

---

#### Navigation Between Views

**Month → Day navigation:**

- Click any day in month view → URL updates with `?date=YYYY-MM-DD&view=day`
- Uses `router.replace()` with `{ scroll: false }`
- Seamless transition without page reload
