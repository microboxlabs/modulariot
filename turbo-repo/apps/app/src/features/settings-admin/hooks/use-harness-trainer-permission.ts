"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  fetchHarnessTrainerPermission,
  updateHarnessTrainerPermission,
} from "../data/settings-admin-data-service";
import type {
  OrganizationPermission,
  SetOrganizationPermission,
} from "../types";

export function useHarnessTrainerPermission(orgSlug: string | null) {
  const [isSaving, setIsSaving] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<
    OrganizationPermission,
    Error
  >(
    orgSlug ? ["harness-trainer-permission", orgSlug] : null,
    ([, slug]: [string, string]) => fetchHarnessTrainerPermission(slug),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const save = async (value: SetOrganizationPermission) => {
    if (!orgSlug) return;
    setIsSaving(true);
    try {
      const updated = await updateHarnessTrainerPermission(orgSlug, value);
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
