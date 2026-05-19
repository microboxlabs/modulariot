import { Box, Text } from "ink";
import type { SlashRegistry } from "./registry.js";

export interface PaletteProps {
  registry: SlashRegistry;
  // Query without the leading "/". Empty string is allowed; it shows all
  // commands.
  query: string;
  // Which match is highlighted. The parent owns navigation state so the
  // palette stays presentational.
  selectedIndex: number;
  // How many rows to show before truncating (default 6).
  maxRows?: number;
}

export function Palette(props: PaletteProps): React.ReactElement | null {
  const maxRows = props.maxRows ?? 6;
  const matches = props.registry.findMatches(props.query);
  if (matches.length === 0) return null;
  const visible = matches.slice(0, maxRows);
  const truncated = matches.length - visible.length;
  const cappedIndex = Math.max(
    0,
    Math.min(props.selectedIndex, visible.length - 1),
  );

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      {visible.map((cmd, i) => (
        <Text key={cmd.name} inverse={i === cappedIndex}>
          {cmd.usage.padEnd(22)} {cmd.summary}
        </Text>
      ))}
      {truncated > 0 ? (
        <Text dimColor>… {truncated} more</Text>
      ) : null}
    </Box>
  );
}
