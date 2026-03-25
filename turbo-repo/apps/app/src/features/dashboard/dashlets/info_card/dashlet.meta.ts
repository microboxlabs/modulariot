import { HiInformationCircle } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "info_card",
  name: "Info Card",
  description: "Card with title, value, descriptor, AI summary, and view more",
  icon: HiInformationCircle,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: true,
};
