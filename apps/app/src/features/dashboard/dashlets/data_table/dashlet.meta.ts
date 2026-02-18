import { HiTableCells } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "data_table",
  name: "Data Table",
  description: "Displays tabular data with static or dynamic (API) sources",
  icon: HiTableCells,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
