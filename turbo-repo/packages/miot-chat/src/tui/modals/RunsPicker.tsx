import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type {
  AssistantStatus,
  SessionState,
  TranscriptItem,
} from "../session/types.js";

export interface RunSummary {
  runId: string;
  prompt: string | null;
  status: AssistantStatus | "unknown";
}

export interface RunsPickerProps {
  runs: RunSummary[];
  onSelect: (runId: string) => void;
  onCancel: () => void;
  isFocused?: boolean;
  maxRows?: number;
}

export function RunsPicker(props: RunsPickerProps): React.ReactElement {
  const maxRows = props.maxRows ?? 10;
  const [index, setIndex] = useState(0);
  const cap = Math.max(0, props.runs.length - 1);

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
        const chosen = props.runs[Math.min(index, cap)];
        if (chosen) props.onSelect(chosen.runId);
      }
    },
    { isActive: props.isFocused ?? true },
  );

  if (props.runs.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold>recent runs</Text>
        <Text dimColor>(no runs in this session)</Text>
        <Text dimColor>esc to close</Text>
      </Box>
    );
  }

  const visible = props.runs.slice(0, maxRows);
  const truncated = props.runs.length - visible.length;

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>recent runs</Text>
      {visible.map((r, i) => (
        <Text key={r.runId} inverse={i === index}>
          {formatRow(r)}
        </Text>
      ))}
      {truncated > 0 ? <Text dimColor>… {truncated} more</Text> : null}
      <Text dimColor>↑↓ navigate · enter replay · esc cancel</Text>
    </Box>
  );
}

function formatRow(r: RunSummary): string {
  const short = r.runId.slice(0, 12);
  const status = r.status === "unknown" ? "?" : statusGlyph(r.status);
  const prompt = r.prompt ? truncate(r.prompt, 50) : "(no prompt)";
  return `${status} ${short.padEnd(12)}  ${prompt}`;
}

function statusGlyph(s: AssistantStatus): string {
  if (s === "complete") return "✓";
  if (s === "failed") return "✗";
  return "…";
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Walk the session transcript and group items by run. For each
 * assistant item that has a runId, pair it with the closest preceding
 * user prompt so the picker can show "what was asked".
 *
 * Exported for the wiring layer in T21 + unit tests here.
 */
export function summarizeRuns(state: SessionState): RunSummary[] {
  const out: RunSummary[] = [];
  const seen = new Set<string>();
  for (let i = state.transcript.length - 1; i >= 0; i -= 1) {
    const item: TranscriptItem | undefined = state.transcript[i];
    if (!item || item.kind !== "assistant") continue;
    if (seen.has(item.runId)) continue;
    seen.add(item.runId);
    const prompt = findPrecedingPrompt(state.transcript, i);
    out.push({ runId: item.runId, prompt, status: item.status });
  }
  return out;
}

function findPrecedingPrompt(
  items: TranscriptItem[],
  startAt: number,
): string | null {
  for (let i = startAt - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item && item.kind === "user") return item.text;
  }
  return null;
}
