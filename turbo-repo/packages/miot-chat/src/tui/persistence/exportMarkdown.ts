import type { SessionState, TranscriptItem } from "../session/types.js";

/**
 * Render a session's transcript as a portable markdown document.
 * Pure function; no fs. The /export handler does the write.
 */
export function toMarkdown(state: SessionState): string {
  const lines: string[] = [];
  const m = state.meta;
  lines.push(`# miot-chat session ${m.conversationId.slice(0, 8)}`);
  lines.push("");
  lines.push(`- conversation_id: \`${m.conversationId}\``);
  lines.push(`- tenant: \`${m.tenantId}\``);
  lines.push(`- user: \`${m.userId}\``);
  lines.push(`- mode: \`${m.mode}\``);
  lines.push(`- baseUrl: ${m.baseUrl}`);
  if (m.profileName) lines.push(`- profile: \`${m.profileName}\``);
  lines.push("");

  const turns = splitIntoTurns(state.transcript);
  if (turns.length === 0) {
    lines.push("_(no turns)_");
    lines.push("");
    return lines.join("\n");
  }

  turns.forEach((turn, idx) => {
    lines.push(`## Turn ${idx + 1}`);
    lines.push("");
    for (const item of turn) {
      lines.push(...renderItem(item));
    }
    lines.push("");
  });

  return lines.join("\n");
}

function splitIntoTurns(items: TranscriptItem[]): TranscriptItem[][] {
  const turns: TranscriptItem[][] = [];
  let current: TranscriptItem[] = [];
  for (const item of items) {
    if (item.kind === "user") {
      if (current.length > 0) turns.push(current);
      current = [item];
    } else {
      current.push(item);
    }
  }
  if (current.length > 0) turns.push(current);
  return turns;
}

function renderItem(item: TranscriptItem): string[] {
  switch (item.kind) {
    case "user":
      return [`**you:** ${item.text}`, ""];
    case "assistant":
      return [`**miot${statusSuffix(item.status)}:** ${item.text}`, ""];
    case "tool":
      return [`> tool ${item.name} ${toolGlyph(item.status)}${item.message ? ` — ${item.message}` : ""}`];
    case "route":
      return [`> route: ${item.route}`];
    case "agent":
      return [`> agent: ${item.agent}`];
    case "thinking":
      return [`> _thinking (${item.agent}):_ ${item.text}`];
    case "plan":
      return [`> plan: ${item.message}`];
    case "freshness":
      return [`> ⚠ ${item.message}`];
    case "artifact":
      return [`> artifact: ${item.artifactKind}`];
    case "system":
      return [`> _${item.text}_`];
  }
}

function statusSuffix(status: "streaming" | "complete" | "failed"): string {
  if (status === "failed") return " (failed)";
  if (status === "streaming") return " (streaming)";
  return "";
}

function toolGlyph(status: "running" | "ok" | "failed"): string {
  if (status === "ok") return "✓";
  if (status === "failed") return "✗";
  return "…";
}
