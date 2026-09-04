"use client";

import { useAuiState } from "@assistant-ui/react";
import { useEffect, type FC } from "react";

export const SessionTitleWatcher: FC<{
  sessionId: string;
  onTitleChange: (id: string, title: string | null) => void;
}> = ({ sessionId, onTitleChange }) => {
  const messages = useAuiState((s) => s.thread.messages);

  useEffect(() => {
    const firstUser = messages.find((m) => m.role === "user");
    const text = firstUser?.content.find((part) => part.type === "text")?.text;
    onTitleChange(sessionId, text?.trim() ? text : null);
  }, [messages, onTitleChange, sessionId]);

  return null;
};
