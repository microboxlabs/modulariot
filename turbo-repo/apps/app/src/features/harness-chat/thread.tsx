"use client";

import { AuiIf, ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
import { LuPaperclip } from "react-icons/lu";
import type { FC } from "react";
import { ThreadEmpty, UserMessage, AssistantMessage } from "./components/thread-messages";
import { Composer } from "./components/composer";
import { RunCancelProvider } from "./context/run-cancel-context";
import type { HarnessSkill } from "./harness-chat-types";

export const Thread: FC<{ skills: HarnessSkill[] }> = ({ skills }) => {
  return (
    <RunCancelProvider>
      <ComposerPrimitive.AttachmentDropzone className="group relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-2 z-20 hidden flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-400 bg-white/90 text-xs font-medium text-gray-600 group-data-[dragging=true]:flex dark:border-gray-500 dark:bg-gray-800/90 dark:text-gray-300">
          <LuPaperclip className="h-5 w-5" />
          Drop to attach
        </div>

        <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
          <ThreadPrimitive.Viewport className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
            <AuiIf condition={(s) => s.thread.isEmpty}>
              <ThreadEmpty />
            </AuiIf>

            <ThreadPrimitive.Messages
              components={{
                UserMessage,
                AssistantMessage,
              }}
            />
          </ThreadPrimitive.Viewport>

          <Composer skills={skills} />
        </ThreadPrimitive.Root>
      </ComposerPrimitive.AttachmentDropzone>
    </RunCancelProvider>
  );
};
