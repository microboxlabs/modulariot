import { HiTableCells } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "data_table_v2",
  name: "Data Table V2",
  description: "Displays tabular data with resizable columns and static or dynamic (API) sources",
  icon: HiTableCells,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
