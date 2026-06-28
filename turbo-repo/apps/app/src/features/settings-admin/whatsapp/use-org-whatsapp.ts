"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  createWhatsAppConnection,
  fetchWhatsAppConnection,
  testWhatsAppConnection,
  updateWhatsAppConnection,
} from "./whatsapp-data-service";
import type {
  ConnectionTestResult,
  IntegrationConnection,
  WhatsAppFormData,
} from "./whatsapp.types";

/**
 * The org's WhatsApp connection + create/test actions, via the Next.js proxy
 * to Quarkus. Returns a null SWR key when orgSlug is empty so the fetch skips.
 */
export function useOrgWhatsApp(orgSlug: string | null) {
  const [actionLoading, setActionLoading] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<
    IntegrationConnection | null,
    Error
  >(
    orgSlug ? ["org-whatsapp", orgSlug] : null,
    ([, slug]: [string, string]) => fetchWhatsAppConnection(slug),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  function requireSlug(): string {
    if (!orgSlug) {
      throw new Error("No organization selected");
    }
    return orgSlug;
  }

  async function create(
    form: WhatsAppFormData,
  ): Promise<IntegrationConnection> {
    const slug = requireSlug();
    setActionLoading(true);
    try {
      const created = await createWhatsAppConnection(slug, form);
      // Seed the cache from the response so the card updates instantly (no refetch flicker).
      await mutate(created, { revalidate: false });
      return created;
    } finally {
      setActionLoading(false);
    }
  }

  async function update(
    connectionId: string,
    form: WhatsAppFormData,
  ): Promise<IntegrationConnection> {
    const slug = requireSlug();
    setActionLoading(true);
    try {
      const updated = await updateWhatsAppConnection(slug, connectionId, form);
      // Seed the cache from the response so the card reflects the edit immediately,
      // instead of briefly showing the previous values during a revalidation refetch.
      await mutate(updated, { revalidate: false });
      return updated;
    } finally {
      setActionLoading(false);
    }
  }

  async function test(connectionId: string): Promise<ConnectionTestResult> {
    const slug = requireSlug();
    setActionLoading(true);
    try {
      const result = await testWhatsAppConnection(slug, connectionId);
      await mutate();
      return result;
    } finally {
      setActionLoading(false);
    }
  }

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
