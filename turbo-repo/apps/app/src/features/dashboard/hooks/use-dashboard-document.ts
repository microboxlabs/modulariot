"use client";

import { useMemo } from "react";
import type { DashboardStorageSchema } from "@microboxlabs/miot-dashboard-contract/document";
import { useDashboardDocument as usePortableDashboardDocument } from "@microboxlabs/miot-dashboard-ui/react";
import { createDashboardServerClient } from "../services/dashboard-server-client";

/** Next host adapter: session/proxy routing stays outside the portable hook. */
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
  const document = usePortableDashboardDocument({ client, slug, emptyDocument, sessionKey });
  return { ...document, client };
}
