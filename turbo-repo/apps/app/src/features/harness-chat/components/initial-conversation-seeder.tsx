"use client";

import { ExportedMessageRepository, useAui } from "@assistant-ui/react";
import { useEffect, useRef, type FC } from "react";
import type { PendingHarnessConversation } from "../context/harness-chat-context";

/**
 * Seeds a freshly-opened session with a prior question + answer (e.g. handed
 * off from the spotlight search) by importing it straight into the thread's
 * message repository — unlike `InitialMessageSender`, this never calls
 * `composer.send()`, so no new harness run fires. The user picks the
 * conversation back up by typing their own next message.
 */
export const InitialConversationSeeder: FC<{
  conversation: PendingHarnessConversation | null;
}> = ({ conversation }) => {
  const aui = useAui();
  const seededRef = useRef(false);

  useEffect(() => {
    if (!conversation || seededRef.current) return;
    seededRef.current = true;
    aui.thread.import(
      ExportedMessageRepository.fromArray([
        { role: "user", content: conversation.userText },
        { role: "assistant", content: conversation.answerText },
      ]),
    );
  }, [conversation, aui]);

  return null;
};
