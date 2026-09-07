import type { PendingHarnessConversation } from "./context/harness-chat-context";

export type Session = {
  id: string;
  createdAt: number;
  title: string | null;
  initialMessage: string | null;
  /** A prior question + answer to seed the thread with (no auto-send) — see
   * `PendingHarnessConversation`. */
  initialConversation: PendingHarnessConversation | null;
};

export type View = "chat" | "history";

/** A slash-command skill the composer's "/" menu can offer. */
export type HarnessSkill = {
  id: string;
  label: string;
  description: string;
};
