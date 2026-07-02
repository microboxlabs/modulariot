"use client";

import useSWR from "swr";
import { fetchMessages } from "./inbox-data-service";
import type { Message } from "./conversation.types";

/** Poll the open thread so a driver's reply shows up without a manual refresh. */
const POLL_INTERVAL_MS = 10_000;

export function useMessages(conversationId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Message[], Error>(
    conversationId ? ["whatsapp-messages", conversationId] : null,
    ([, id]: [string, string]) => fetchMessages(id),
    { refreshInterval: POLL_INTERVAL_MS },
  );

  return {
    messages: data ?? [],
    isLoading,
    error: error ?? null,
    refresh: mutate,
  };
}
