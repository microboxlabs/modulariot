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
