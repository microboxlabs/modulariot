import { HiChartPie } from "react-icons/hi2";
import type { DashletMeta } from "../types";

/**
 * Metadata for the Percentage Value dashlet
 */
export const dashletMeta: DashletMeta = {
  id: "percentage_value",
  name: "Progress",
  description: "Display progress with a bar",
  icon: HiChartPie,
  category: "data-display",
  canNestIn: ["container"],
  hasSettings: true,
  hasChildren: false,
};
