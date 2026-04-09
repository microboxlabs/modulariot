import { HiSquare3Stack3D } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "stat_icon",
  name: "Stat Card",
  description:
    "KPI card with multiple styles: default, gradient, minimal, bordered",
  icon: HiSquare3Stack3D,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
