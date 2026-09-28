import type { HarnessExtension } from "../harness-extension";
import { ShowDashboardDraftCard } from "./components/show-dashboard-draft-card";
import {
  SHOW_DASHBOARD_DRAFT_TOOL,
  type ShowDashboardDraftArgs,
} from "./dashboard-draft";

export const showDashboardDraftExtension: HarnessExtension<
  ShowDashboardDraftArgs,
  Record<string, never>
> = {
  toolName: SHOW_DASHBOARD_DRAFT_TOOL,
  description:
    "Offer a dashboard made of dashlets shown in the chat. The user reviews it and creates it.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      dashlets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            widgetId: { type: "string" },
            dashletId: { type: "string" },
            config: { type: "object" },
          },
          required: ["dashletId", "config"],
        },
      },
      missing: { type: "array", items: { type: "string" } },
    },
    required: ["id", "title", "dashlets"],
  },
  render: ShowDashboardDraftCard,
};
