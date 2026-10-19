export const STORY_KINDS = [
  "markdown",
  "html",
  "svg",
  "deck",
  "pdf",
  "sections",
] as const;

export type StoryKind = (typeof STORY_KINDS)[number];

export type StoryPermission = "owner" | "write" | "read";

export type SharePermission = "read" | "write";

export interface ShareEntry {
  readonly principal: string;
  readonly permission: SharePermission;
}

/** One version of a story. `content` is text (base64 for a PDF); `metadata`
 * holds a deck's or a sectioned story's structure. Listings leave both out. */
export interface StoryVersion {
  readonly id: string;
  readonly storyId: string;
  readonly parentId: string | null;
  readonly label: string;
  readonly summary: string | null;
  readonly contentType: string | null;
  readonly content: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: string;
  readonly createdBy: string;
}

/** A story as the caller sees it. `sharedWith` is filled for the owner only;
 * `currentVersion` only when reading one story. */
export interface Story {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly kind: StoryKind;
  readonly ownerId: string;
  readonly owned: boolean;
  readonly permission: StoryPermission;
  readonly sourceThreadId: string | null;
  readonly sourceMessageId: string | null;
  readonly currentVersionId: string | null;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
  readonly sharedWith: readonly ShareEntry[] | null;
  readonly currentVersion: StoryVersion | null;
}

export interface VersionInput {
  readonly parentId?: string;
  readonly label?: string;
  readonly summary?: string;
  readonly contentType?: string;
  readonly content?: string;
  readonly metadata?: Record<string, unknown>;
}

/** One slide of a deck. The in-app slide viewer and the .pptx built on
 * download (api/storytelling/generate-pptx) render from this same shape. */
export type DeckSlide =
  | {
      readonly type: "title";
      readonly title: string;
      readonly subtitle?: string;
    }
  | {
      readonly type: "bullets";
      readonly title: string;
      readonly items: readonly string[];
    }
  | {
      readonly type: "table";
      readonly title: string;
      readonly headers: readonly string[];
      readonly rows: readonly (readonly string[])[];
    };

export interface DeckContent {
  readonly slides: readonly DeckSlide[];
}

/** One block of a sectioned story. `chart.option` is an ECharts option. */
export type StorySection =
  | { readonly type: "heading"; readonly text: string; readonly level?: number }
  | { readonly type: "text"; readonly text: string }
  | {
      readonly type: "metric";
      readonly label: string;
      readonly value: string | number;
      readonly unit?: string;
      readonly delta?: string;
    }
  | { readonly type: "quote"; readonly text: string; readonly author?: string }
  | {
      readonly type: "chart";
      readonly title?: string;
      readonly option?: Record<string, unknown>;
    }
  | {
      readonly type: "table";
      readonly title?: string;
      readonly headers: readonly string[];
      readonly rows: readonly (readonly (string | number)[])[];
    };
