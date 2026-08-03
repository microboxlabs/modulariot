"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import type {
  CredentialFormData,
  CredentialListItem,
  CredentialTestResult,
  CredentialTypeId,
} from "./credential.types";
import {
  createCredential,
  deleteCredential,
  fetchCredentials,
  testCredential,
  testCredentialConfig,
  updateCredential,
} from "./credentials-data-service";

const CREDENTIALS_KEY = "org-credentials";

/**
 * The credentials screen's data. Mutations revalidate the list rather than patching it
 * locally, so derived values the server owns — the masked summary, who last changed it,
 * the recorded test outcome — come back from the source that computed them.
 *
 * Mutations reject on failure so the caller can decide what the operator sees; the list
 * itself surfaces its error through {@code error}.
 */
export function useCredentials(orgSlug: string | null) {
  const { data, error, isLoading, mutate } = useSWR<
    readonly CredentialListItem[],
    Error
  >(
    orgSlug ? [CREDENTIALS_KEY, orgSlug] : null,
    () => fetchCredentials(orgSlug as string),
    { revalidateOnFocus: false, dedupingInterval: 5_000 }
  );

  const [actionLoading, setActionLoading] = useState(false);

  const run = useCallback(
    async <T,>(action: (slug: string) => Promise<T>): Promise<T> => {
      if (!orgSlug) {
        throw new Error("No organization is selected");
      }
      setActionLoading(true);
      try {
        return await action(orgSlug);
      } finally {
        setActionLoading(false);
      }
    },
    [orgSlug]
  );

  const create = useCallback(
    async (typeId: CredentialTypeId, form: CredentialFormData) => {
      await run((slug) => createCredential(slug, typeId, form));
      await mutate();
    },
    [run, mutate]
  );

  const update = useCallback(
    async (id: string, form: CredentialFormData) => {
      await run((slug) => updateCredential(slug, id, form));
      await mutate();
    },
    [run, mutate]
  );

  const remove = useCallback(
    async (id: string, force: boolean) => {
      await run((slug) => deleteCredential(slug, id, force));
      await mutate();
    },
    [run, mutate]
  );

  /** Testing records the outcome upstream, so the list is revalidated to pick it up. */
  const test = useCallback(
    async (id: string): Promise<CredentialTestResult> => {
      const result = await run((slug) => testCredential(slug, id));
      await mutate();
      return result;
    },
    [run, mutate]
  );

  /** Dry run for a credential that has not been saved. Nothing to revalidate. */
  const testConfig = useCallback(
    (typeId: CredentialTypeId, form: CredentialFormData) =>
      run((slug) => testCredentialConfig(slug, typeId, form)),
    [run]
  );

  return {
    credentials: data ?? [],
    isLoading,
    error,
    actionLoading,
    create,
    update,
    remove,
    test,
    testConfig,
    refresh: mutate,
  };
}
