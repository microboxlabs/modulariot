import { Box, Text } from "ink";
import { AssistantTurn } from "./AssistantTurn.js";
import { ToolCall } from "./ToolCall.js";
import { UserTurn } from "./UserTurn.js";
import type { TranscriptItem } from "../session/types.js";

export interface TranscriptProps {
  items: TranscriptItem[];
  isStreaming: boolean;
}

/**
 * Render the full transcript on every state change.
 *
 * Earlier versions split items into Ink's <Static> (committed turns) +
 * a live <Box> (the in-flight turn) so completed turns scrolled into
 * terminal scrollback. The trade-off bit us: when an item migrates
 * from live → static AND its status flips in the same render,
 * real-terminal Ink doesn't reliably clear the live region's prior
 * paint, so a "… miot" line printed during streaming stayed on screen
 * even after END_TURN flipped the item to "complete". ink-testing-
 * library captures both regions as one frame and didn't catch it.
 *
 * Trade-off accepted: every state change re-paints every item. For
 * typical sessions (≤20 turns visible) the reconciliation cost is
 * negligible. Long-running sessions lose true scrollback; users can
 * still scroll the terminal manually.
 *
 * `isStreaming` is kept in the prop signature for the Header / spinner
 * gating but is no longer needed here.
 */
export function Transcript(props: TranscriptProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {props.items.map((item) => (
        <TranscriptItemView key={item.id} item={item} />
      ))}
    </Box>
  );
}

function TranscriptItemView(props: {
  item: TranscriptItem;
}): React.ReactElement {
  const { item } = props;
  switch (item.kind) {
    case "user":
      return <UserTurn item={item} />;
    case "assistant":
      return <AssistantTurn item={item} />;
    case "tool":
      return <ToolCall item={item} />;
    case "route":
      return <DimText prefix="route:">{item.route}</DimText>;
    case "agent":
      return <DimText prefix="agent:">{item.agent}</DimText>;
    case "plan":
      return <DimText prefix="plan:">{item.message}</DimText>;
    case "freshness":
      return (
        <Text color="yellow">⚠ {item.message}</Text>
      );
    case "artifact":
      return <DimText prefix="artifact:">{item.artifactKind}</DimText>;
    case "system":
      return <Text dimColor>{item.text}</Text>;
  }
}

function DimText(props: {
  prefix: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Text dimColor>
      · {props.prefix} {props.children}
    </Text>
  );
}
