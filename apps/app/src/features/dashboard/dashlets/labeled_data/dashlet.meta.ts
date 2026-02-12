import { HiTag } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "labeled-data",
  name: "Labeled Data",
  description: "Display a labeled value with customizable styling",
  icon: HiTag,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
