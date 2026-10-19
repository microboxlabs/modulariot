import type { HarnessExtension } from "../harness-extension";
import { RequestApprovalCard } from "./components/request-approval-card";
import {
  REQUEST_APPROVAL_TOOL,
  type RequestApprovalArgs,
  type RequestApprovalResult,
} from "./request-approval-args";

export const requestApprovalExtension: HarnessExtension<
  RequestApprovalArgs,
  RequestApprovalResult
> = {
  toolName: REQUEST_APPROVAL_TOOL,
  description:
    "A call the harness waits for the user to approve or reject. Sent by the relay, never by the model.",
  parameters: {
    type: "object",
    properties: {
      runId: { type: "string" },
      approvalId: { type: "string" },
      tool: { type: "string" },
      input: { type: "object" },
      inputTruncated: { type: "boolean" },
    },
    required: ["runId", "approvalId", "tool", "input"],
  },
  render: RequestApprovalCard,
};
