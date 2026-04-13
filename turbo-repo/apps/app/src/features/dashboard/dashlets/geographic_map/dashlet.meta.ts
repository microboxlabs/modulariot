import { HiGlobeAlt } from "react-icons/hi2";
import type { DashletMeta } from "../types";

/**
 * Geographic Map Dashlet Metadata
 *
 * This dashlet displays the same map as the geographic view page,
 * including filters, buttons, and the map visualization.
 */
export const dashletMeta: DashletMeta = {
  id: "geographic_map",
  name: "Geographic Map",
  description: "Interactive map with position markers and filters",
  icon: HiGlobeAlt,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
