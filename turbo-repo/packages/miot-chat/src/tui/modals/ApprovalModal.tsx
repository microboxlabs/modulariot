import { Box, Text, useInput } from "ink";
import type { ApprovalDecision, PendingApproval } from "../session/types.js";
import { APPROVAL_REPLY_PLACEHOLDER } from "../session/approvals.js";

export interface ApprovalModalProps {
  approval: PendingApproval;
  onResolve: (decision: ApprovalDecision, id: string) => void;
  isFocused?: boolean;
}

export function ApprovalModal(
  props: ApprovalModalProps,
): React.ReactElement {
  const { approval, onResolve } = props;
  useInput(
    (input, key) => {
      const ch = input.toLowerCase();
      if (key.escape) onResolve("later", approval.id);
      else if (ch === "y") onResolve("approve", approval.id);
      else if (ch === "n") onResolve("deny", approval.id);
    },
    { isActive: props.isFocused ?? true },
  );

  const data = JSON.stringify(approval.data, null, 2);

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold color="yellow">
        approval requested
      </Text>
      <Text>{approval.message || "(no message)"}</Text>
      <Text dimColor>{data}</Text>
      <Text>[Y] approve  [N] deny  [Esc] later</Text>
      <Text dimColor>{APPROVAL_REPLY_PLACEHOLDER}</Text>
    </Box>
  );
}
