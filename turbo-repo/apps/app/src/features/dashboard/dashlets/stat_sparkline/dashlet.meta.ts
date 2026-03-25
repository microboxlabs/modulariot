import { HiChartBar } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "stat_sparkline",
  name: "Sparkline Stat",
  description: "Value with mini line chart trend in the background",
  icon: HiChartBar,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
