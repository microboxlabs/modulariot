import { HiBars3BottomLeft } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "stat_stacked",
  name: "Stacked Stat",
  description: "Stacked bar showing multiple categories breakdown",
  icon: HiBars3BottomLeft,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
