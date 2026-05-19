import { Box, Text } from "ink";
import type { TranscriptItem } from "../session/types.js";

export interface UserTurnProps {
  item: Extract<TranscriptItem, { kind: "user" }>;
}

export function UserTurn(props: UserTurnProps): React.ReactElement {
  const { text } = props.item;
  return (
    <Box flexDirection="row" marginTop={1}>
      <Text color="cyan" bold>
        you{" "}
      </Text>
      <Text>{text}</Text>
    </Box>
  );
}
