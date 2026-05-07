import { createTheme } from "flowbite-react";

/**
 * Modular IoT flowbite-react skin.
 *
 * The platform palette in globals.css overrides Tailwind's default blue
 * scale to the Flowbite values (#1C64F2 primary). Status semantics live
 * as `--color-signal / --color-symptom / --color-action / --color-urgent`.
 *
 * Marketing sections use design tokens directly (text-ink-1, bg-surface-2,
 * border-hairline) and don't lean heavily on flowbite primitives. This
 * skin only nudges the few flowbite components used in the secured
 * surfaces or in fallback positions.
 *
 * Semantic role mapping (used in copy, not as CSS aliases):
 *   primary    → blue-600  (#1C64F2)  — core platform actions
 *   signal     → blue-500  (#3F83F8)  — data in flight
 *   symptom    → amber-500 (#F59E0B)  — watching / warning
 *   action     → green-500 (#0E9F6E)  — approved / success
 *   urgent     → rose-600  (#E11D48)  — alert / critical
 */
export const flowbiteTheme = createTheme({
  button: {
    base: "relative flex items-center justify-center rounded-lg text-center font-medium focus:outline-none focus:ring-4 cursor-pointer transition-colors",
  },
  card: {
    root: {
      base: "flex rounded-xl border border-hairline bg-surface-1 dark:border-gray-800 dark:bg-gray-900",
      children: "flex h-full flex-col justify-center gap-3 p-6",
    },
  },
  badge: {
    root: {
      base: "flex h-fit items-center gap-1 font-medium",
    },
  },
  navbar: {
    root: {
      base: "border-b border-hairline bg-surface-1/85 px-4 py-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/85",
    },
  },
  alert: {
    base: "flex flex-col gap-2 rounded-lg p-4 text-sm",
  },
});
