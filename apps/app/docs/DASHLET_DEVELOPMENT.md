# Dashlet Development Guide

This document explains how to create custom dashlets for the dashboard system. Dashlets are self-contained, configurable widgets that users can add, configure, and arrange on their dashboards.

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Quick Start](#quick-start)
4. [Detailed File Reference](#detailed-file-reference)
5. [Configuration & Types](#configuration--types)
6. [Settings Modal](#settings-modal)
7. [Handlebars Template Support](#handlebars-template-support)
8. [Container Dashlets](#container-dashlets)
9. [Registering Your Dashlet](#registering-your-dashlet)
10. [Best Practices](#best-practices)
11. [Examples](#examples)

---

## Overview

### What is a Dashlet?

A dashlet is a reusable UI component that:
- Displays data or content on a dashboard
- Can be configured via a settings modal
- Supports drag-and-drop positioning
- Persists its configuration to localStorage
- Optionally contains child dashlets (containers)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Dashboard View                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Dashboard Grid                      │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐       │   │
│  │  │  Dashlet  │  │  Dashlet  │  │  Dashlet  │       │   │
│  │  │   Card    │  │   Chart   │  │ Container │       │   │
│  │  │           │  │           │  │ ┌───────┐ │       │   │
│  │  │           │  │           │  │ │ Child │ │       │   │
│  │  └───────────┘  └───────────┘  │ └───────┘ │       │   │
│  │                                 └───────────┘       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

Each dashlet lives in its own folder under `src/features/dashboard/dashlets/`:

```
src/features/dashboard/dashlets/
├── _template/              # ← Copy this folder to create new dashlets
│   ├── dashlet.tsx         # Main component
│   ├── dashlet.settings.tsx # Settings modal
│   ├── dashlet.meta.ts     # Metadata (id, name, icon, category)
│   ├── index.ts            # Module exports
│   └── README.md           # Documentation (optional)
├── card/                   # Example: Card dashlet
├── container/             # Example: Container dashlet
├── info_card/             # Example: Info Card dashlet
├── index.ts               # Registry (register dashlets here)
└── types.ts               # Shared type definitions
```

---

## Quick Start

### Step 1: Copy the Template

```bash
cp -r src/features/dashboard/dashlets/_template src/features/dashboard/dashlets/my_dashlet
```

### Step 2: Update Metadata

Edit `dashlet.meta.ts`:

```typescript
import { HiChartBar } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "my_dashlet",           // ⚠️ MUST match folder name
  name: "My Dashlet",
  description: "A custom dashlet that displays data",
  icon: HiChartBar,           // Choose from react-icons/hi2
  category: "data-display",   // "containers" | "data-display"
  canNestIn: [],              // Leave empty (deprecated)
  hasSettings: true,
  hasChildren: false,
};
```

### Step 3: Define Configuration

Edit `dashlet.tsx`:

```typescript
export interface DashletConfig {
  title: string;
  value: string;
  showPercentage: boolean;
}

export const defaultConfig: DashletConfig = {
  title: "My Metric",
  value: "0",
  showPercentage: true,
};
```

### Step 4: Build the Component

```typescript
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const { title, value, showPercentage } = config;

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}{showPercentage && "%"}
      </p>
    </div>
  );
}
```

### Step 5: Create Settings Modal

Edit `dashlet.settings.tsx` (see [Settings Modal](#settings-modal) section).

### Step 6: Register the Dashlet

Edit `src/features/dashboard/dashlets/index.ts`:

```typescript
// Add import
import { dashletDefinition as myDashletDefinition } from "./my_dashlet";

// Add to DASHLET_DEFINITIONS array
const DASHLET_DEFINITIONS: DashletDefinition[] = [
  containerDefinition,
  cardDefinition,
  // ... other dashlets
  myDashletDefinition,  // ← Add here
];
```

---

## Detailed File Reference

### dashlet.tsx

The main component file contains:

1. **Configuration Interface** - TypeScript interface defining all settings
2. **Default Configuration** - Initial values for new instances
3. **Layout Defaults** - Minimum grid size constraints
4. **Dashlet Component** - React component that renders the widget

```typescript
"use client";

import type { DashletComponentProps, DashletLayoutDefaults } from "../types";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig {
  title: string;
  value: string;
  color: "blue" | "green" | "red";
}

export const defaultConfig: DashletConfig = {
  title: "Metric",
  value: "100",
  color: "blue",
};

// ============================================================================
// Layout Defaults
// ============================================================================

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,  // Minimum grid columns
  minH: 2,  // Minimum grid rows
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component
// ============================================================================

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  
  return (
    <div className="...">
      {/* Your component JSX */}
    </div>
  );
}
```

### dashlet.meta.ts

Metadata that defines how the dashlet appears in the selector and how it behaves:

```typescript
import { HiChartBar } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  // Unique identifier - MUST match folder name
  id: "my_dashlet",
  
  // Display name in the "Add Widget" modal
  name: "My Dashlet",
  
  // Description shown below the name
  description: "Displays a metric with customizable styling",
  
  // Icon from react-icons/hi2
  icon: HiChartBar,
  
  // Category: "containers" or "data-display"
  category: "data-display",
  
  // Deprecated - leave as empty array
  canNestIn: [],
  
  // Set true if this dashlet can only be placed at root (not inside containers)
  isRootOnly: false,
  
  // Whether the dashlet has a settings modal
  hasSettings: true,
  
  // Whether the dashlet can contain child widgets
  hasChildren: false,
};
```

### dashlet.settings.tsx

The settings modal allows users to configure the dashlet:

```typescript
"use client";

import { useState } from "react";
import { Button, TextInput, Label } from "flowbite-react";
import { createPortal } from "react-dom";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  // State for each config field
  const [title, setTitle] = useState(config.title || "");
  const [value, setValue] = useState(config.value || "");

  const handleSave = () => {
    onSave({ title, value });
    onClose();
  };

  // Required for SSR compatibility
  if (globalThis.window === undefined) return null;

  // Prevent drag events from propagating
  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const modalContent = (
    <AbsoluteModal
      selected={isOpen}
      setSelected={(selected) => {
        if (!selected) onClose();
      }}
      className="no-drag w-80 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex flex-col gap-3">
        <div>
          <Label htmlFor="title">Title</Label>
          <TextInput
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sizing="sm"
          />
        </div>
        
        <div>
          <Label htmlFor="value">Value</Label>
          <TextInput
            id="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            sizing="sm"
          />
        </div>

        <Button onClick={handleSave} onMouseDown={handleMouseDown} size="sm">
          Save
        </Button>
      </div>
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
```

### index.ts

Wires everything together and exports the dashlet definition:

```typescript
import type { DashletDefinition } from "../types";
import { Dashlet, defaultConfig, getLayoutDefaults } from "./dashlet";
import { DashletSettings } from "./dashlet.settings";
import { dashletMeta } from "./dashlet.meta";

export const dashletDefinition: DashletDefinition = {
  meta: dashletMeta,
  Component: Dashlet,
  SettingsModal: DashletSettings,
  defaultConfig: defaultConfig as unknown as Record<string, unknown>,
  getLayoutDefaults,
};

// Re-export for direct imports
export { Dashlet, defaultConfig, getLayoutDefaults } from "./dashlet";
export { DashletSettings } from "./dashlet.settings";
export { dashletMeta } from "./dashlet.meta";
export type { DashletConfig } from "./dashlet";
```

---

## Configuration & Types

### DashletComponentProps

Props passed to every dashlet component:

```typescript
interface DashletComponentProps {
  widget: Widget;              // Widget data including config
  editMode: boolean;           // True when dashboard is in edit mode
  isRoot?: boolean;            // True if at root level (affects styling)
  onAddChild?: (componentId: string) => void;  // Add child widget
  onOpenSettings?: () => void; // Open settings modal
  onDelete?: () => void;       // Delete this widget
  children?: ReactNode;        // Child widgets (for containers)
}
```

### DashletSettingsProps

Props passed to settings modals:

```typescript
interface DashletSettingsProps<TConfig> {
  isOpen: boolean;             // Modal open state
  onClose: () => void;         // Close callback
  config: TConfig;             // Current configuration
  onSave: (config: Partial<TConfig>) => void;  // Save callback
  dictionary: I18nRecord;      // Internationalization strings
}
```

### DashletLayoutDefaults

Grid layout constraints:

```typescript
interface DashletLayoutDefaults {
  minW: number;  // Minimum width in grid columns (1-12)
  minH: number;  // Minimum height in grid rows
}
```

---

## Settings Modal

### Common UI Components

Use these pre-built components from `../common`:

```typescript
import {
  DashletSettingsWrapper,  // Modal wrapper with save/cancel
  SettingsTextField,       // Text input field
  SettingsTextareaField,   // Multi-line text field
  SettingsPickerRow,       // Row container for pickers
  SettingsPickerItem,      // Individual picker wrapper
  SettingsFieldGrid,       // Grid layout for fields
} from "../common";
```

### Color Picker

```typescript
import { ColorPickerDropdown, type ColorOption } from "@/features/common/components/color-picker-dropdown";

const COLOR_OPTIONS: ColorOption<string>[] = [
  { value: "bg-blue-500", label: "Blue", dotClass: "bg-blue-500" },
  { value: "bg-green-500", label: "Green", dotClass: "bg-green-500" },
];

<ColorPickerDropdown
  options={COLOR_OPTIONS}
  value={selectedColor}
  onChange={setSelectedColor}
  title="Select Color"
/>
```

### Icon Picker

```typescript
import { IconPickerDropdown, type IconOption } from "@/features/common/components/icon-picker-dropdown";

const ICON_OPTIONS: IconOption<string>[] = [
  { value: "chart", label: "Chart", icon: HiChartBar },
  { value: "users", label: "Users", icon: HiUsers },
];

<IconPickerDropdown
  options={ICON_OPTIONS}
  value={selectedIcon}
  onChange={setSelectedIcon}
  title="Select Icon"
/>
```

---

## Handlebars Template Support

For dynamic values, you can add Handlebars template support using a data provider pattern:

### Configuration

```typescript
interface DataProviderEntry {
  key: string;
  value: string;
}

export interface DashletConfig {
  title: string;              // Can contain {{data_provider.key}}
  value: string;
  dataProvider?: DataProviderEntry[];
}
```

### Component Implementation

```typescript
import { useMemo } from "react";
import Handlebars from "handlebars";

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const { title, dataProvider = [] } = config;

  // Build context from data provider
  const templateContext = useMemo(() => {
    const data_provider: Record<string, string> = {};
    for (const entry of dataProvider) {
      if (entry.key) data_provider[entry.key] = entry.value;
    }
    return { data_provider };
  }, [dataProvider]);

  // Compile template
  const compiledTitle = useMemo(() => {
    try {
      return Handlebars.compile(title)(templateContext);
    } catch {
      return title;
    }
  }, [title, templateContext]);

  return <h3>{compiledTitle}</h3>;
}
```

### Settings Validation

Validate Handlebars syntax in settings inputs:

```typescript
type HandlebarsStatus = "valid" | "invalid" | "none";

function getHandlebarsStatus(text: string): HandlebarsStatus {
  const handlebarsMatches = text.match(/\{\{(.*?)\}\}/g);
  if (!handlebarsMatches) return "none";

  for (const match of handlebarsMatches) {
    const inner = match.slice(2, -2).trim();
    if (!inner || inner.endsWith(".") || inner.startsWith(".")) {
      return "invalid";
    }
  }

  try {
    Handlebars.compile(text);
    return "valid";
  } catch {
    return "invalid";
  }
}
```

Use Flowbite's `color` prop for visual feedback:
- `"success"` - Green border for valid syntax
- `"failure"` - Red border for invalid syntax
- `"gray"` - Default for no Handlebars expressions

---

## Container Dashlets

Container dashlets can hold child widgets. Set `hasChildren: true` in metadata.

### Component Implementation

```typescript
export function Dashlet({
  widget,
  editMode,
  onAddChild,
  children,
}: Readonly<DashletComponentProps>) {
  const hasChildren = widget.children && widget.children.length > 0;

  const handleAddChild = () => {
    onAddChild?.("card");  // Default child type
  };

  return (
    <div className="...">
      {/* Render children */}
      {hasChildren && <div className="flex flex-col gap-2">{children}</div>}
      
      {/* Add button in edit mode */}
      {editMode && !hasChildren && (
        <button onClick={handleAddChild}>
          + Add Widget
        </button>
      )}
    </div>
  );
}
```

---

## Registering Your Dashlet

Edit `src/features/dashboard/dashlets/index.ts`:

```typescript
// 1. Import your dashlet definition
import { dashletDefinition as myDashletDefinition } from "./my_dashlet";

// 2. Add to the DASHLET_DEFINITIONS array
const DASHLET_DEFINITIONS: DashletDefinition[] = [
  containerDefinition,
  cardDefinition,
  // ... existing dashlets
  myDashletDefinition,  // ← Add here
];
```

That's it! Your dashlet will now appear in the "Add Widget" selector.

---

## Best Practices

### Styling

1. **Always support dark mode** - Use Tailwind's `dark:` prefix
2. **Use consistent spacing** - Follow existing dashlet patterns
3. **Fill available space** - Use `h-full` and `flex-1` appropriately
4. **Match borders** - Use `border-gray-200 dark:border-gray-700`

```typescript
<div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
```

### Settings Modal

1. **Prevent drag propagation** - Use `onMouseDown={(e) => e.stopPropagation()}`
2. **Add `no-drag` class** - To interactive elements
3. **Use SSR guard** - `if (globalThis.window === undefined) return null;`
4. **Use createPortal** - Render modals in `document.body`

### Performance

1. **Memoize computed values** - Use `useMemo` for template compilation
2. **Avoid inline objects** - Define constants outside components
3. **Use proper keys** - For mapped elements

### TypeScript

1. **Export config type** - For use in settings modal
2. **Use `Readonly<Props>`** - For component props
3. **Cast widget.config** - Use `as unknown as DashletConfig`

---

## Examples

### Simple Stat Card

```typescript
export interface DashletConfig {
  label: string;
  value: string;
  trend: "up" | "down" | "neutral";
}

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const { label, value, trend } = widget.config as unknown as DashletConfig;
  
  const trendColors = {
    up: "text-green-500",
    down: "text-red-500",
    neutral: "text-gray-500",
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold ${trendColors[trend]}`}>{value}</p>
    </div>
  );
}
```

### Container with Grid Layout

```typescript
export function Dashlet({
  widget,
  editMode,
  onAddChild,
  children,
}: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const hasChildren = widget.children && widget.children.length > 0;

  return (
    <div className="h-full rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-lg font-semibold">{config.title}</h3>
      
      {hasChildren ? (
        <div className="grid grid-cols-2 gap-4">{children}</div>
      ) : editMode ? (
        <button
          onClick={() => onAddChild?.("card")}
          className="w-full rounded-lg border-2 border-dashed border-gray-300 p-4 text-gray-500"
        >
          + Add Widget
        </button>
      ) : null}
    </div>
  );
}
```

---

## Troubleshooting

### Dashlet doesn't appear in selector

1. Verify `id` in `dashlet.meta.ts` matches the folder name
2. Check that you imported and added to `DASHLET_DEFINITIONS` in `index.ts`
3. Ensure there are no TypeScript errors in your files

### Settings don't save

1. Ensure `onSave` is called with the correct config object
2. Verify all config keys match your `DashletConfig` interface
3. Check browser console for errors

### Layout issues

1. Verify `minW` and `minH` values are appropriate
2. Use `h-full` on the root element
3. Check for overflow issues with scrollable content

### Dark mode not working

1. Add `dark:` variants to all color classes
2. Use semantic colors from design system
3. Test in both modes during development

---

## Related Files

- `src/features/dashboard/dashlets/types.ts` - Type definitions
- `src/features/dashboard/dashlets/common/` - Shared settings components
- `src/features/dashboard/context/` - Dashboard context providers
- `src/features/dashboard/hooks/` - Dashboard hooks

