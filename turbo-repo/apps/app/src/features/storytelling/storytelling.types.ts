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
  /** Display name of whoever first created the story — "Harness AI" for
   * anything the chat's `create_story` trigger produced. */
  readonly createdBy: string;
  /** ISO date (YYYY-MM-DD) of the most recent edit. */
  readonly updatedAt: string;
  /** Display name of whoever last edited the story. */
  readonly updatedBy: string;
  /** "ai" = created from the chat's `create_story` trigger. */
  readonly source: StorySource;
  readonly artifactType: ArtifactType;
  /** Only for artifactType "ppt" — the deck's actual content. */
  readonly deck?: DeckContent;
}

/** What an invited person (or a link) is allowed to do with a story. */
export type ShareRole = "viewer" | "editor";

/**
 * Link-level access, mirroring Google Docs / Notion's "general access":
 * - "restricted" — only explicitly invited people can open the story
 * - "viewer" / "editor" — anyone with the link can, at that role
 */
export type LinkAccess = "restricted" | ShareRole;

/** One person that's been granted access to a story via the share panel. */
export interface ShareRecipient {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: ShareRole;
}

/**
 * Per-story sharing state. Frontend-only (localStorage) like the rest of
 * storytelling — there's no backend to actually enforce any of this yet, so
 * the panel is a faithful mock of the real sharing flow.
 */
export interface StoryShareState {
  readonly people: readonly ShareRecipient[];
  readonly linkAccess: LinkAccess;
}
