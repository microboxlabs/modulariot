import type { SessionState, TranscriptItem } from "./types.js";

export function isStreaming(state: SessionState): boolean {
  return state.currentRunId !== null;
}

export function pendingApprovalCount(state: SessionState): number {
  return state.pendingApprovals.length;
}

export function shortConversationId(state: SessionState): string {
  return state.meta.conversationId.slice(0, 8);
}

export function latestAssistantText(state: SessionState): string | null {
  for (let i = state.transcript.length - 1; i >= 0; i -= 1) {
    const item: TranscriptItem | undefined = state.transcript[i];
    if (item && item.kind === "assistant") return item.text;
  }
  return null;
}

export function turnCount(state: SessionState): number {
  return state.transcript.filter((i) => i.kind === "user").length;
}

/**
 * Rough token estimate for the conversation so far. Counts the text-
 * carrying body of each transcript item and applies the common ~4
 * chars/token heuristic. Not authoritative — the harness would have
 * the real number — but enough to give the user a sense of context
 * usage without an extra API roundtrip.
 */
export function approxTokenCount(state: SessionState): number {
  let chars = 0;
  for (const item of state.transcript) {
    switch (item.kind) {
      case "user":
      case "system":
        chars += item.text.length;
        break;
      case "assistant":
        chars += item.text.length;
        break;
      case "tool":
        chars += item.name.length + (item.message?.length ?? 0);
        break;
      case "route":
        chars += item.route.length;
        break;
      case "agent":
        chars += item.agent.length;
        break;
      case "plan":
      case "freshness":
        chars += item.message.length;
        break;
      case "artifact":
        chars += item.artifactKind.length;
        break;
    }
  }
  return Math.ceil(chars / 4);
}

/**
 * Assumed model context window (in tokens). 200K matches modern
 * Claude defaults. Used only as the denominator for the "ctx %"
 * chip — when the harness exposes the real budget we'll wire it
 * through.
 */
export const ASSUMED_CONTEXT_WINDOW = 200_000;

export function contextPercent(state: SessionState): number {
  return Math.min(
    100,
    Math.round((approxTokenCount(state) / ASSUMED_CONTEXT_WINDOW) * 100),
  );
}
