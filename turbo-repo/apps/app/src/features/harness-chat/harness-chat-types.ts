export type Session = {
  id: string;
  createdAt: number;
  title: string | null;
  initialMessage: string | null;
  /** False for a thread someone else owns and shared with this user: readable,
   * but not theirs to rename, share on, or delete. */
  owned: boolean;
  /** Who the owner shared it with. Empty for a session that is not the
   * caller's, since a reader is not told about the other readers. */
  sharedWith: string[];
  /** True once a person named the thread, so no generated title replaces it. */
  titleEdited: boolean;
};

export type View = "chat" | "history";

/** A slash-command skill the composer's "/" menu can offer. */
export type HarnessSkill = {
  id: string;
  label: string;
  description: string;
  /** What goes after the command, e.g. `<question> => <expected answer>`. */
  usage?: string;
};
