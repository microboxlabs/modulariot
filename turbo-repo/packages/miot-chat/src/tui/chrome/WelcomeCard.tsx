import { Box, Text } from "ink";
import { useTerminalWidth } from "../hooks/useTerminalWidth.js";
import { useTheme } from "../theme/ThemeProvider.js";

// Quadrant-block "M" mark. Keep every row the same printed width so
// the right column lines up.
const LOGO: string[] = [
  "▛▖ ▗▜",
  "▌▝▄▘▐",
  "▌   ▐",
  "▘   ▝",
];

const MENU: Array<{ label: string; shortcut: string }> = [
  { label: "Resume session", shortcut: "ctrl+r" },
  { label: "Switch theme", shortcut: "ctrl+t" },
  { label: "Help", shortcut: "ctrl+g  (/help)" },
  { label: "Quit", shortcut: "ctrl+q" },
];

export interface WelcomeCardProps {
  version: string;
}

// Startup card shown while the transcript is empty, grok-style:
// logo on the left, title + shortcut menu on the right.
export function WelcomeCard(props: WelcomeCardProps): React.ReactElement {
  const cols = useTerminalWidth();
  const { theme } = useTheme();
  return (
    <Box
      borderStyle="round"
      borderColor={theme.border}
      width={Math.min(cols, 64)}
      paddingX={2}
      paddingY={1}
      marginTop={1}
      flexDirection="row"
    >
      <Box flexDirection="column" marginRight={3}>
        {LOGO.map((row, i) => (
          <Text key={i} color={theme.accent}>
            {row}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        <Box>
          <Text color={theme.accent} bold>
            miot chat
          </Text>
          <Text color={theme.dim}>  v{props.version}</Text>
        </Box>
        <Box height={1} />
        {MENU.map((item) => (
          <Box key={item.label} justifyContent="space-between">
            <Text>{item.label}</Text>
            <Text color={theme.dim}>{item.shortcut}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
