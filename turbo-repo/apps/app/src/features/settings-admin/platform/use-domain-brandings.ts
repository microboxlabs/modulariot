"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  deleteDomainBranding,
  fetchDomainBrandings,
  saveDomainBranding,
} from "./platform-data-service";
import { ApiError } from "../data/json-client";
import type { DomainBrandingAdmin, SetDomainBranding } from "./platform.types";

/** Every configured domain, plus the create/replace and delete actions. */
export function useDomainBrandings() {
  const [isSaving, setIsSaving] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<
    DomainBrandingAdmin[],
    ApiError
  >("domain-brandings", fetchDomainBrandings, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const save = async (domain: string, value: SetDomainBranding) => {
    setIsSaving(true);
    try {
      const saved = await saveDomainBranding(domain, value);
      // Refetch rather than patching the cache: the modulith normalizes the
      // domain, so the row that came back may not be keyed on what was typed.
      await mutate();
      return saved;
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (domain: string) => {
    setIsSaving(true);
    try {
      await deleteDomainBranding(domain);
      await mutate();
    } finally {
      setIsSaving(false);
    }
  };

  return {
    domains: data ?? [],
    isLoading,
    isSaving,
    error: error ?? null,
    save,
    remove,
  };
}
