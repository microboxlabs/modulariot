import { createTheme } from "flowbite-react";

/**
 * Modular IoT flowbite-react skin.
 *
 * The brand palette in globals.css OVERRIDES Tailwind's default blue/yellow/
 * orange/gray scales — so any flowbite-react component that uses `bg-blue-500`,
 * `text-orange-600`, etc. automatically picks up the brand colors. This file
 * only needs to override defaults that look too "stock flowbite" for the
 * Modular IoT identity (rounder corners, softer borders, brand-tinted shadows).
 *
 * Semantic role mapping (used in copy, not as CSS aliases):
 *   primary    → blue-500   (#0790ff)  — core platform actions, links
 *   attention  → yellow-500 (#ffb300)  — warnings, energy, highlights
 *   critical   → orange-500 (#ff6a14)  — incidents, motion, urgent state
 *   neutral    → gray-500   (#5b6770)  — structure, secondary surfaces
 */
export const flowbiteTheme = createTheme({
  button: {
    base: "relative flex items-center justify-center rounded-lg text-center font-medium focus:outline-none focus:ring-4 cursor-pointer transition-colors",
  },
  card: {
    root: {
      base: "flex rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900",
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
      base: "border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80",
    },
  },
  alert: {
    base: "flex flex-col gap-2 rounded-xl p-4 text-sm",
  },
});
