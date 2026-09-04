"use client";

import { useEffect, useState, type FC } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { HiChevronRight } from "react-icons/hi2";
import { addStoriesForAllTypes } from "@/features/storytelling/storytelling-store";
import { getArtifactTypeMeta } from "@/features/storytelling/artifact-type-meta";
import type { ArtifactType, StoryItem } from "@/features/storytelling/storytelling.types";
import { useHarnessChatTr } from "../../context/harness-chat-i18n-context";
import type { CreateStoryArgs, CreateStoryResult } from "../create-story";

/** create_story doesn't generate real per-type content yet, so one call
 * produces one demo story per previewer type (see
 * storytelling-store.ts:addStoriesForAllTypes) — this label is the only
 * thing telling otherwise-identically-titled cards apart. */
function typeLabel(artifactType: ArtifactType, tr: ReturnType<typeof useHarnessChatTr>): string {
  switch (artifactType) {
    case "html":
      return tr("storytelling.artifactType.html");
    case "ppt":
      return tr("storytelling.artifactType.ppt");
    case "pdf":
      return tr("storytelling.artifactType.pdf");
    case "markdown":
      return tr("storytelling.artifactType.markdown");
  }
}

/**
 * Writes the stories into the client-side store on mount (localStorage;
 * there's no backend for this yet — see storytelling-store.ts), one per
 * artifact type. Used to auto-navigate straight to the new story; now shows
 * a clickable card per type in the chat instead, so opening one is the
 * user's choice, not something that happens to them mid-conversation.
 * Auto-resolves the tool call immediately either way — informational
 * side-effect, not a question, so there's nothing to wait on the user for.
 */
export const CreateStoryCard: FC<ToolCallMessagePartProps<CreateStoryArgs, CreateStoryResult>> = ({
  args,
  result,
  addResult,
}) => {
  const router = useRouter();
  const { lang } = useParams<{ lang: string }>();
  const tr = useHarnessChatTr();
  const [stories, setStories] = useState<readonly StoryItem[]>([]);

  useEffect(() => {
    if (result) return;
    setStories(addStoriesForAllTypes({ id: args.id, title: args.title }));
    addResult({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (stories.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      {stories.map((story) => {
        const typeMeta = getArtifactTypeMeta(story.artifactType);
        const TypeIcon = typeMeta.icon;
        return (
          <button
            key={story.id}
            type="button"
            onClick={() => router.push(`/${lang}/storytelling/${story.id}`)}
            className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${typeMeta.badgeClassName}`}
            >
              <TypeIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                {story.title} — {typeLabel(story.artifactType, tr)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tr("harnessChat.ui.createStory.open")}
              </p>
            </div>
            <HiChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        );
      })}
    </div>
  );
};
