import { HiTableCells } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "data_table_v2",
  name: "dashlets.data_table_v2.name",
  description: "dashlets.data_table_v2.description",
  icon: HiTableCells,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
