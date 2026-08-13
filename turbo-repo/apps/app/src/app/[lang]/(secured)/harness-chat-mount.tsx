"use client";

import {
  LuChartBar,
  LuClipboardList,
  LuFileText,
  LuLightbulb,
  LuMessageCircleQuestion,
  LuSearch,
} from "react-icons/lu";
import HarnessChat from "@/features/harness-chat/harness-chat";
import type { HarnessSkill } from "@/features/harness-chat/harness-chat-types";

/**
 * Placeholder skills for exercising the harness chat's slash-command menu
 * before the harness has a real, backend-driven skill list to offer —
 * replace this array (or wire it up to a real source) when that lands.
 */
const TEST_HARNESS_SKILLS: HarnessSkill[] = [
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

export default function HarnessChatMount() {
  return <HarnessChat skills={TEST_HARNESS_SKILLS} />;
}
