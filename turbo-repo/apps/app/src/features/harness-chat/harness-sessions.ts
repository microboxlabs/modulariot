import type { PendingHarnessConversation } from "./context/harness-chat-context";
import type { Session } from "./harness-chat-types";
import type { StoredThread } from "./harness-thread-store";

export function createSession(
  initialMessage: string | null = null,
  initialConversation: PendingHarnessConversation | null = null
): Session {
  return {
    // A UUID, not any id: it is stored as the thread's primary key and sent to
    // the harness as the conversation id.
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    title: null,
    initialMessage,
    initialConversation,
    owned: true,
    sharedWith: [],
    titleEdited: false,
  };
}

/** Keeps whatever the panel already has — the fresh session it opened with,
 * and anything started since the fetch went out — and appends the rest. */
export function mergeStoredThreads(
  current: Session[],
  threads: StoredThread[]
): Session[] {
  const known = new Set(current.map((session) => session.id));
  return [
    ...current,
    ...threads.filter((t) => !known.has(t.id)).map(toSession),
  ];
}

export function toSession(thread: StoredThread): Session {
  return {
    id: thread.id,
    createdAt: Date.parse(thread.lastMessageAt ?? thread.createdAt),
    title: thread.title,
    initialMessage: null,
    initialConversation: null,
    owned: thread.owned,
    sharedWith: thread.sharedWith ?? [],
    titleEdited: thread.titleEdited ?? false,
  };
}
