"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import SectionMenu, {
  type SectionMenuEntry,
} from "@/features/common/components/section-menu";
import type { PlatformSection } from "./platform.types";

export type PlatformSectionEntry = SectionMenuEntry<PlatformSection>;

interface PlatformSectionListProps {
  readonly sections: readonly PlatformSectionEntry[];
  readonly selected: PlatformSection;
  readonly onSelect: (section: PlatformSection) => void;
  readonly dict: I18nRecord;
}

/** Left-column menu for Settings › Platform, styled like the organization list beside it. */
export default function PlatformSectionList({
  sections,
  selected,
  onSelect,
  dict,
}: PlatformSectionListProps) {
  return (
    <SectionMenu
      title={tr("listTitle", dict)}
      sections={sections}
      selected={selected}
      onSelect={onSelect}
    />
  );
}
