# Dashboard Widget System

> **Status**: ✅ Implemented (Widget Architecture with react-grid-layout)  
> **Location**: `/home` page (`src/app/[lang]/(secured)/home/page.tsx`)  
> **Feature Path**: `src/features/dashboard/`

## Overview

The Dashboard system is a customizable widget-based layout that allows users to create nested dashboard structures. Widgets can be **containers** (bento boxes), **labeled containers** (grouped sections with labels), or **dashlets** (data display components). Users can visualize their data in various formats and arrange them according to their preferences.

### Key Principles

- **Unified widget model**: Everything is a `Widget` with a `componentId` referencing the dashlet registry
- **Recursive nesting**: Labeled containers can nest inside containers and other labeled containers
- **Nesting rules**: Containers (bento boxes) cannot nest inside other containers
- **Dashlet registry**: Self-contained components with metadata, component, and optional settings modal
- **Persistent settings**: Widget configurations stored in localStorage
- **Edit mode toggle**: Settings gear icon, delete buttons, and resize handles only appear in edit mode
- **Centralized widget defaults**: All widget size constraints defined in one file

---

## Data Structures

### Widget (Unified Model)

```typescript
interface Widget {
  id: string; // UUID
  componentId: string; // References dashlet registry (e.g., 'container', 'card')
  layout: GridLayoutItem; // Position and size in parent grid
  config: Record<string, unknown>; // Dashlet-specific settings (persisted)
  children?: Widget[]; // Nested widgets (for container types)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

interface GridLayoutItem {
  i: string; // Widget ID (matches widget.id)
  x: number; // Column position (0-based)
  y: number; // Row position (0-based)
  w: number; // Width in grid units
  h: number; // Height in grid units
  minW?: number; // Minimum width in grid units
  minH?: number; // Minimum height in grid units
  maxW?: number; // Maximum width in grid units
  maxH?: number; // Maximum height in grid units
}
```

### Dashlet Metadata

```typescript
interface DashletMeta {
  id: string; // Unique dashlet identifier (e.g., 'container', 'card')
  name: string; // Display name (e.g., 'Bento Box')
  description: string; // Short description for selector
  icon: React.ComponentType; // Icon component for selector
  category: DashletCategory; // For grouping in selector
  canNestIn: string[]; // [] = root only, ['container'] = can nest in container
  hasSettings: boolean; // Whether dashlet has settings modal
}

type DashletCategory = "containers" | "data-display";
```

### Dashlet Definition

```typescript
interface DashletDefinition {
  meta: DashletMeta;
  Component: React.ComponentType<DashletComponentProps>;
  SettingsModal?: React.ComponentType<DashletSettingsProps>;
}

interface DashletComponentProps {
  widget: Widget;
  editMode: boolean;
  onAddChild?: (componentId: string) => void; // For container types
}

interface DashletSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  config: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
}
```

### Storage Schema

```typescript
interface DashboardStorageSchema {
  version: 2; // Bumped from 1 for migration
  widgets: Widget[]; // Root-level widgets (recursive tree)
  preferences: {
    editMode: boolean;
  };
}
```

**localStorage key**: `dashboard-config` (migrates from `chartset-config`)

---

## Dashlet Registry

### Structure

```
src/features/dashboard/dashlets/
├── index.ts                    # Registry map, getDashlet(), getAllDashlets()
├── types.ts                    # DashletMeta, DashletDefinition, DashletComponentProps
├── container/
│   ├── container.tsx           # Bento box with GridLayout
│   ├── container.meta.ts       # Metadata
│   └── index.ts
├── labeled-container/
│   ├── labeled-container.tsx   # Bordered group with legend-style label
│   ├── labeled-container.settings.tsx
│   ├── labeled-container.meta.ts
│   └── index.ts
└── card/
    ├── card.tsx                # Icon + label + number display
    ├── card.settings.tsx       # Name, number, bg color
    ├── card.meta.ts
    └── index.ts
```

### Registry API

