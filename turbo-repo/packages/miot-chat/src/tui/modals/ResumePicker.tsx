import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { SessionSummary } from "../persistence/store.js";

export interface ResumePickerProps {
  summaries: SessionSummary[];
  onSelect: (conversationId: string) => void;
  onCancel: () => void;
  isFocused?: boolean;
  maxRows?: number;
}

export function ResumePicker(
  props: ResumePickerProps,
): React.ReactElement {
  const maxRows = props.maxRows ?? 10;
  const [index, setIndex] = useState(0);
  const summaries = props.summaries;
  const cap = Math.max(0, summaries.length - 1);

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
        const chosen = summaries[Math.min(index, cap)];
        if (chosen) props.onSelect(chosen.id);
      }
    },
    { isActive: props.isFocused ?? true },
  );

  if (summaries.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold>resume session</Text>
        <Text dimColor>(no saved sessions)</Text>
        <Text dimColor>esc to close</Text>
      </Box>
    );
  }

  const visible = summaries.slice(0, maxRows);
  const truncated = summaries.length - visible.length;

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>resume session</Text>
      {visible.map((s, i) => (
        <Text key={s.id} inverse={i === index}>
          {summarize(s)}
        </Text>
      ))}
      {truncated > 0 ? <Text dimColor>… {truncated} more</Text> : null}
      <Text dimColor>↑↓ navigate · enter select · esc cancel</Text>
    </Box>
  );
}

function summarize(s: SessionSummary): string {
  const idShort = s.id.slice(0, 8);
  const turns = `${s.lastTurn} turn${s.lastTurn === 1 ? "" : "s"}`;
  const date = new Date(s.mtime).toISOString().slice(0, 16).replace("T", " ");
  const prompt = s.lastPrompt ? truncate(s.lastPrompt, 40) : "(empty)";
  return `${date}  ${idShort}  ${turns.padEnd(8)}  ${prompt}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
