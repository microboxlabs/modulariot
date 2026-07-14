import type { ComponentType } from "react";
import type { HarnessBlock, HarnessIntent } from "@/app/api/harness/search/search-blocks";

export type { HarnessBlock, HarnessIntent };

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
  /** Query intent declared by the miot-search skill — harness items only */
  intent?: HarnessIntent;
  /** Marks the synthetic "Ask Harness" prompt row — selecting it fires the search, does not close modal */
  isHarnessPrompt?: boolean;
}