```typescript
// Get a specific dashlet definition
function getDashlet(componentId: string): DashletDefinition | undefined;

// Get all dashlets (for selector)
function getAllDashlets(): DashletDefinition[];

// Get dashlets by category
function getDashletsByCategory(category: DashletCategory): DashletDefinition[];

// Get dashlets that can nest in a specific parent
function getValidDashletsForParent(
  parentComponentId: string | null
): DashletDefinition[];
```

---

## Dashlet Specifications

### Container (Bento Box)

| Property        | Value                                |
| --------------- | ------------------------------------ |
| **ID**          | `'container'`                        |
| **Name**        | "Bento Box"                          |
| **Description** | "A draggable grid container"         |
| **Category**    | `'containers'`                       |
| **canNestIn**   | `[]` (root level only)               |
| **hasSettings** | `false`                              |
| **Children**    | Yes - renders nested widgets in grid |

**Behavior**:

- Uses `react-grid-layout` for child arrangement
- Children can be labeled-containers or dashlets (NOT other containers)
- Has inline-editable name and description in header
- Shows "+ Add widget" button when in edit mode

### Labeled Container

| Property        | Value                                |
| --------------- | ------------------------------------ |
| **ID**          | `'labeled-container'`                |
| **Name**        | "Labeled Group"                      |
| **Description** | "Group widgets with a label"         |
| **Category**    | `'containers'`                       |
| **canNestIn**   | `['container', 'labeled-container']` |
| **hasSettings** | `true` (label text)                  |
| **Children**    | Yes - renders nested widgets         |

**Config Schema**:

```typescript
interface LabeledContainerConfig {
  label: string; // Default: "Group"
}
```

**Visual Style** (Tailwind):

- Rounded border: `rounded-lg border border-gray-200`
- Label cuts into border (fieldset-legend style):
  - `absolute -top-3 left-3 bg-white px-2 text-sm text-gray-500`
- Container padding: `p-4 pt-5 mt-2`
- Relative positioning: `relative`

### Card

| Property        | Value                                |
| --------------- | ------------------------------------ |
| **ID**          | `'card'`                             |
| **Name**        | "Data Card"                          |
| **Description** | "Display a key metric"               |
| **Category**    | `'data-display'`                     |
| **canNestIn**   | `['container', 'labeled-container']` |
| **hasSettings** | `true` (name, number, color)         |
| **Children**    | No                                   |

**Config Schema**:

```typescript
interface CardConfig {
  name: string; // Label text, default: "Metric"
  value: string; // Display value, default: "0"
  backgroundColor: CardBackgroundColor; // Default: 'white'
}

type CardBackgroundColor =
  | "white"
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple";
```

**Visual Style**:

- Shows icon (configurable in future), label, and large number
- Background color from dropdown selection
- Rounded corners, subtle shadow

---

## Grid Configuration

### Root Level Grid (dashboard-view)

| Property              | Value          | Notes                                  |
| --------------------- | -------------- | -------------------------------------- |
| **Columns**           | 12             | Consistent across all grid levels      |
| **Row height**        | 80px           | Root level row height                  |
| **Margin**            | [16, 16]       | Gap between widgets                    |
| **Draggable**         | Edit mode only | Controlled by edit mode toggle         |
| **Resizable**         | Edit mode only | Width: minW-12 cols                    |
| **Resize handles**    | `e`, `s`, `se` | Right edge, bottom edge, corner        |
| **Compact type**      | `'vertical'`   | Widgets stack vertically when possible |
| **Prevent collision** | `false`        | Widgets reflow on collision            |

### Nested Grids (container & labeled-container)

| Property       | Value          | Notes                              |
| -------------- | -------------- | ---------------------------------- |
| **Columns**    | 12             | Same as root for consistent sizing |
| **Row height** | 40px           | Smaller for nested content         |
| **Margin**     | [8, 8]         | Tighter spacing inside containers  |
| **Draggable**  | Edit mode only | Uses `.no-drag` cancel selector    |
| **Resizable**  | Edit mode only | Width: minW-12 cols                |

### Widget Default Sizes

