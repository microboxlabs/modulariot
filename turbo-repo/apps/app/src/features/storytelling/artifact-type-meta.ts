import type { IconType } from "react-icons";
import {
  HiGlobeAlt,
  HiHashtag,
  HiOutlineDocumentText,
  HiOutlinePresentationChartBar,
} from "react-icons/hi2";
import type { ArtifactType } from "./storytelling.types";

export interface ArtifactTypeMeta {
  readonly labelKey: string;
  readonly icon: IconType;
  readonly badgeClassName: string;
}

/** Per-type badge shown on story cards (story-card.tsx) — icon, i18n label
 * key (storytelling.artifactType.*), and a distinct color per type so the
 * four previewer kinds (previewers/html, /markdown, /ppt, /pdf) are visually
 * distinguishable at a glance in the grid. */
export const ARTIFACT_TYPE_META: Record<ArtifactType, ArtifactTypeMeta> = {
  html: {
    labelKey: "artifactType.html",
    icon: HiGlobeAlt,
    badgeClassName: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  markdown: {
    labelKey: "artifactType.markdown",
    icon: HiHashtag,
    badgeClassName: "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
  },
  ppt: {
    labelKey: "artifactType.ppt",
    icon: HiOutlinePresentationChartBar,
    badgeClassName: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  pdf: {
    labelKey: "artifactType.pdf",
    icon: HiOutlineDocumentText,
    badgeClassName: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

/**
 * Safe accessor — `story.artifactType` is typed as always-present, but
 * that's not actually guaranteed at runtime: StoryItem is persisted to
 * localStorage un-validated, so any story saved before this field existed
 * still comes back with it `undefined`. Falls back to "html", the only type
 * that ever existed before artifactType was added.
 */
export function getArtifactTypeMeta(artifactType: ArtifactType | undefined): ArtifactTypeMeta {
  return ARTIFACT_TYPE_META[artifactType ?? "html"] ?? ARTIFACT_TYPE_META.html;
}
