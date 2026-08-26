"use client";

import { useEffect, type FC } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { addStory } from "@/features/storytelling/storytelling-store";
import type { CreateStoryArgs, CreateStoryResult } from "../create-story";

/**
 * Renders nothing in the chat itself — no card, no toast — but does
 * navigate the app straight to the new story once it's created. Writes the
 * story into the client-side store on mount (localStorage; there's no
 * backend for this yet — see storytelling-store.ts), then pushes to
 * /storytelling/{id}. HarnessChat is mounted at the (secured) layout level
 * (see harness-chat-mount.tsx), so this push works from any screen, not
 * just while already on /storytelling. Auto-resolves the tool call
 * immediately, same as ShowDashletCard: informational side-effect, not a
 * question, so there's nothing to wait on the user for.
 */
export const CreateStoryCard: FC<ToolCallMessagePartProps<CreateStoryArgs, CreateStoryResult>> = ({
  args,
  result,
  addResult,
}) => {
  const router = useRouter();
  const { lang } = useParams<{ lang: string }>();

  useEffect(() => {
    if (result) return;
    addStory({ id: args.id, title: args.title });
    addResult({});
    router.push(`/${lang}/storytelling/${args.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};
