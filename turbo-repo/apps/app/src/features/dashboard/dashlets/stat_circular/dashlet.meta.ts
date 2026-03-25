import { HiArrowPath } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "stat_circular",
  name: "Circular Stat",
  description: "Donut chart style circular progress indicator",
  icon: HiArrowPath,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
