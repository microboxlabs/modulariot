import type { ConversationTurn } from "@microboxlabs/miot-harness-client";

export type AgUiMessage = {
  id: string;
  role: "developer" | "system" | "assistant" | "user" | "tool" | "activity" | "reasoning";
  content?: unknown;
  toolCallId?: string;
};

export type RunAgentInputBody = {
  threadId?: string;
  runId?: string;
  state?: {
    harnessConversationId?: string | null;
    /** The harness's compacted memory of this thread, stored with it and
     * handed back so a restarted harness recovers it — see `conversationOf`. */
    harnessConversationSummary?: unknown;
  } | null;
  messages?: AgUiMessage[];
};

/** How many prior turns this route forwards. The harness caps and
 * token-trims again on its side; this bounds the request body. */
const MAX_REPLAY_TURNS = 20;

/** What the harness accepts as a replayed summary. */
const MAX_SUMMARY_CHARS = 8_000;

/**
 * The conversation a run belongs to, plus the context the harness needs handed
 * back with it.
 *
 * The id falls back to the AG-UI `threadId`, which the panel sets to its
 * session id. Without that fallback nothing mints one at all: `conversation_id`
 * stays null on every run and the harness answers each turn knowing nothing of
 * the last. `state.harnessConversationId` still wins when present, since that
 * is the value the harness itself echoed back.
 *
 * The prior turns come from the transcript the runtime sends with every run.
 * The harness keeps conversations in memory, so any run can be the first one
 * a freshly started harness sees; it seeds from these when it has to and
 * ignores them for a conversation it still holds. The summary is what the
 * harness compacted older turns into — the panel stores it with the thread
 * and the history adapter puts it back in state on load.
 */
export function conversationOf(
  body: RunAgentInputBody,
  messages: AgUiMessage[]
): {
  conversationId: string | null;
  replayTurns: ConversationTurn[];
  summary: string | null;
} {
  // The body is unvalidated JSON: `isValidRunAgentInputBody` checks the
  // messages, not this, so a number or an object here would otherwise be
  // forwarded as a conversation id.
  const conversationId = text(body.state?.harnessConversationId) ?? text(body.threadId);
  if (!conversationId) return { conversationId, replayTurns: [], summary: null };
  return {
    conversationId,
    replayTurns: priorTurns(messages),
    summary: text(body.state?.harnessConversationSummary)?.slice(0, MAX_SUMMARY_CHARS) ?? null,
  };
}

/**
 * Pairs each user message with the answer that followed it, up to but not
 * including the message this run is for. Only text carries over: the
 * harness's memory is a list of {user_message, assistant_answer} strings.
 */
export function priorTurns(messages: AgUiMessage[]): ConversationTurn[] {
  const current = messages.findLastIndex((m) => m.role === "user");
  const turns: ConversationTurn[] = [];
  let pendingUser: string | null = null;
  for (const message of messages.slice(0, Math.max(current, 0))) {
    const body = messageText(message);
    if (message.role === "user") {
      // Two questions in a row (the first got no answer): the later one is
      // the question the assistant actually replied to.
      pendingUser = body || pendingUser;
    } else if (message.role === "assistant" && pendingUser && body) {
      turns.push({ user_message: pendingUser, assistant_answer: body });
      pendingUser = null;
    }
  }
  return turns.slice(-MAX_REPLAY_TURNS);
}

function messageText(message: AgUiMessage): string {
  if (typeof message.content === "string") return message.content.trim();
  if (!Array.isArray(message.content)) return "";
  return message.content
    .filter(
      (part): part is { type: "text"; text: string } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string"
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
