import { Box, Text } from "ink";
import type { UsageTotals } from "../session/types.js";
import { useTheme } from "../theme/ThemeProvider.js";

export interface FooterLineProps {
  turns: number;
  approxTokens: number;
  contextPercent: number;
  usageTotals?: UsageTotals;
  baseUrl: string;
  profileName: string | null;
  pendingApprovals: number;
}

// Dim stats row under the input frame. Carries everything the old
// Header showed that didn't move to the TopLine or the frame label.
export function FooterLine(props: FooterLineProps): React.ReactElement {
  const { theme } = useTheme();

  const segments: string[] = [];
  segments.push(`turns ${props.turns}`);
  segments.push(`ctx≈${props.approxTokens}tok (${props.contextPercent}%)`);
  const u = props.usageTotals;
  if (u && (u.inputTokens > 0 || u.outputTokens > 0)) {
    const cost = u.costUsd > 0 ? ` $${u.costUsd.toFixed(4)}` : "";
    segments.push(`${u.inputTokens}→${u.outputTokens}${cost}`);
  }
  segments.push(props.baseUrl);
  if (props.profileName) {
    segments.push(`profile ${props.profileName}`);
  }

  return (
    <Box paddingX={1} justifyContent="flex-end">
      {props.pendingApprovals > 0 ? (
        <Text color={theme.warn}>approvals {props.pendingApprovals} · </Text>
      ) : null}
      <Text color={theme.dim}>{segments.join(" · ")}</Text>
    </Box>
  );
}
