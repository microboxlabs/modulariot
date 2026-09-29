"use client";

import { useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { DashboardStorageSchema } from "@microboxlabs/miot-dashboard-contract/document";
import {
  createDashboardServerClient,
  DashboardApiError,
} from "../services/dashboard-server-client";

type Client = ReturnType<typeof createDashboardServerClient>;
type Draft = { key: string; config: DashboardStorageSchema; etag: string };
type Activity = { key: string; busy: boolean; error: number | null };

/** Explicit revision-aware editing. The page supplies a translated empty document. */
export function useDashboardDocument(
  org: string,
  slug: string,
  emptyDocument: DashboardStorageSchema,
  fetchImpl: typeof fetch = fetch
) {
  const client = useMemo(
    () => createDashboardServerClient(org, fetchImpl),
    [org, fetchImpl]
  );
  const key = client.key(slug);
  const selectedKey = useRef(key);
  selectedKey.current = key;
  const lock = useRef(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [generation, setGeneration] = useState(0);
  const { mutate: updateCache } = useSWRConfig();
  const { data, error: loadError } = useSWR(
    [key, "document-editor"],
    () => loadDocument(client, slug),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );
  const currentDraft = draft?.key === key ? draft : null;
  const currentActivity = activity?.key === key ? activity : null;
  const config = currentDraft?.config ?? data?.config ?? emptyDocument;
  const busy = currentActivity?.busy ?? false;
  const readOnly =
    !data || !data.capabilities.canEdit || data.capabilities.readOnly || busy;

  function onChange(next: DashboardStorageSchema) {
    if (readOnly || lock.current || !data) return;
    setDraft({ key, config: next, etag: currentDraft?.etag ?? data.etag });
  }

  async function save() {
    if (readOnly || !currentDraft || lock.current || !data) return false;
    lock.current = true;
    setActivity({ key, busy: true, error: null });
    try {
      const saved = await client.save(
        slug,
        currentDraft.config,
        currentDraft.etag
      );
      await updateCache(
        [key, "document-editor"],
        { ...data, config: currentDraft.config, etag: saved.etag },
        { revalidate: false }
      );
      if (selectedKey.current === key) setDraft(null);
      return true;
    } catch (error) {
      if (selectedKey.current === key)
        setActivity({ key, busy: false, error: status(error) });
      return false;
    } finally {
      lock.current = false;
      setActivity((previous) =>
        previous?.key === key ? { ...previous, busy: false } : previous
      );
    }
  }

  /** Caller obtains explicit discard intent; failed reloads retain the draft. */
  async function discardAndReload() {
    if (lock.current) return false;
    lock.current = true;
    setActivity({ key, busy: true, error: null });
    try {
      const fresh = await loadDocument(client, slug);
      await updateCache([key, "document-editor"], fresh, { revalidate: false });
      if (selectedKey.current === key) {
        setDraft(null);
        setGeneration((previous) => previous + 1);
      }
      return true;
    } catch (error) {
      if (selectedKey.current === key)
        setActivity({ key, busy: false, error: status(error) });
      return false;
    } finally {
      lock.current = false;
      setActivity((previous) =>
        previous?.key === key ? { ...previous, busy: false } : previous
      );
    }
  }

  return {
    client,
    config,
    onChange,
    save,
    discardAndReload,
    isLoaded: Boolean(data),
    readOnly,
    busy,
    dirty: currentDraft !== null,
    exists: data?.config !== null && data !== undefined,
    capabilities: data?.capabilities,
    error: currentActivity?.error ?? (loadError ? status(loadError) : null),
    editorKey: `${key}:${generation}`,
  };
}

async function loadDocument(client: Client, slug: string) {
  const [document, capabilities] = await Promise.all([
    client.load(slug),
    client.capabilities(slug),
  ]);
  return { ...document, capabilities };
}

function status(error: unknown) {
  return error instanceof DashboardApiError ? error.status : 502;
}
