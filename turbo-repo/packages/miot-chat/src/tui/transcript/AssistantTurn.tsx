import { Box, Text } from "ink";
import type { TranscriptItem } from "../session/types.js";

export interface AssistantTurnProps {
  item: Extract<TranscriptItem, { kind: "assistant" }>;
}

export function AssistantTurn(
  props: AssistantTurnProps,
): React.ReactElement {
  const { text, status } = props.item;
  const color =
    status === "failed"
      ? "red"
      : status === "complete"
        ? "green"
        : "white";
  const marker =
    status === "failed" ? "✗ " : status === "complete" ? "✓ " : "… ";

  return (
    <Box flexDirection="row" marginTop={1}>
      <Text color={color} bold>
        {marker}miot{" "}
      </Text>
      <Text color={color}>{text}</Text>
    </Box>
  );
}
