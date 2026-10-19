import type { HarnessExtension } from "../harness-extension";
import { ShowShareLinkCard } from "./components/show-share-link-card";
import {
  SHOW_SHARE_LINK_TOOL,
  type ShowShareLinkArgs,
} from "./show-share-link-args";

export const showShareLinkExtension: HarnessExtension<
  ShowShareLinkArgs,
  Record<string, never>
> = {
  toolName: SHOW_SHARE_LINK_TOOL,
  description:
    "A share link the harness created for a story or a chat. Sent by the relay, never by the model.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string" },
      targetType: { type: "string" },
      targetId: { type: "string" },
      title: { type: "string" },
    },
    required: ["url", "targetType", "targetId"],
  },
  render: ShowShareLinkCard,
};
