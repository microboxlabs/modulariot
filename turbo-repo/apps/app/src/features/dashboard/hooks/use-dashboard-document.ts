"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { DashboardStorageSchema } from "@microboxlabs/miot-dashboard-contract/document";
import { createDashboardDocument } from "@microboxlabs/miot-dashboard-ui/document";
import { createDashboardServerClient } from "../services/dashboard-server-client";

type Controller = ReturnType<typeof createDashboardDocument>;
type Client = ReturnType<typeof createDashboardServerClient>;
const subscribeEmpty = () => () => undefined;
const emptySnapshot = () => null;

/** Host adapter: a fresh document controller for every authenticated generation/resource. */
export function useDashboardDocument(
  org: string,
  slug: string,
  emptyDocument: DashboardStorageSchema,
  sessionKey: string,
  fetchImpl: typeof fetch = fetch
) {
  const client = useMemo(
    () => createDashboardServerClient(org, fetchImpl),
    [org, fetchImpl]
  );
  const key = JSON.stringify([sessionKey, client.key(slug)]);
  const [mounted, setMounted] = useState<{
    key: string;
    client: Client;
    controller: Controller;
  } | null>(null);
  useEffect(() => {
    const controller = createDashboardDocument({
      client,
      slug,
      sessionKey,
      emptyDocument,
    });
    setMounted({ key, client, controller });
    void controller.load();
    return () => controller.destroy();
  }, [client, slug, sessionKey, emptyDocument, key]);
  // Hide the previous resource synchronously, before effect cleanup runs.
  const current =
    mounted?.key === key && mounted.client === client
      ? mounted.controller
      : null;
  const snapshot = useSyncExternalStore(
    current?.subscribe ?? subscribeEmpty,
    current?.getSnapshot ?? emptySnapshot,
    emptySnapshot
  );
  return {
    client,
    config: snapshot?.config ?? emptyDocument,
    onChange: (config: DashboardStorageSchema) => current?.onChange(config),
    save: () => current?.save() ?? Promise.resolve(false),
    discardAndReload: () =>
      current?.discardAndReload() ?? Promise.resolve(false),
    isLoaded: snapshot?.isLoaded ?? false,
    readOnly: snapshot?.readOnly ?? true,
    busy: snapshot?.busy ?? false,
    dirty: snapshot?.dirty ?? false,
    exists: snapshot?.exists ?? false,
    capabilities: snapshot?.capabilities,
    error: snapshot?.error ?? null,
    editorKey: snapshot?.editorKey ?? key,
  };
}
