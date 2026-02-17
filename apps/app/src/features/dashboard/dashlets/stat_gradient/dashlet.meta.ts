import { HiPaintBrush } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "stat_gradient",
  name: "Gradient Stat",
  description: "Bold gradient background with configurable color",
  icon: HiPaintBrush,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
