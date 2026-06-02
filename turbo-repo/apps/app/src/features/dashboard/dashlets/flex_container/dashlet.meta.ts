import { HiRectangleGroup } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "flex_container",
  name: "Flex Container",
  description: "Row, column, or grid layout container with per-child sizing",
  icon: HiRectangleGroup,
  category: "containers",
  canNestIn: [],
  hasSettings: true,
  hasChildren: true,
};
