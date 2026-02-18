import { HiDocumentText } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "text_card",
  name: "Text Card",
  description: "Simple card for displaying a text block or quote",
  icon: HiDocumentText,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
