import { HiQueueList } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "data_list",
  name: "Data List",
  description: "Displays data as a list of cards with KPI grids and metadata",
  icon: HiQueueList,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
