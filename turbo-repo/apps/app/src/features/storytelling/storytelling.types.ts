export type StorySource = "seed" | "ai";

export interface StoryItem {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  /** "ai" = created from the chat's `create_story` trigger. */
  readonly source: StorySource;
}
