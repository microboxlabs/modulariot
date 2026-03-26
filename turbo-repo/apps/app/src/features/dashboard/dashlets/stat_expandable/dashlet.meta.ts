import { HiChevronUpDown } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "stat_expandable",
  name: "Expandable Stat",
  description: "Click to expand and show additional details",
  icon: HiChevronUpDown,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
