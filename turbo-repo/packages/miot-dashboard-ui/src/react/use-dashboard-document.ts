"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { DashboardStorageSchema } from "@microboxlabs/miot-dashboard-contract/document";
import { createDashboardDocument, type DashboardDocumentOptions } from "@microboxlabs/miot-dashboard-ui/document";

type Controller = ReturnType<typeof createDashboardDocument>;
type Client = DashboardDocumentOptions["client"];
const subscribeEmpty = () => () => undefined;
const emptySnapshot = () => null;

/** One controller per resource/session; obsolete content is hidden before effects run. */
export function useDashboardDocument({
  client, slug, emptyDocument, sessionKey, readOnly: restricted = false,
}: Readonly<DashboardDocumentOptions>) {
  const key = JSON.stringify([sessionKey, client.key(slug)]);
  const [mounted, setMounted] = useState<{
    key: string;
    client: Client;
    controller: Controller;
    emptyDocument: DashboardStorageSchema;
    restricted: boolean;
  } | null>(null);
  useEffect(() => {
    const controller = createDashboardDocument({
      client,
      slug,
      sessionKey,
      emptyDocument,
      readOnly: restricted,
    });
    setMounted({ key, client, controller, emptyDocument, restricted });
    void controller.load();
    return () => controller.destroy();
  }, [client, slug, sessionKey, emptyDocument, key, restricted]);
  // Hide the previous resource synchronously, before effect cleanup runs.
  const current =
    mounted?.key === key && mounted.client === client &&
    mounted.emptyDocument === emptyDocument && mounted.restricted === restricted
      ? mounted.controller
      : null;
  const snapshot = useSyncExternalStore(
    current?.subscribe ?? subscribeEmpty,
    current?.getSnapshot ?? emptySnapshot,
    emptySnapshot
  );
  return {
    config: snapshot?.config ?? emptyDocument,
    onChange: (config: DashboardStorageSchema) => current?.onChange(config),
    save: () => current?.save() ?? Promise.resolve(false),
    discardAndReload: () =>
      current?.discardAndReload() ?? Promise.resolve(false),
    etag: snapshot?.etag ?? null,
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
