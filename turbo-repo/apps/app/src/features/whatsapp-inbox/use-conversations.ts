"use client";

import useSWR from "swr";
import { fetchConversations } from "./inbox-data-service";
import type { Conversation } from "./conversation.types";

/** Near-real-time without websockets: re-poll the list on an interval. */
const POLL_INTERVAL_MS = 10_000;

export function useConversations() {
  const { data, error, isLoading, mutate } = useSWR<Conversation[], Error>(
    "whatsapp-conversations",
    fetchConversations,
    { refreshInterval: POLL_INTERVAL_MS, revalidateOnFocus: true },
  );

  return {
    conversations: data ?? [],
    isLoading,
    error: error ?? null,
    refresh: mutate,
  };
}