Centralized in `src/features/dashboard/utils/widget-defaults.ts`:

```typescript
const WIDGET_DEFAULTS: Record<string, WidgetSizeDefaults> = {
  "labeled-container": { minW: 4, minH: 2 },
  card: { minW: 2, minH: 4 },
  container: { minW: 4, minH: 4 },
};
```

- `minW`/`minH` are used as both minimum constraints AND initial size
- Change sizes in one place, applies everywhere
- Individual widgets can override via `widget.layout.minW`/`minH`

---

## UI Components

### Component Tree

```
DashboardProvider (context)
└── DashboardView
    ├── Header (title + edit mode toggle)
    ├── EmptyState (shown when no widgets)
    └── GridLayout (root level, 12 cols, 80px row height)
        └── WidgetRenderer (recursive)
            ├── widget-wrapper div (for CSS hover detection)
            ├── widget-controls (settings gear, delete - hover visible)
            ├── Renders dashlet Component based on componentId
            └── For containers: nested GridLayout + AddWidgetButton

AddWidgetModal (portal)
├── ModalHeader with close button
├── Search input
├── Scrollable categorized list
│   ├── "Containers" category
│   │   ├── Bento Box
│   │   └── Labeled Group
│   └── "Data Display" category
│       └── Data Card
└── Filters by canNestIn based on parent

ConfirmModal (reusable, portal)
└── Used for delete confirmations

DashletSettingsModal (per dashlet)
└── Rendered via portal when gear icon clicked
```

### Component Selector Modal

**Layout**:

