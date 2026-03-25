import { HiEyeSlash } from "react-icons/hi2";
import type { DashletMeta } from "../types";

export const dashletMeta: DashletMeta = {
  id: "stat_sensitive",
  name: "Sensitive Stat",
  description: "Hidden value by default - click eye icon to reveal",
  icon: HiEyeSlash,
  category: "data-display",
  canNestIn: [],
  hasSettings: true,
  hasChildren: false,
};
