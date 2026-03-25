# Dashlet Template

Copy this folder to create a new dashlet.

## Quick Start

1. **Copy the folder**

   ```bash
   cp -r src/features/dashboard/dashlets/_template src/features/dashboard/dashlets/my-dashlet
   ```

2. **Update the meta** (`dashlet.meta.ts`)
   - Change `id` to match your folder name (e.g., `"my-dashlet"`)
   - Set `name`, `description`, `icon`, and `category`

3. **Customize the component** (`dashlet.tsx`)
   - Define your `DashletConfig` interface
   - Set `defaultConfig` values
   - Set `layoutDefaults` (minW, minH)
   - Build your component UI

4. **Customize settings** (`dashlet.settings.tsx`)
   - Add form fields for each config property
   - Update `handleSave` to include all fields

5. **Register the dashlet** (`../index.ts`)

   ```typescript
   import { dashletDefinition as myDashletDefinition } from "./my-dashlet";

   const DASHLET_DEFINITIONS: DashletDefinition[] = [
     containerDefinition,
     cardDefinition,
     myDashletDefinition, // Add here
   ];
   ```

## File Structure

```
my-dashlet/
├── dashlet.tsx          # Component + config types + layout defaults
├── dashlet.settings.tsx # Settings modal form
├── dashlet.meta.ts      # Metadata (id, name, icon, category)
├── index.ts             # Wires everything together (don't edit)
└── README.md            # This file (can delete)
```

## Tips

- The `id` in `dashlet.meta.ts` MUST match the folder name
- Use icons from `react-icons/hi2` for consistency
- Categories: `"containers"` or `"data-display"`
- Layout defaults: `minW` = min columns, `minH` = min rows (80px each)
