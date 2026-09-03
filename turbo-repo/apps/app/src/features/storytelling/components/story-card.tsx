"use client";

import Link from "next/link";
import { Dropdown, DropdownItem } from "flowbite-react";
import {
  HiCheck,
  HiEllipsisVertical,
  HiInformationCircle,
  HiShare,
  HiSparkles,
  HiTrash,
} from "react-icons/hi2";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { getArtifactTypeMeta } from "../artifact-type-meta";
import type { StoryItem } from "../storytelling.types";

interface StoryCardProps {
  readonly story: StoryItem;
  readonly lang: string;
  readonly dict: I18nRecord;
  readonly selected: boolean;
  readonly onToggleSelect: (story: StoryItem) => void;
  readonly onShare: (story: StoryItem) => void;
  readonly onDetails: (story: StoryItem) => void;
  readonly onDelete: (story: StoryItem) => void;
}

export default function StoryCard({
  story,
  lang,
  dict,
  selected,
  onToggleSelect,
  onShare,
  onDetails,
  onDelete,
}: StoryCardProps) {
  const typeMeta = getArtifactTypeMeta(story.artifactType);
  const TypeIcon = typeMeta.icon;
  const editedDate = formatDateString(
    story.updatedAt,
    "date",
    lang === "en" ? "en-US" : "es-CL"
  );

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-white transition-colors focus-within:ring-2 focus-within:ring-blue-500 dark:bg-gray-800 ${
        selected
          ? "border-blue-500 dark:border-blue-500"
          : "border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
      }`}
    >
      {/* Whole-card hit area: an invisible `after`-stretched anchor, with the
          kebab and selection square below stacking above it as later,
          positioned siblings. */}
      <Link
        href={`/${lang}/storytelling/${story.id}`}
        aria-label={story.title}
        className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-lg focus:outline-none"
      />

      <div className="flex h-40 w-full items-center justify-center bg-indigo-50 text-indigo-300 dark:bg-indigo-900/10 dark:text-indigo-500/50">
        <HiSparkles className="h-14 w-14" />
      </div>
      {/* Which previewer (previewers/html, /markdown, /ppt, /pdf) this story
          opens into. */}
      <div className="pointer-events-none absolute top-2 left-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeMeta.badgeClassName}`}
        >
          <TypeIcon className="h-3 w-3" />
          {trDynamic(typeMeta.labelKey, dict)}
        </span>
      </div>
      {/* Mass-delete selection — hidden until hovered/focused, except once
          checked (stays visible so the selection state doesn't disappear
          under the pointer). */}
      <button
        type="button"
        aria-pressed={selected}
        aria-label={tr("selection.selectAria", dict, { name: story.title })}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleSelect(story);
        }}
        className={`absolute top-2 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
          selected
            ? "border-blue-600 bg-blue-600 text-white"
            : "border-gray-300 bg-white/90 text-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:border-gray-400 dark:border-gray-500 dark:bg-gray-800/90"
        }`}
      >
        <HiCheck className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2 dark:border-gray-700">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-normal text-gray-900 dark:text-white">
            {story.title}
          </p>
          {/* Last editor + last edition date. */}
          <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
            {tr("card.editedBy", dict, { name: story.updatedBy, date: editedDate })}
          </p>
        </div>

        <div className="relative shrink-0">
          <Dropdown
            inline
            arrowIcon={false}
            label=""
            placement="bottom-end"
            // flowbite's own transition-opacity/duration-100 classes are dead
            // code here — the floating panel is conditionally MOUNTED
            // (`open && <FloatingFocusManager>`), not just opacity-toggled,
            // so there's no "from" state for a plain CSS transition to
            // animate from. `starting:` (Tailwind's @starting-style variant)
            // is what actually makes enter transitions work for elements
            // that appear via insertion rather than a class flip.
            className="w-40 origin-top-right transition-[opacity,transform] duration-150 ease-out starting:scale-95 starting:opacity-0"
            renderTrigger={() => (
              <button
                type="button"
                aria-label={tr("menu.label", dict)}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <HiEllipsisVertical className="h-5 w-5" />
              </button>
            )}
          >
            <DropdownItem icon={HiShare} onClick={() => onShare(story)}>
              {tr("menu.share", dict)}
            </DropdownItem>
            <DropdownItem icon={HiInformationCircle} onClick={() => onDetails(story)}>
              {tr("menu.details", dict)}
            </DropdownItem>
            <DropdownItem
              icon={HiTrash}
              onClick={() => onDelete(story)}
              className="text-red-600 dark:text-red-400"
            >
              {tr("menu.delete", dict)}
            </DropdownItem>
          </Dropdown>
        </div>
      </div>
    </div>
  );
}
