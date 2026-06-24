import type { ComponentType } from "react";

export type SpotlightResultKind = "navigate" | "harness";

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
}
