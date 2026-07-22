"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  fetchOrganizationOwnerRole,
  updateOrganizationOwnerRole,
} from "../data/settings-admin-data-service";
import type { OrganizationRole, SetOrganizationRole } from "../types";

export function useOrganizationOwnerRole(orgSlug: string) {
  const [isSaving, setIsSaving] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<OrganizationRole, Error>(
    ["organization-owner-role", orgSlug],
    ([, slug]: [string, string]) => fetchOrganizationOwnerRole(slug),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const save = async (value: SetOrganizationRole) => {
    setIsSaving(true);
    try {
      const updated = await updateOrganizationOwnerRole(orgSlug, value);
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
