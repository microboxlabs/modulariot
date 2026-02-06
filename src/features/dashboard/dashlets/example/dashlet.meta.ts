import { HiCube } from "react-icons/hi2";
import type { DashletMeta } from "../types";

/**
 * Dashlet Metadata
 *
 * IMPORTANT: The `id` must match the folder name exactly!
 * This is how the registry identifies your dashlet.
 *
 * Example: If your folder is `my-widget`, set id: "my-widget"
 */
export const dashletMeta: DashletMeta = {
  // ⚠️ CHANGE THIS to match your folder name
  id: "example",

  // Display name shown in the add widget modal
  name: "example Dashlet",

  // Short description shown in the add widget modal
  description: "A template dashlet - copy this folder to create a new one",

  // Icon shown in the add widget modal (from react-icons/hi2)
  icon: HiCube,

  // Category for grouping: "containers" | "data-display"
  category: "data-display",

  // Legacy field - leave empty
  canNestIn: [],

  // Set to true if this dashlet has a settings modal
  hasSettings: true,

  // Set to true if this dashlet can contain child widgets
  hasChildren: false,
};
