import { Box, Text } from "ink";
import { useTheme } from "../theme/ThemeProvider.js";

export const TIPS: string[] = [
  "Tip: type / to see available commands.",
  "Tip: ctrl+r resumes a saved session.",
  "Tip: ctrl+t switches the color theme.",
  "Tip: /save stores this conversation for later.",
  "Tip: /export writes the conversation as markdown.",
];

export interface TipLineProps {
  // Deterministic rotation source (the App passes the turn count) so
  // the tip changes as the conversation advances without any timers.
  tipIndex: number;
}

export function TipLine(props: TipLineProps): React.ReactElement {
  const { theme } = useTheme();
  const tip = TIPS[props.tipIndex % TIPS.length];
  return (
    <Box paddingX={1}>
      <Text color={theme.dim}>{tip}</Text>
    </Box>
  );
}