```
┌─────────────────────────────────────────────────┐
│  🔍 Search components...                    [X] │
├─────────────────────────────────────────────────┤
│                                                 │
│  CONTAINERS                                     │
│  ┌───────────┐ ┌───────────┐                   │
│  │ 📦        │ │ 🏷️        │                   │
│  │ Bento Box │ │ Labeled   │                   │
│  │           │ │ Group     │                   │
│  └───────────┘ └───────────┘                   │
│                                                 │
│  DATA DISPLAY                                   │
│  ┌───────────┐                                 │
│  │ 📊        │                                 │
│  │ Data Card │                                 │
│  │           │                                 │
│  └───────────┘                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Behavior**:

- Search input filters dashlets by name/description
- Categories hidden when no matching dashlets
- Invalid dashlets hidden based on `canNestIn` rules
- Clicking dashlet adds it to parent and closes modal

---

## Interactions

### Adding a Widget

1. User clicks "+" button (root level or inside container)
2. `AddWidgetModal` opens with `parentId` context
3. Modal shows only valid dashlets based on parent's nesting rules
4. User searches or scrolls to find desired dashlet
5. User clicks dashlet option
6. Widget created with default config, added to parent
7. Modal closes

### Opening Settings

1. User enables edit mode
2. Gear icon (⚙️) appears on widgets with `hasSettings: true`
3. User clicks gear icon
4. Dashlet's `SettingsModal` opens via portal
5. User modifies config values
6. User clicks "Save" → config persisted to localStorage
7. Modal closes, widget re-renders with new config

### Nesting Rules

| Parent              | Can Contain                             |
| ------------------- | --------------------------------------- |
| Root (no parent)    | `container` only                        |
| `container`         | `labeled-container`, `card`, (dashlets) |
| `labeled-container` | `labeled-container`, `card`, (dashlets) |

**Enforced by**:

- `getValidDashletsForParent()` filters selector options
- `addWidget()` validates before adding

### Deleting

- Widget delete button (edit mode) → Confirm modal → Widget + all children removed
- Uses same `ConfirmModal` component as before
- Recursive deletion for containers with children

---

## File Structure

```
src/features/dashboard/
├── components/
│   ├── dashboard-view/
│   │   └── dashboard-view.tsx      # Main dashboard with root GridLayout
│   ├── widget-renderer/
│   │   ├── widget-renderer.tsx     # Recursive widget rendering with hover controls
│   │   └── index.ts
│   ├── add-widget-modal/
│   │   ├── add-widget-modal.tsx    # Component selector modal with header
│   │   └── index.ts
│   ├── confirm-modal/
│   │   ├── confirm-modal.tsx       # Reusable confirmation modal
│   │   └── index.ts
│   ├── delete-widget-modal/
│   │   ├── delete-widget-modal.tsx
│   │   └── index.ts
│   └── empty-state/
│       └── empty-state.tsx
├── dashlets/
│   ├── index.ts                    # Registry
│   ├── types.ts                    # Dashlet type definitions
│   ├── container/
│   │   ├── container.tsx           # Bento box with nested GridLayout
│   │   ├── container.meta.ts
│   │   └── index.ts
│   ├── labeled-container/
│   │   ├── labeled-container.tsx   # Group with nested GridLayout
│   │   ├── labeled-container.settings.tsx
│   │   ├── labeled-container.meta.ts
│   │   └── index.ts
│   └── card/
│       ├── card.tsx
│       ├── card.settings.tsx
│       ├── card.meta.ts
│       └── index.ts
├── context/
│   └── dashboard-context.tsx       # State management with updateWidgetConstraints
├── hooks/
│   └── use-dashboard-storage.ts    # localStorage with migration
├── types/
│   └── dashboard.types.ts          # Widget, GridLayoutItem with min/max
├── utils/
│   └── widget-defaults.ts          # Centralized widget size defaults
└── index.ts (barrel export)
```

---

## Implementation Order

### Phase 1: Rename & Restructure

1. [x] Rename `src/features/chartset/` → `src/features/dashboard/`
2. [x] Rename all files: `chartset-*` → `dashboard-*` or new names
3. [x] Update all imports in home page
4. [x] Update CSS classes: `.chartset-grid` → `.dashboard-grid`
5. [x] Update localStorage key: `chartset-config` → `dashboard-config`

### Phase 2: New Type System

6. [x] Create `dashboard.types.ts` with unified `Widget` interface
7. [x] Create `dashlets/types.ts` with `DashletMeta`, `DashletDefinition`
8. [x] Remove old `Chartset`, `ChartWidget`, `ChartType` types

### Phase 3: Dashlet Registry

9. [x] Create `dashlets/index.ts` with registry functions
10. [x] Create `container/` dashlet (migrate from chartset-card)
11. [x] Create `labeled-container/` dashlet with settings
12. [x] Create `card/` dashlet with settings

### Phase 4: Context & Storage

13. [x] Update `dashboard-context.tsx` for unified widget tree
14. [x] Add `updateWidgetConfig()` action for settings
15. [x] Update `use-dashboard-storage.ts` with migration from v1 → v2
16. [x] Add nesting validation to `addWidget()`

### Phase 5: Component Selector

17. [x] Redesign `AddWidgetModal` with search + categories
18. [x] Implement `getValidDashletsForParent()` filtering
19. [x] Add search functionality

### Phase 6: Settings Integration

20. [x] Add gear icon to `WidgetRenderer` (edit mode only)
21. [x] Integrate settings modals for each dashlet
22. [x] Persist config changes to localStorage

### Phase 7: Polish & Advanced Features

23. [x] Test all nesting scenarios
24. [x] Test migration from old chartset data
25. [x] Update visual styling for labeled container
26. [x] Implement hover-based widget controls (show on hover only)
27. [x] CSS `:has()` selector for parent/child hover isolation
28. [x] Add minimalistic resize handles (show on hover)
29. [x] Light blue dashed border placeholder on drag
30. [x] Make containers scrollable when content overflows
31. [x] Add button always visible at bottom of containers
32. [x] Centralize widget size defaults in `widget-defaults.ts`
33. [x] Support `minW`, `minH`, `maxW`, `maxH` per widget
34. [x] Add `updateWidgetConstraints()` to context
35. [x] Unify all grids to 12 columns for consistent sizing
36. [x] Add close button to AddWidgetModal

---

## Migration Strategy

### From Chartset (v1) to Dashboard (v2)

```typescript
function migrateV1ToV2(oldData: ChartsetStorageSchema): DashboardStorageSchema {
  return {
    version: 2,
    widgets: oldData.chartsets.map((chartset) => ({
      id: chartset.id,
      componentId: "container",
      layout: { i: chartset.id, x: 0, y: 0, w: 3, h: 2 },
      config: {
        name: chartset.name,
        description: chartset.description,
      },
      children: chartset.widgets.map((widget) => ({
        id: widget.id,
        componentId: "card", // Map old types to 'card' for now
        layout: widget.layout,
        config: {
          name: widget.title,
          value: "0",
          backgroundColor: "white",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      createdAt: chartset.createdAt,
      updatedAt: chartset.updatedAt,
    })),
    preferences: oldData.preferences,
  };
}
```

---

## Dependencies

### Installed ✅

```bash
npm install react-grid-layout
npm install -D @types/react-grid-layout
```

### Existing Dependencies Used

- `flowbite-react` - Modal, ModalBody, Button, ToggleSwitch, TextInput, Select
- `react-icons/hi2` - Icons (HiPlus, HiCog6Tooth, HiTrash, etc.)
- `tailwind-merge` - Class merging
- `crypto.randomUUID()` - ID generation
- `createPortal` from `react-dom` - Portal for modals

---

## Visual Reference

### Dashboard with Nested Widgets

```
┌─────────────────────────────────────────────────────────────┐
│  Home                                         [Edit Mode 🔘] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 📊 Sales Overview ✏️                    [⚙️] [🗑️]     │  │
│  │ Monthly performance metrics ✏️                        │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │                                                       │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────────────────────┐  │  │
│  │  │ 📊 Card │ │ 📊 Card │ │                         │  │  │
│  │  │  $1,234 │ │   456   │ │  ┌─ Revenue ──────────┐ │  │  │
│  │  │  [⚙️]   │ │  [⚙️]   │ │  │ ┌──────┐ ┌──────┐  │ │  │  │
│  │  └─────────┘ └─────────┘ │  │ │ Card │ │ Card │  │ │  │  │
│  │                          │  │ │ [⚙️] │ │ [⚙️] │  │ │  │  │
│  │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │  │ └──────┘ └──────┘  │ │  │  │
│  │  │    + Add widget    │  │  └────────────────────┘ │  │  │
│  │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  └─────────────────────────┘  │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│                  ┌─────────────────────────┐                │
│                  │   + Add Bento Box       │                │
│                  └─────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Labeled Container Style

```
┌─ Label Text ─────────────────────────────┐
│                                          │
│   ┌──────────┐  ┌──────────┐            │
│   │  Card 1  │  │  Card 2  │            │
│   └──────────┘  └──────────┘            │
│                                          │
└──────────────────────────────────────────┘
```

The label "cuts into" the top border using:

```tsx
<div className="relative mt-2 rounded-lg border border-gray-200 p-4 pt-5">
  <span className="absolute -top-3 left-3 bg-white px-2 text-sm text-gray-500">
    {config.label}
  </span>
  {/* children */}
</div>
```

---

## Notes

- All styling uses Tailwind CSS utility classes
- Storage schema version bumped to 2 for migration detection
- Edit mode toggle is global (affects all widgets at once)
- Widgets snap to grid, no free-form positioning
- Home page container has `h-full overflow-auto` for scrolling
- `user-select: none` applied to grid area during drag operations
- All buttons in draggable areas need `no-drag` class and `onMouseDown` stopPropagation
- Settings are persisted to localStorage immediately on save
- Widget controls (gear, delete) only show when hovering that specific widget
- CSS `:has(.widget-wrapper:hover)` hides parent controls when child is hovered
- Nested grids use cancel selector `.nested-grid-wrapper .react-grid-item` to prevent parent drag
- Containers use conditional `h-full` and `overflow-auto` based on edit mode
- Label background is context-aware: `bg-gray-50` at root, `bg-white` inside containers
- All widget defaults centralized in `utils/widget-defaults.ts` - change once, applies everywhere
