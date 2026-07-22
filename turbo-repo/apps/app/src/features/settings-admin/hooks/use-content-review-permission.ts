"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  fetchContentReviewPermission,
  updateContentReviewPermission,
} from "../data/settings-admin-data-service";
import type {
  ContentReviewPermission,
  SetContentReviewPermission,
} from "../types";

export function useContentReviewPermission(orgSlug: string | null) {
  const [isSaving, setIsSaving] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<
    ContentReviewPermission,
    Error
  >(
    orgSlug ? ["content-review-permission", orgSlug] : null,
    ([, slug]: [string, string]) => fetchContentReviewPermission(slug),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const save = async (value: SetContentReviewPermission) => {
    if (!orgSlug) return;
    setIsSaving(true);
    try {
      const updated = await updateContentReviewPermission(orgSlug, value);
      await mutate(updated, { revalidate: false });
      return updated;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    permission: data,
    isLoading,
    isSaving,
    error: error ?? null,
    save,
  };
}
