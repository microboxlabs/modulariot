"use client";

import type { ReactNode } from "react";
import { HiSparkles } from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { Story } from "../storytelling.types";
import StoryCard from "./story-card";

interface StoryGridProps {
  readonly stories: readonly Story[];
  readonly lang: string;
  readonly dict: I18nRecord;
  /** Shown instead of the grid when there are no stories. */
  readonly empty: ReactNode;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggleSelect: (story: Story) => void;
  readonly onDetails: (story: Story) => void;
  readonly onRename: (story: Story) => void;
  readonly onDelete: (story: Story) => void;
}

export default function StoryGrid({
  stories,
  lang,
  dict,
  empty,
  selectedIds,
  onToggleSelect,
  onDetails,
  onRename,
  onDelete,
}: StoryGridProps) {
  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <HiSparkles className="h-10 w-10 text-gray-300 dark:text-gray-600" />
        {empty}
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
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
