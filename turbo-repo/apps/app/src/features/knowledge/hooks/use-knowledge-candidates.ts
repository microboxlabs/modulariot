"use client";

import { useState } from "react";
import useSWR from "swr";
import fetcher from "@/features/common/providers/fetcher";
import type { KnowledgeCandidate, ReviewResult } from "../types";

interface CandidatesResponse {
  candidates: KnowledgeCandidate[];
}

/**
 * Loads pending knowledge candidates, edits and reviews them (approve/reject). Reads
 * via SWR from the app's `/app/api/knowledge/candidates` route (basePath is
 * `/app`); a review POSTs to `/{id}` and revalidates. `reviewing` holds the id
 * currently in flight so the UI can disable its row.
 */
export function useKnowledgeCandidates() {
  const { data, error, isLoading, mutate } = useSWR<CandidatesResponse>(
    "/app/api/knowledge/candidates?status=pending",
    fetcher
  );
  const [reviewing, setReviewing] = useState<string | null>(null);

  async function review(
    id: string,
    decision: "approve" | "reject"
  ): Promise<ReviewResult> {
    setReviewing(id);
    try {
      const result = await fetcher<ReviewResult>(
        `/app/api/knowledge/candidates/${id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        }
      );
      await mutate();
      return result;
    } finally {
      setReviewing(null);
    }
  }

  async function edit(
    id: string,
    content: { term: string; body: string }
  ): Promise<void> {
    setReviewing(id);
    try {
      await fetcher(`/app/api/knowledge/candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      await mutate();
    } finally {
      setReviewing(null);
    }
  }

  return {
    candidates: data?.candidates ?? [],
    isLoading,
    error,
    reviewing,
    review,
    edit,
    refetch: () => mutate(),
  };
}
