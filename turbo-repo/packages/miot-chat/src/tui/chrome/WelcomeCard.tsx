import { Box, Text } from "ink";
import { useTerminalWidth } from "../hooks/useTerminalWidth.js";
import { useTheme } from "../theme/ThemeProvider.js";

// Owl mascot in block art. Each row is a list of colored segments;
// the forehead triangle and the eyes take the warn (orange) token,
// matching the brand mascot. Keep every row the same printed width
// so the right column lines up.
type LogoSegment = { text: string; tone: "accent" | "warn" };

const LOGO: LogoSegment[][] = [
  [
    { text: " ◢", tone: "accent" },
    { text: "▲", tone: "warn" },
    { text: "◣ ", tone: "accent" },
  ],
  [
    { text: "▐", tone: "accent" },
    { text: "◉ ◉", tone: "warn" },
    { text: "▌", tone: "accent" },
  ],
  [{ text: "▐ ▼ ▌", tone: "accent" }],
  [{ text: " ◥▄◤ ", tone: "accent" }],
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
      alignSelf="center"
      paddingX={2}
      paddingY={1}
      marginTop={1}
      flexDirection="row"
    >
      <Box flexDirection="column" marginRight={3}>
        {LOGO.map((row, i) => (
          <Text key={i}>
            {row.map((seg, j) => (
              <Text
                key={j}
                color={seg.tone === "warn" ? theme.warn : theme.accent}
              >
                {seg.text}
              </Text>
            ))}
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
