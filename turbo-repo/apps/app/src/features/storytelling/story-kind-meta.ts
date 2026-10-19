import type { IconType } from "react-icons";
import {
  HiGlobeAlt,
  HiHashtag,
  HiOutlineDocumentText,
  HiOutlinePhoto,
  HiOutlinePresentationChartBar,
  HiOutlineQueueList,
} from "react-icons/hi2";
import type { StoryKind } from "./storytelling.types";

export interface StoryKindMeta {
  readonly labelKey: string;
  readonly icon: IconType;
  readonly badgeClassName: string;
}

/** Per-kind badge on story cards: icon, i18n key (storytelling.kind.*) and color. */
export const STORY_KIND_META: Record<StoryKind, StoryKindMeta> = {
  html: {
    labelKey: "kind.html",
    icon: HiGlobeAlt,
    badgeClassName:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  markdown: {
    labelKey: "kind.markdown",
    icon: HiHashtag,
    badgeClassName:
      "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
  },
  deck: {
    labelKey: "kind.deck",
    icon: HiOutlinePresentationChartBar,
    badgeClassName:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  pdf: {
    labelKey: "kind.pdf",
    icon: HiOutlineDocumentText,
    badgeClassName:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  svg: {
    labelKey: "kind.svg",
    icon: HiOutlinePhoto,
    badgeClassName:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  sections: {
    labelKey: "kind.sections",
    icon: HiOutlineQueueList,
    badgeClassName:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
};

/** Unknown kinds (a newer server) fall back to the Markdown badge. */
export function getStoryKindMeta(kind: string): StoryKindMeta {
  return STORY_KIND_META[kind as StoryKind] ?? STORY_KIND_META.markdown;
}
