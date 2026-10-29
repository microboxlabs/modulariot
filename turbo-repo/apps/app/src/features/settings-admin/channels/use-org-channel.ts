"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  createChannelConnection,
  fetchChannelConnection,
  testChannelConnection,
  updateChannelConnection,
} from "./channel-connections";
import type {
  ChannelCreate,
  ChannelUpdate,
  ConnectionTestResult,
  IntegrationConnection,
} from "./channel.types";

/**
 * The organization's connection of one provider, with create, update and test.
 * A null orgSlug skips the fetch.
 */
export function useOrgChannel(orgSlug: string | null, provider: string) {
  const [actionLoading, setActionLoading] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<
    IntegrationConnection | null,
    Error
  >(
    orgSlug ? ["org-channel", provider, orgSlug] : null,
    ([, kind, slug]: [string, string, string]) =>
      fetchChannelConnection(slug, kind),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  function requireSlug(): string {
    if (!orgSlug) {
      throw new Error("No organization selected");
    }
    return orgSlug;
  }

  async function busy<T>(action: () => Promise<T>): Promise<T> {
    setActionLoading(true);
    try {
      return await action();
    } finally {
      setActionLoading(false);
    }
  }

  // Seed the cache from the response so the card updates without a refetch flicker.
  const create = (input: ChannelCreate) =>
    busy(async () => {
      const created = await createChannelConnection(
        requireSlug(),
        provider,
        input
      );
      await mutate(created, { revalidate: false });
      return created;
    });

  const update = (connectionId: string, input: ChannelUpdate) =>
    busy(async () => {
      const updated = await updateChannelConnection(
        requireSlug(),
        connectionId,
        input
      );
      await mutate(updated, { revalidate: false });
      return updated;
    });

  const test = (connectionId: string): Promise<ConnectionTestResult> =>
    busy(async () => {
      const result = await testChannelConnection(requireSlug(), connectionId);
      await mutate();
      return result;
    });

  return {
    connection: data ?? null,
    isLoading,
    error: error ?? null,
    actionLoading,
    create,
    update,
    test,
    refresh: mutate,
  };
}
