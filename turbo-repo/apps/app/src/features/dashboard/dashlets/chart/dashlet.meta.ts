import { HiChartBar } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "chart",
  name: "Chart",
  description: "Displays data as line, bar, pie, gauge, or scatter charts",
  icon: HiChartBar,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
