import { HiPresentationChartLine } from "react-icons/hi2";
import type { DashletMeta } from "../types";

/**
 * Indicator Card Dashlet Metadata
 *
 * A card that fetches data from an API and displays it with
 * configurable color thresholds based on value ranges.
 */
export const dashletMeta: DashletMeta = {
  // Must match the folder name
  id: "indicator_card",

  // Display name shown in the add widget modal
  name: "Indicator Card",

  // Short description shown in the add widget modal
  description: "Displays a value from an API with configurable color thresholds",

  // Icon shown in the add widget modal
  icon: HiPresentationChartLine,

  // Category for grouping
  category: "data-display",

  // Legacy field - leave empty
  canNestIn: [],

  // This dashlet has a settings modal
  hasSettings: true,

  // This dashlet cannot contain child widgets
  hasChildren: false,
};
