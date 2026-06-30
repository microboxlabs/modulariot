import { Box, Static, Text } from "ink";
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
 * An item is terminal when it will no longer mutate and is safe to
 * commit to Ink's <Static> (rendered once, flushed to native terminal
 * scrollback, never re-painted). When the run is over, every item is
 * terminal. While a run is in flight, only finished items commit; the
 * in-flight tail stays in the live region.
 */
function isTerminalItem(
  item: TranscriptItem,
  isStreaming: boolean,
): boolean {
  if (!isStreaming) return true;
  switch (item.kind) {
    case "assistant":
      return item.status !== "streaming";
    case "tool":
      return item.status !== "running";
    case "thinking":
      return item.status !== "streaming";
    case "route":
    case "agent":
    case "plan":
    case "freshness":
    case "artifact":
      // May still be the spinning active step; keep live until run ends.
      return false;
    case "user":
    case "system":
      return true;
  }
}

/**
 * Render committed (terminal) turns via Ink's <Static> so they flush to
 * native terminal scrollback and escape Ink's viewport-height
 * truncation (the cause of long answers being cut with "…"). Only the
 * in-flight tail renders in the dynamic <Box>.
 *
 * `committed` and `live` are derived by a pure per-render filter on
 * `isTerminalItem`, so they are always disjoint — an item is never
 * painted in both regions (no ghost line). The filter returns a fresh
 * array each render, which is required for Ink's <Static> to detect and
 * emit newly-committed items: <Static> only re-renders when its `items`
 * prop reference changes (a same-reference mutation is silently
 * dropped). `isTerminalItem` is monotonic — status only advances
 * (streaming→complete) and a run only ends (isStreaming true→false) — so
 * an item never oscillates back out of `committed`.
 */
export function Transcript(props: TranscriptProps): React.ReactElement {
  const committed = props.items.filter((item) =>
    isTerminalItem(item, props.isStreaming),
  );
  const live = props.items.filter(
    (item) => !isTerminalItem(item, props.isStreaming),
  );
  // When a run is in flight, the most recent "chain" item (route /
  // plan / agent / artifact / freshness) in the live tail gets a
  // spinner instead of the static "·" prefix to signal "this is the
  // step the harness is working on right now".
  const activeChainIdx = props.isStreaming
    ? findActiveChainIndex(live)
    : -1;

  return (
    <Box flexDirection="column">
      <Static items={committed}>
        {(item) => (
          <TranscriptItemView key={item.id} item={item} isActive={false} />
        )}
      </Static>
      <Box flexDirection="column">
        {live.map((item, i) => (
          <TranscriptItemView
            key={item.id}
            item={item}
            isActive={i === activeChainIdx}
          />
        ))}
      </Box>
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
    case "thinking":
      // Dim multi-line block, append-only, no spinner. We don't tag
      // these as "active" because the chain anchor stays on the
      // owning agent row and we don't want two spinners at once.
      return (
        <Box flexDirection="row">
          <Text dimColor>  ⋮ </Text>
          <Text dimColor>{item.text}</Text>
        </Box>
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
