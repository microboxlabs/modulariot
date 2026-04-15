import { HiCloudArrowUp } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "file_upload",
  name: "File Upload",
  description: "Upload a file to a configurable API endpoint",
  icon: HiCloudArrowUp,
  category: "actions",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
