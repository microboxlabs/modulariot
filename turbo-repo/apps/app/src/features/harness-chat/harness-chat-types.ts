import type { PendingHarnessConversation } from "./context/harness-chat-context";

export type Session = {
  id: string;
  createdAt: number;
  title: string | null;
  initialMessage: string | null;
  /** A prior question + answer to seed the thread with (no auto-send) — see
   * `PendingHarnessConversation`. */
  initialConversation: PendingHarnessConversation | null;
  /** False for a thread someone else owns and shared with this user: readable,
   * but not theirs to rename, share on, or delete. */
  owned: boolean;
  /** Who the owner shared it with. Empty for a session that is not the
   * caller's, since a reader is not told about the other readers. */
  sharedWith: string[];
};

export type View = "chat" | "history";

/** A slash-command skill the composer's "/" menu can offer. */
export type HarnessSkill = {
  id: string;
  label: string;
  description: string;
};
