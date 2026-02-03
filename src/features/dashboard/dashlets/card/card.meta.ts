import { HiChartBar } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const cardMeta: DashletMeta = {
  id: "card",
  name: "Data Card",
  description: "Display a key metric with icon and value",
  icon: HiChartBar,
  category: "data-display",
  canNestIn: [], // Can be placed anywhere (root or inside containers)
  hasSettings: true,
  hasChildren: false,
};
