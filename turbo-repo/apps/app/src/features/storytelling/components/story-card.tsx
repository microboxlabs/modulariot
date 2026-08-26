"use client";

import Link from "next/link";
import { Dropdown, DropdownItem } from "flowbite-react";
import { HiEllipsisVertical, HiShare, HiSparkles, HiTrash } from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { StoryItem } from "../storytelling.types";

interface StoryCardProps {
  readonly story: StoryItem;
  readonly lang: string;
  readonly dict: I18nRecord;
  readonly onShare: (story: StoryItem) => void;
  readonly onDelete: (story: StoryItem) => void;
}

export default function StoryCard({ story, lang, dict, onShare, onDelete }: StoryCardProps) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-500">
      {/* Whole-card hit area: an invisible `after`-stretched anchor, with the
          kebab below stacking above it as a later, positioned sibling. */}
      <Link
        href={`/${lang}/storytelling/${story.id}`}
        aria-label={story.title}
        className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-lg focus:outline-none"
      />

      <div className="flex h-40 w-full items-center justify-center bg-indigo-50 text-indigo-300 dark:bg-indigo-900/10 dark:text-indigo-500/50">
        <HiSparkles className="h-14 w-14" />
      </div>
      {story.source === "ai" && (
        <div className="pointer-events-none absolute top-2 right-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
            <HiSparkles className="h-3 w-3" />
            {tr("card.aiGenerated", dict)}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2 dark:border-gray-700">
        <p className="min-w-0 flex-1 truncate text-sm font-normal text-gray-900 dark:text-white">
          {story.title}
        </p>

        <div className="relative shrink-0">
          <Dropdown
            inline
            arrowIcon={false}
            label=""
            placement="bottom-end"
            className="w-40"
            renderTrigger={() => (
              <button
                type="button"
                aria-label={tr("menu.label", dict)}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <HiEllipsisVertical className="h-5 w-5" />
              </button>
            )}
          >
            <DropdownItem icon={HiShare} onClick={() => onShare(story)}>
              {tr("menu.share", dict)}
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
