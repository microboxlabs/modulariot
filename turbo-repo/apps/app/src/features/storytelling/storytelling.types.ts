export type StorySource = "seed" | "ai";

/** Which previewer (src/features/storytelling/components/previewers/) renders this story's artifact. */
export type ArtifactType = "html" | "ppt" | "pdf" | "markdown";

/** One slide of a "ppt" story's deck — structured content, not a file. Both
 * the in-app slide viewer (previewers/ppt) and the real .pptx generated on
 * download (api/storytelling/generate-pptx) render from this same shape, so
 * they can't drift out of sync with each other. */
export type DeckSlide =
  | { readonly type: "title"; readonly title: string; readonly subtitle?: string }
  | { readonly type: "bullets"; readonly title: string; readonly items: readonly string[] }
  | {
      readonly type: "table";
      readonly title: string;
      readonly headers: readonly string[];
      readonly rows: readonly (readonly string[])[];
    };

export interface DeckContent {
  readonly slides: readonly DeckSlide[];
}

export interface StoryItem {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  /** "ai" = created from the chat's `create_story` trigger. */
  readonly source: StorySource;
  readonly artifactType: ArtifactType;
  /** Only for artifactType "ppt" — the deck's actual content. */
  readonly deck?: DeckContent;
}
