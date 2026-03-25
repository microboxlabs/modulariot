import { HiSquares2X2 } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "container",
  name: "Container",
  description: "Configurable container (Bento Box or Labeled Group)",
  icon: HiSquares2X2,
  category: "containers",
  canNestIn: [], // Nesting rules enforced via variant check at runtime
  hasSettings: true,
  hasChildren: true,
};
