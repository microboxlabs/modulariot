import { HiChartBar } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "chart_v2",
  name: "Chart v2",
  description: "Multi-representation chart combining line, bar, scatter, pie, and gauge",
  icon: HiChartBar,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
