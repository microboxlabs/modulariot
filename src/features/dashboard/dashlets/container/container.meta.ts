import { HiSquares2X2 } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const containerMeta: DashletMeta = {
  id: "container",
  name: "Bento Box",
  description: "A draggable grid container for widgets",
  icon: HiSquares2X2,
  category: "containers",
  canNestIn: [], // Can be placed anywhere except inside another container
  isRootOnly: true, // Cannot be nested inside other containers (bento boxes)
  hasSettings: false,
  hasChildren: true,
};
