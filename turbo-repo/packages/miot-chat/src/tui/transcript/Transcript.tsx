import { Box, Text } from "ink";
import { AssistantTurn } from "./AssistantTurn.js";
import { Spinner } from "./Spinner.js";
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
  // When a run is in flight, the most recent "chain" item (route /
  // plan / agent / artifact / freshness) gets a spinner instead of
  // the static "·" prefix to signal "this is the step the harness is
  // working on right now". Tool items already self-animate via
  // status=running; assistant items animate via status=streaming.
  const activeChainIdx = props.isStreaming
    ? findActiveChainIndex(props.items)
    : -1;

  return (
    <Box flexDirection="column">
      {props.items.map((item, i) => (
        <TranscriptItemView
          key={item.id}
          item={item}
          isActive={i === activeChainIdx}
        />
      ))}
    </Box>
  );
}

function findActiveChainIndex(items: TranscriptItem[]): number {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (!item) continue;
    if (
      item.kind === "route" ||
      item.kind === "plan" ||
      item.kind === "agent" ||
      item.kind === "artifact" ||
      item.kind === "freshness"
    ) {
      return i;
    }
    // A user item or a finalized assistant item ends the chain — no
    // active chain anchor needed.
    if (item.kind === "user") return -1;
    if (item.kind === "assistant") return -1;
  }
  return -1;
}

function TranscriptItemView(props: {
  item: TranscriptItem;
  isActive: boolean;
}): React.ReactElement {
  const { item, isActive } = props;
  switch (item.kind) {
    case "user":
      return <UserTurn item={item} />;
    case "assistant":
      return <AssistantTurn item={item} />;
    case "tool":
      return <ToolCall item={item} />;
    case "route":
      return (
        <ChainRow prefix="route:" isActive={isActive}>
          {item.route}
        </ChainRow>
      );
    case "agent":
      return (
        <ChainRow prefix="agent:" isActive={isActive}>
          {item.agent}
        </ChainRow>
      );
    case "plan":
      return (
        <ChainRow prefix="plan:" isActive={isActive}>
          {item.message}
        </ChainRow>
      );
    case "freshness":
      return <Text color="yellow">⚠ {item.message}</Text>;
    case "artifact":
      return (
        <ChainRow prefix="artifact:" isActive={isActive}>
          {item.artifactKind}
        </ChainRow>
      );
    case "system":
      return <Text dimColor>{item.text}</Text>;
  }
}

function ChainRow(props: {
  prefix: string;
  isActive: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  if (props.isActive) {
    // Bright cyan + bold so the active step pops visually. Dim
    // neighbors aren't enough contrast on their own — the spinner is
    // small and the user shouldn't have to hunt for it.
    return (
      <Box flexDirection="row">
        <Spinner color="cyan" />
        <Text color="cyan" bold>
          {" "}
          {props.prefix} {props.children}
        </Text>
      </Box>
    );
  }
  return (
    <Text dimColor>
      · {props.prefix} {props.children}
    </Text>
  );
}
