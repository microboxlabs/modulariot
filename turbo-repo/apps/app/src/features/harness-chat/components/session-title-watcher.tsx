"use client";

import { useAuiState } from "@assistant-ui/react";
import { useEffect, useRef, type FC } from "react";
import {
  exchangeToTitle,
  firstMessageTitle,
  type FirstExchange,
} from "../session-title";

export const SessionTitleWatcher: FC<{
  sessionId: string;
  onTitleChange: (id: string, title: string | null) => void;
  onFirstExchange: (id: string, exchange: FirstExchange) => void;
}> = ({ sessionId, onTitleChange, onFirstExchange }) => {
  const messages = useAuiState((s) => s.thread.messages);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  // Set once a run starts here and kept until its answer is seen complete,
  // which can land a render after `isRunning` drops.
  const sawRun = useRef(false);

  useEffect(() => {
    onTitleChange(sessionId, firstMessageTitle(messages));
  }, [messages, onTitleChange, sessionId]);

  useEffect(() => {
    if (isRunning) sawRun.current = true;
    const exchange = exchangeToTitle(sawRun.current, isRunning, messages);
    if (exchange) {
      sawRun.current = false;
      onFirstExchange(sessionId, exchange);
    }
  }, [isRunning, messages, onFirstExchange, sessionId]);

  return null;
};
