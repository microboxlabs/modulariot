export type Session = {
  id: string;
  createdAt: number;
  title: string | null;
  initialMessage: string | null;
};

export type View = "chat" | "history";

/** A slash-command skill the composer's "/" menu can offer. */
export type HarnessSkill = {
  id: string;
  label: string;
  description: string;
};
