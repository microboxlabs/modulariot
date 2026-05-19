import type { SlashCommand, SlashResult } from "../registry.js";
import type { ApprovalDecision } from "../../session/types.js";

const VALID_DECISIONS: readonly ApprovalDecision[] = [
  "approve",
  "deny",
  "later",
];

export const approveCommand: SlashCommand = {
  name: "approve",
  summary: "Resolve a pending approval (approve|deny|later) <id>",
  usage: "/approve <approve|deny|later> <id>",
  argSchema: [
    { name: "decision", required: true, choices: VALID_DECISIONS },
    { name: "id", required: true },
  ],
  handle: (args): SlashResult => {
    const decision = args[0];
    const id = args[1];
    if (decision === undefined || id === undefined) {
      return { error: "usage: /approve <approve|deny|later> <id>" };
    }
    if (!VALID_DECISIONS.includes(decision as ApprovalDecision)) {
      return { error: `unknown decision: ${decision}` };
    }
    return {
      dispatch: {
        kind: "RESOLVE_APPROVAL",
        id,
        decision: decision as ApprovalDecision,
      },
    };
  },
};
