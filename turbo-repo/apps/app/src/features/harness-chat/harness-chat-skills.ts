import {
  LuChartBar,
  LuClipboardList,
  LuFileText,
  LuLightbulb,
  LuMessageCircleQuestion,
  LuSearch,
} from "react-icons/lu";
import type { IconType } from "react-icons";

export type HarnessSkill = {
  id: string;
  label: string;
  description: string;
  icon: IconType;
};

export const HARNESS_SKILLS: HarnessSkill[] = [
  {
    id: "search",
    label: "search",
    description: "Search across connected data sources",
    icon: LuSearch,
  },
  {
    id: "summarize",
    label: "summarize",
    description: "Summarize the current workspace",
    icon: LuFileText,
  },
  {
    id: "explain",
    label: "explain",
    description: "Explain a signal, event, or metric",
    icon: LuMessageCircleQuestion,
  },
  {
    id: "report",
    label: "report",
    description: "Generate a report from recent data",
    icon: LuClipboardList,
  },
  {
    id: "analyze",
    label: "analyze",
    description: "Analyze trends across a dashboard",
    icon: LuChartBar,
  },
  {
    id: "suggest",
    label: "suggest",
    description: "Suggest next steps based on context",
    icon: LuLightbulb,
  },
];
