import { HiArrowUpTray } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "batch_import",
  name: "Batch Import",
  description: "Import a large dataset via TSV/CSV with preview and validation",
  icon: HiArrowUpTray,
  category: "actions",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
