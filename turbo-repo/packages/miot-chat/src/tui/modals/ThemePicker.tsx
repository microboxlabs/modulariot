import { Box, Text, useInput } from "ink";
import { useState } from "react";
import {
  BUILTIN_THEMES,
  builtinThemeNames,
} from "../theme/themes.js";

export interface ThemePickerProps {
  onSelect: (name: string) => void;
  onCancel: () => void;
  initialName?: string;
  isFocused?: boolean;
}

export function ThemePicker(props: ThemePickerProps): React.ReactElement {
  const names = builtinThemeNames();
  const initial = props.initialName
    ? Math.max(0, names.indexOf(props.initialName))
    : 0;
  const [index, setIndex] = useState(initial);
  const cap = names.length - 1;

  useInput(
    (_input, key) => {
      if (key.escape) {
        props.onCancel();
        return;
      }
      if (key.upArrow) {
        setIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setIndex((i) => Math.min(cap, i + 1));
        return;
      }
      if (key.return) {
        const name = names[Math.min(index, cap)];
        if (name) props.onSelect(name);
      }
    },
    { isActive: props.isFocused ?? true },
  );

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>theme</Text>
      {names.map((name, i) => {
        const t = BUILTIN_THEMES[name];
        const sample = t ? `accent=${t.accent} user=${t.user}` : "";
        return (
          <Text key={name} inverse={i === index}>
            {name.padEnd(15)} {sample}
          </Text>
        );
      })}
      <Text dimColor>↑↓ navigate · enter apply · esc cancel</Text>
    </Box>
  );
}
