"use client";

import { HiSparkles } from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { StoryItem } from "../storytelling.types";
import StoryCard from "./story-card";

interface StoryGridProps {
  readonly stories: readonly StoryItem[];
  readonly lang: string;
  readonly dict: I18nRecord;
  readonly emptyMessage: string;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggleSelect: (story: StoryItem) => void;
  readonly onDetails: (story: StoryItem) => void;
  readonly onDelete: (story: StoryItem) => void;
}

export default function StoryGrid({
  stories,
  lang,
  dict,
  emptyMessage,
  selectedIds,
  onToggleSelect,
  onDetails,
  onDelete,
}: StoryGridProps) {
  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <HiSparkles className="h-10 w-10 text-gray-300 dark:text-gray-600" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          story={story}
          lang={lang}
          dict={dict}
          selected={selectedIds.has(story.id)}
          onToggleSelect={onToggleSelect}
          onDetails={onDetails}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
