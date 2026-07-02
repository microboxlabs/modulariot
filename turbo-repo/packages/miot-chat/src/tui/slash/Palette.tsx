import { Box, Text } from "ink";
import type { SlashRegistry } from "./registry.js";
import { useTheme } from "../theme/ThemeProvider.js";
import { useTerminalWidth } from "../hooks/useTerminalWidth.js";

export interface PaletteProps {
  registry: SlashRegistry;
  // Query without the leading "/". Empty string shows all commands.
  query: string;
  // Which match is highlighted. The parent owns navigation state so the
  // palette stays presentational.
  selectedIndex: number;
  // Size of the scrolling viewport (rows of commands shown at once).
  maxRows?: number;
  // Max wrapped lines of description shown per command before ellipsis.
  descLines?: number;
}

const DEFAULT_MAX_ROWS = 8;
const DEFAULT_DESC_LINES = 2;

/** Collapse whitespace and clamp to at most `lines` rows of `width`. */
function clampDescription(text: string, width: number, lines: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  const budget = Math.max(1, width * lines);
  if (collapsed.length <= budget) return collapsed;
  return `${collapsed.slice(0, Math.max(0, budget - 1)).trimEnd()}…`;
}

export function Palette(props: PaletteProps): React.ReactElement | null {
  const { theme } = useTheme();
  const columns = useTerminalWidth();
  const matches = props.registry.findMatches(props.query);
  if (matches.length === 0) return null;

  const maxRows = props.maxRows ?? DEFAULT_MAX_ROWS;
  const descLines = props.descLines ?? DEFAULT_DESC_LINES;
  const selected = Math.max(0, Math.min(props.selectedIndex, matches.length - 1));

  // Scrolling window centered on the selection — slides as you arrow
  // through, so every command is reachable (no hard "N more" cutoff).
  const startIndex = Math.max(
    0,
    Math.min(selected - Math.floor(maxRows / 2), matches.length - maxRows),
  );
  const endIndex = Math.min(startIndex + maxRows, matches.length);
  const visible = matches.slice(startIndex, endIndex);

  // Name column: the widest usage string, capped at ~35% of the terminal.
  const widestUsage = Math.max(...matches.map((c) => c.usage.length));
  const nameWidth = Math.min(
    widestUsage + 2,
    Math.max(12, Math.floor(columns * 0.35)),
  );
  // Remaining width for the wrapping description (leave a small margin).
  const descWidth = Math.max(12, columns - nameWidth - 4);

  return (
    <Box flexDirection="column">
      {startIndex > 0 ? (
        <Text color={theme.dim}>↑ {startIndex} more</Text>
      ) : null}
      {visible.map((cmd, i) => {
        const isSelected = startIndex + i === selected;
        const color = isSelected ? theme.accent : theme.dim;
        const description = cmd.summary
          ? clampDescription(cmd.summary, descWidth, descLines)
          : "";
        return (
          <Box key={cmd.name} flexDirection="row">
            <Box width={nameWidth} flexShrink={0}>
              <Text color={color} bold={isSelected} wrap="truncate">
                {cmd.usage}
              </Text>
            </Box>
            <Box width={descWidth}>
              <Text color={color} wrap="wrap">
                {description}
              </Text>
            </Box>
          </Box>
        );
      })}
      {endIndex < matches.length ? (
        <Text color={theme.dim}>↓ {matches.length - endIndex} more</Text>
      ) : null}
    </Box>
  );
}
