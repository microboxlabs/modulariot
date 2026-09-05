"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  fetchPlatformOwnerRole,
  updatePlatformOwnerRole,
} from "./platform-data-service";
import { ApiError } from "../data/json-client";
import type { PlatformRole } from "./platform.types";

/** Who holds `PLATFORM_OWNER`, and the write that replaces the list. */
export function usePlatformOwnerRole() {
  const [isSaving, setIsSaving] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<PlatformRole, ApiError>(
    "platform-owner-role",
    fetchPlatformOwnerRole,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const save = async (assigneeIds: string[]) => {
    setIsSaving(true);
    try {
      const updated = await updatePlatformOwnerRole(assigneeIds);
      // Seed from the response rather than refetching, so the list does not
      // flash the previous assignees during revalidation.
      await mutate(updated, { revalidate: false });
      return updated;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    role: data ?? null,
    isLoading,
    isSaving,
    error: error ?? null,
    save,
  };
}
