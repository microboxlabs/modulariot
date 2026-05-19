import { Box, Static, Text } from "ink";
import { AssistantTurn } from "./AssistantTurn.js";
import { ToolCall } from "./ToolCall.js";
import { UserTurn } from "./UserTurn.js";
import type { TranscriptItem } from "../session/types.js";

export interface TranscriptProps {
  items: TranscriptItem[];
  isStreaming: boolean;
}

export function Transcript(props: TranscriptProps): React.ReactElement {
  const { items, isStreaming } = props;
  const { committed, live } = splitTurns(items, isStreaming);

  return (
    <Box flexDirection="column">
      <Static items={committed}>
        {(item): React.ReactElement => (
          <TranscriptItemView key={item.id} item={item} />
        )}
      </Static>
      <Box flexDirection="column">
        {live.map((item) => (
          <TranscriptItemView key={item.id} item={item} />
        ))}
      </Box>
    </Box>
  );
}

function splitTurns(
  items: TranscriptItem[],
  isStreaming: boolean,
): { committed: TranscriptItem[]; live: TranscriptItem[] } {
  if (!isStreaming) {
    return { committed: items, live: [] };
  }
  // The "live tail" is the current turn: the most recent user item and
  // every item after it. Older turns are committed.
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item && item.kind === "user") {
      return {
        committed: items.slice(0, i),
        live: items.slice(i),
      };
    }
  }
  // No user turn yet — everything is live.
  return { committed: [], live: items };
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
