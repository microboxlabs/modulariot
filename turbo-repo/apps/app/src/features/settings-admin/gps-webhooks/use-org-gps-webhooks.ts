"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  createGpsWebhook,
  deleteGpsWebhook,
  fetchGpsWebhooks,
  testGpsWebhook,
  updateGpsWebhook,
} from "./gps-webhook-data-service";
import type {
  GpsWebhookFormData,
  GpsWebhookSubscription,
  GpsWebhookTestResult,
} from "./gps-webhook.types";

/**
 * Org GPS webhook subscriptions + CRUD/test actions via the Next.js proxy.
 */
export function useOrgGpsWebhooks(orgSlug: string | null) {
  const [actionLoading, setActionLoading] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<
    GpsWebhookSubscription[],
    Error
  >(
    orgSlug ? ["org-gps-webhooks", orgSlug] : null,
    ([, slug]: [string, string]) => fetchGpsWebhooks(slug),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  function requireSlug(): string {
    if (!orgSlug) {
      throw new Error("No organization selected");
    }
    return orgSlug;
  }

  async function create(
    form: GpsWebhookFormData,
  ): Promise<GpsWebhookSubscription> {
    const slug = requireSlug();
    setActionLoading(true);
    try {
      const created = await createGpsWebhook(slug, form);
      await mutate(
        (current) => (current ? [...current, created] : [created]),
        { revalidate: false },
      );
      return created;
    } finally {
      setActionLoading(false);
    }
  }

  async function update(
    subscriptionId: string,
    form: GpsWebhookFormData,
  ): Promise<GpsWebhookSubscription> {
    const slug = requireSlug();
    setActionLoading(true);
    try {
      const updated = await updateGpsWebhook(slug, subscriptionId, form);
      await mutate(
        (current) =>
          current?.map((item) => (item.id === subscriptionId ? updated : item)),
        { revalidate: false },
      );
      return updated;
    } finally {
      setActionLoading(false);
    }
  }

  async function remove(subscriptionId: string): Promise<void> {
    const slug = requireSlug();
    setActionLoading(true);
    try {
      await deleteGpsWebhook(slug, subscriptionId);
      await mutate(
        (current) => current?.filter((item) => item.id !== subscriptionId),
        { revalidate: false },
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function test(subscriptionId: string): Promise<GpsWebhookTestResult> {
    const slug = requireSlug();
    setActionLoading(true);
    try {
      return await testGpsWebhook(slug, subscriptionId);
    } finally {
      setActionLoading(false);
    }
  }

  return {
    subscriptions: data ?? [],
    isLoading,
    error: error ?? null,
    actionLoading,
    create,
    update,
    remove,
    test,
    refresh: mutate,
  };
}
