import { HiSignal } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "stat_progress",
  name: "Progress Stat",
  description: "Horizontal progress bar with milestone markers",
  icon: HiSignal,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
