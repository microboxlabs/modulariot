import { Box, Text } from "ink";
import { Spinner } from "./Spinner.js";
import { Markdown } from "./markdown.js";
import { useTheme } from "../theme/ThemeProvider.js";
import type { TranscriptItem } from "../session/types.js";

export interface AssistantTurnProps {
  item: Extract<TranscriptItem, { kind: "assistant" }>;
}

export function AssistantTurn(
  props: AssistantTurnProps,
): React.ReactElement {
  const { theme } = useTheme();
  const { text, status } = props.item;
  const color =
    status === "failed"
      ? "red"
      : status === "complete"
        ? "green"
        : "white";

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row">
        {status === "streaming" ? (
          <>
            <Spinner color="cyan" />
            <Text color={color} bold>
              {" "}
              miot
            </Text>
          </>
        ) : (
          <Text color={color} bold>
            {status === "failed" ? "✗ " : "✓ "}miot
          </Text>
        )}
      </Box>
      <Box marginLeft={2}>
        {status === "complete" ? (
          // Plain text while streaming (fast, flicker-free, no partial
          // markdown); render formatted once the turn is final.
          <Markdown text={text} theme={theme} />
        ) : (
          <Text color={color}>{text}</Text>
        )}
      </Box>
    </Box>
  );
}
