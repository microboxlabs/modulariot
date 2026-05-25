import { Box, Text } from "ink";
import type { TranscriptItem } from "../session/types.js";
import { Spinner } from "./Spinner.js";

export interface ToolCallProps {
  item: Extract<TranscriptItem, { kind: "tool" }>;
}

export function ToolCall(props: ToolCallProps): React.ReactElement {
  const { name, status, message } = props.item;
  const color =
    status === "failed"
      ? "red"
      : status === "ok"
        ? "green"
        : "yellow";
  const glyph =
    status === "running" ? null : status === "ok" ? "✓" : "✗";

  return (
    <Box flexDirection="row">
      <Text color={color}>
        {glyph !== null ? `${glyph} ` : ""}
      </Text>
      {status === "running" ? <Spinner color={color} /> : null}
      <Text color={color}>
        {" "}
        tool: {name}
        {message && status !== "running" ? ` — ${message}` : ""}
      </Text>
    </Box>
  );
}
