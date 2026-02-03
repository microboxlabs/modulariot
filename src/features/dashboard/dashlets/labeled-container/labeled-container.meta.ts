import { HiTag } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const labeledContainerMeta: DashletMeta = {
  id: "labeled-container",
  name: "Labeled Group",
  description: "Group widgets with a label",
  icon: HiTag,
  category: "containers",
  canNestIn: [], // Can be placed anywhere (root or inside containers)
  hasSettings: true,
  hasChildren: true,
};
