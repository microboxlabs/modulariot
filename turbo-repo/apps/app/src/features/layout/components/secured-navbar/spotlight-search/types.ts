import type { ComponentType } from "react";
import type { HarnessBlock } from "@/app/api/harness/search/route";

export type { HarnessBlock };

export type SpotlightResultKind = "navigate" | "harness" | "harness-goto";

export interface SpotlightItem {
  id: string;
  label: string;
  /** Secondary descriptor — e.g. parent section name for navigate items */
  sublabel?: string;
  kind: SpotlightResultKind;
  icon?: ComponentType<{ className?: string }>;
  /** Extra tokens used for instant fuzzy matching (navigate items) */
  keywords: string[];
  onSelect: () => void;
  /** Section-header rows rendered as group labels — skipped by keyboard nav */
  isGroupHeader?: boolean;
  /** Structured answer blocks — harness items only */
  blocks?: HarnessBlock[];
  /** Marks the synthetic "Ask Harness" prompt row — selecting it fires the search, does not close modal */
  isHarnessPrompt?: boolean;
}
