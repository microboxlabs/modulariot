import { Box, Text } from "ink";
import { useTerminalWidth } from "../hooks/useTerminalWidth.js";
import { useTheme } from "../theme/ThemeProvider.js";

export interface InputFrameProps {
  // Status label embedded in the bottom border, e.g. "miot · auto".
  label: string;
  // Render the label in the warn color with a ⚠ prefix (agentic
  // tenant mismatch).
  labelWarn?: boolean;
  children: React.ReactNode;
}

// Bordered editor frame, grok-style: Ink draws the top and side
// borders; the bottom border is a hand-built row so the label can sit
// inside the line (Ink cannot embed text in a border edge). Both the
// Box and the manual row derive their width from the same hook so
// they stay aligned across resizes.
export function InputFrame(props: InputFrameProps): React.ReactElement {
  const cols = useTerminalWidth();
  const { theme } = useTheme();
  return (
    <Box flexDirection="column" width={cols}>
      <Box
        borderStyle="round"
        borderColor={theme.border}
        borderBottom={false}
        paddingX={1}
      >
        {props.children}
      </Box>
      <BottomBorder
        cols={cols}
        label={props.label}
        warn={props.labelWarn ?? false}
      />
    </Box>
  );
}

function BottomBorder(props: {
  cols: number;
  label: string;
  warn: boolean;
}): React.ReactElement {
  const { theme } = useTheme();
  const visibleLabel = props.warn ? `⚠ ${props.label}` : props.label;
  const labelText = ` ${visibleLabel} `;
  // corners (2) + fill + label + trailing "──" must equal cols.
  const fill = props.cols - 2 - labelText.length - 2;

  if (fill < 1) {
    return (
      <Text color={theme.border}>
        ╰{"─".repeat(Math.max(0, props.cols - 2))}╯
      </Text>
    );
  }

  return (
    <Text>
      <Text color={theme.border}>╰{"─".repeat(fill)}</Text>
      <Text color={props.warn ? theme.warn : theme.dim}>{labelText}</Text>
      <Text color={theme.border}>──╯</Text>
    </Text>
  );
}
