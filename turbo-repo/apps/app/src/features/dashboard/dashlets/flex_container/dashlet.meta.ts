import { HiRectangleGroup } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "flex_container",
  name: "dashboard.dashlets.flex_container.name",
  description: "dashboard.dashlets.flex_container.description",
  icon: HiRectangleGroup,
  category: "containers",
  canNestIn: [],
  hasSettings: true,
  hasChildren: true,
};
