import { Box, Text, useInput } from "ink";
import type { SessionState } from "../session/types.js";
import { turnCount } from "../session/selectors.js";

export interface ContextModalProps {
  session: SessionState;
  lastRunId: string | null;
  onClose: () => void;
  isFocused?: boolean;
}

export function ContextModal(props: ContextModalProps): React.ReactElement {
  const { session, lastRunId } = props;
  useInput(
    (_input, key) => {
      if (key.escape || key.return) props.onClose();
    },
    { isActive: props.isFocused ?? true },
  );

  const fields: Array<[string, string]> = [
    ["tenant", session.meta.tenantId],
    ["user", session.meta.userId],
    ["conv", session.meta.conversationId],
    ["mode", session.meta.mode],
    ["baseUrl", session.meta.baseUrl],
  ];
  if (session.meta.profileName) {
    fields.push(["profile", session.meta.profileName]);
  }
  fields.push(["turns", String(turnCount(session))]);
  fields.push(["last run", lastRunId ?? "(none)"]);
  fields.push([
    "pending approvals",
    String(session.pendingApprovals.length),
  ]);

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>session context</Text>
      {fields.map(([key, value]) => (
        <Text key={key}>
          {key.padEnd(18)} {value}
        </Text>
      ))}
      <Text dimColor>esc/enter to close</Text>
    </Box>
  );
}
