import { HiQueueList } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "data_list",
  name: "dashboard.dashlets.data_list.name",
  description: "dashboard.dashlets.data_list.description",
  icon: HiQueueList,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
