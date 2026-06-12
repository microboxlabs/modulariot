import { Box, Text } from "ink";
import {
  useTerminalRows,
  useTerminalWidth,
} from "../hooks/useTerminalWidth.js";
import { useTheme } from "../theme/ThemeProvider.js";

// Owl mascot rendered as braille dot-matrix art (each char encodes a
// 2x4 dot cell), generated from the brand mascot bitmap: blue
// feathers → accent, orange forehead/eye rings → warn, white facial
// disc → face (assistant token), and the dark navy outlines, pupils,
// and beak become missing dots (negative space) so the features stay
// visible even in monochrome. Rows are 22 printed columns wide.
// Empty cells use the blank braille char (U+2800), NOT ASCII spaces:
// braille glyphs are ambiguous-width and some terminal fonts render
// them off-cell, so mixing them with spaces makes row widths ragged.
// All-braille rows keep the card borders aligned in every font.
type LogoSegment = { text: string; tone: "accent" | "warn" | "face" };

const LOGO: LogoSegment[][] = [
  [
    { text: "⢀", tone: "accent" },
    { text: "⠀⠀⠀⠀⠀⠀⠀⠀", tone: "accent" },
    { text: "⣀", tone: "accent" },
    { text: "⣤⣤⣀", tone: "warn" },
    { text: "⠀⠀⠀⠀⠀⠀⠀⠀", tone: "accent" },
    { text: "⡀", tone: "accent" },
  ],
  [
    { text: "⠀", tone: "accent" },
    { text: "⢿⣶⣶⣤⣤⣰", tone: "accent" },
    { text: "⢶⣿⣿⣿⣿⣿⣿⣷", tone: "warn" },
    { text: "⣆⣤⣤⣶⣶⡿", tone: "accent" },
    { text: "⠀", tone: "accent" },
  ],
  [
    { text: "⠀", tone: "accent" },
    { text: "⠈⠛⣛⢛⣛⣛⡛⠺", tone: "accent" },
    { text: "⢿⣿⣿⡿", tone: "warn" },
    { text: "⠟⠛⣛⣛⣛⣛⠛⠁", tone: "accent" },
    { text: "⠀", tone: "accent" },
  ],
  [
    { text: "⠀", tone: "accent" },
    { text: "⢀⣿⣿", tone: "accent" },
    { text: "⣿⢟⣛⣛⢿⣦", tone: "face" },
    { text: "⣌⣡", tone: "accent" },
    { text: "⣴⡾⣛⣛⡿⣿", tone: "face" },
    { text: "⣿⣷", tone: "accent" },
    { text: "⠀⠀", tone: "accent" },
  ],
  [
    { text: "⠀", tone: "accent" },
    { text: "⣸⣿", tone: "accent" },
    { text: "⣿", tone: "face" },
    { text: "⢳", tone: "accent" },
    { text: "⡿", tone: "warn" },
    { text: "⡯", tone: "accent" },
    { text: "⠙⣷", tone: "warn" },
    { text: "⢻⣿⣿⡟", tone: "face" },
    { text: "⣾⠋", tone: "warn" },
    { text: "⢽", tone: "accent" },
    { text: "⢻", tone: "warn" },
    { text: "⣽", tone: "accent" },
    { text: "⣿", tone: "face" },
    { text: "⣿⡇", tone: "accent" },
    { text: "⠀", tone: "accent" },
  ],
  [
    { text: "⠀", tone: "accent" },
    { text: "⢻⣿", tone: "accent" },
    { text: "⣿", tone: "face" },
    { text: "⡜⣧⣀⣠⡿", tone: "warn" },
    { text: "⣼⡿⣿⣧", tone: "face" },
    { text: "⢿⣄⣠⡾", tone: "warn" },
    { text: "⣻", tone: "accent" },
    { text: "⣿", tone: "face" },
    { text: "⣿⡇", tone: "accent" },
    { text: "⠀", tone: "accent" },
  ],
  [
    { text: "⠀", tone: "accent" },
    { text: "⠘⣿⣿", tone: "accent" },
    { text: "⣿⣶⣯⣷⣾⡟", tone: "face" },
    { text: "⠁⣬", tone: "accent" },
    { text: "⣻⣷⣾⣿⣾⣿", tone: "face" },
    { text: "⣿⡿", tone: "accent" },
    { text: "⠀⠀", tone: "accent" },
  ],
  [
    { text: "⠀⠀", tone: "accent" },
    { text: "⠘⢿⣿⣿", tone: "accent" },
    { text: "⣿⣿⣿⣿", tone: "face" },
    { text: "⡄⢡", tone: "accent" },
    { text: "⣿⣿⣿⣿", tone: "face" },
    { text: "⣿⣿⠟⠁", tone: "accent" },
    { text: "⠀⠀", tone: "accent" },
  ],
  [
    { text: "⠀⠀⠀⠀", tone: "accent" },
    { text: "⠙⠻⢿⣿⣿", tone: "accent" },
    { text: "⣿⣿⣿⣿", tone: "face" },
    { text: "⣿⣿⡿⠟⠁", tone: "accent" },
    { text: "⠀⠀⠀⠀", tone: "accent" },
  ],
  [
    { text: "⠀⠀⠀⠀⠀⠀⠀", tone: "accent" },
    { text: "⠈⠙⠛⠛⠛⠛⠉⠁", tone: "accent" },
    { text: "⠀⠀⠀⠀⠀⠀⠀", tone: "accent" },
  ],
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

// Rows of fixed chrome around the welcome area: top line, tip line,
// the 3-row input frame, and the footer line.
const CHROME_ROWS = 6;
// Card height: 2 border + 2 padding + 10 logo rows.
const CARD_ROWS = 14;

// Startup screen shown while the transcript is empty, grok-style:
// the card (logo on the left, title + shortcut menu on the right)
// floats in the center of the free vertical space.
export function WelcomeCard(props: WelcomeCardProps): React.ReactElement {
  const cols = useTerminalWidth();
  const rows = useTerminalRows();
  const { theme } = useTheme();
  return (
    <Box
      flexDirection="column"
      justifyContent="center"
      height={Math.max(CARD_ROWS + 1, rows - CHROME_ROWS)}
    >
      <Box
        borderStyle="round"
        borderColor={theme.border}
        width={Math.min(cols, 64)}
        alignSelf="center"
        paddingX={2}
        paddingY={1}
        flexDirection="row"
      >
        <Box flexDirection="column" marginRight={3}>
          {LOGO.map((row, i) => (
            <Text key={i}>
              {row.map((seg, j) => (
                <Text
                  key={j}
                  color={
                    seg.tone === "warn"
                      ? theme.warn
                      : seg.tone === "face"
                        ? theme.assistant
                        : theme.accent
                  }
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
            <Text color={theme.dim}> v{props.version}</Text>
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
    </Box>
  );
}
