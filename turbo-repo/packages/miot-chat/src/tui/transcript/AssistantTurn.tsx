import { Box, Text } from "ink";
import { Spinner } from "./Spinner.js";
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

  return (
    <Box flexDirection="row" marginTop={1}>
      {status === "streaming" ? (
        <>
          <Spinner color="cyan" />
          <Text color={color} bold>
            {" "}
            miot{" "}
          </Text>
        </>
      ) : (
        <Text color={color} bold>
          {status === "failed" ? "✗ " : "✓ "}miot{" "}
        </Text>
      )}
      <Text color={color}>{text}</Text>
    </Box>
  );
}
