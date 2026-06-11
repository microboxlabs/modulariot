import { Box, Text } from "ink";
import type { SessionMeta } from "../session/types.js";
import { Spinner } from "../transcript/Spinner.js";
import { useTheme } from "../theme/ThemeProvider.js";

export interface TopLineProps {
  meta: SessionMeta;
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
      {props.streaming ? (
        <>
          <Text color={theme.dim}> </Text>
          <Spinner color={theme.spinner} />
        </>
      ) : null}
    </Box>
  );
}
