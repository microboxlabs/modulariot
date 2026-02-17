import { HiQueueList } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "stat_detailed",
  name: "Detailed Stat",
  description: "Full details with trend, progress bar, and comparison",
  icon: HiQueueList,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
