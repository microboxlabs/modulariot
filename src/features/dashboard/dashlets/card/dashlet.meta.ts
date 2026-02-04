import { HiChartBar } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "card",
  name: "Data Card",
  description: "Display a key metric with icon and value",
  icon: HiChartBar,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
