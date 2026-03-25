import { HiRectangleStack } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "stat_status",
  name: "Status Card",
  description: "Status card with colored left border and icon badge",
  icon: HiRectangleStack,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
