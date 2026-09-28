"use client";

import { useState } from "react";
import useSWR from "swr";
import fetcher from "@/features/common/providers/fetcher";
import type { ConnectionCards } from "../types";

/**
 * Loads the approved cards per connection and deletes them. Only fetches when
 * `enabled` (the caller is a trainer); `deleting` holds the card in flight.
 */
export function useKnowledgeCards(enabled: boolean) {
  const { data, error, isLoading, mutate } = useSWR<{
    connections: ConnectionCards[];
  }>(enabled ? "/app/api/knowledge/cards" : null, fetcher);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(connection: string, cardId: string): Promise<void> {
    setDeleting(cardId);
    try {
      await fetcher(
        `/app/api/knowledge/cards/${encodeURIComponent(connection)}/${encodeURIComponent(cardId)}`,
        { method: "DELETE" }
      );
      await mutate();
    } finally {
      setDeleting(null);
    }
  }

  return {
    connections: data?.connections ?? [],
    isLoading,
    error,
    deleting,
    remove,
    refetch: () => mutate(),
  };
}
