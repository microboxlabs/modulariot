import { Box, Text } from "ink";
import type { SessionMeta } from "../session/types.js";
import { useTheme } from "../theme/ThemeProvider.js";

export interface TopLineProps {
  meta: SessionMeta;
  // Kept for API compatibility with App. Loading is now signalled
  // inline in the transcript (the active chain row / AssistantTurn
  // spinner) so it sits with the conversation, not detached up here.
  streaming: boolean;
}

// Slim context line at the top of the screen, grok-style: just enough
// to know who/where you are. Mode lives in the input frame's border
// label; stats live in the FooterLine.
export function TopLine(props: TopLineProps): React.ReactElement {
  const { theme } = useTheme();
  const shortConv = props.meta.conversationId.slice(0, 8);
  return (
    <Box paddingX={1}>
      <Text color={theme.dim}>
        ⎇ {props.meta.tenantId} · {props.meta.userId} · conv {shortConv}
      </Text>
    </Box>
  );
}
