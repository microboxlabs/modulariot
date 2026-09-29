import { Box, Text } from "ink";
import { useTerminalWidth } from "../hooks/useTerminalWidth.js";
import { useTheme } from "../theme/ThemeProvider.js";

export interface InputFrameProps {
  // Status label embedded in the bottom border, e.g. "miot · default model".
  label: string;
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
      <BottomBorder cols={cols} label={props.label} />
    </Box>
  );
}

function BottomBorder(props: {
  cols: number;
  label: string;
}): React.ReactElement {
  const { theme } = useTheme();
  const labelText = ` ${props.label} `;
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
      <Text color={theme.dim}>{labelText}</Text>
      <Text color={theme.border}>──╯</Text>
    </Text>
  );
}
