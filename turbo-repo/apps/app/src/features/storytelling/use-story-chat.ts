"use client";

import { useMemo } from "react";
import { useHarnessChatContext } from "@/features/harness-chat/context/harness-chat-context";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { Story } from "./storytelling.types";

type StoryRef = Pick<Story, "id" | "title" | "sourceThreadId">;

/** The ways a story hands off to the chat panel. */
export function useStoryChat(story: StoryRef | null, dict: I18nRecord) {
  const { openThread, openWithMessage, attachReference } =
    useHarnessChatContext();

  return useMemo(() => {
    if (!story) return null;
    const vars = { title: story.title, id: story.id };
    const sourceThreadId = story.sourceThreadId;
    return {
      /** The conversation the story was made in; null when it has none. */
      openConversation: sourceThreadId
        ? () => openThread(sourceThreadId)
        : null,
      /** A new chat that starts from the story. */
      continueInChat: () =>
        openWithMessage(tr("chat.continueMessage", dict, vars)),
      /** An "Ask Harness" click on one component of an HTML story. */
      askAbout: (label: string) =>
        attachReference(
          label,
          tr("chat.askAboutComponent", dict, { ...vars, label })
        ),
    };
  }, [story, dict, openThread, openWithMessage, attachReference]);
}
