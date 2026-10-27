"use client";

import { useMemo } from "react";
import {
  createQueryAuthoringClient,
  QueryWorkbench,
  type QueryWorkbenchLabels,
} from "@microboxlabs/miot-dashboard-ui/authoring";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

/** Settings › Conexiones › BigQuery: the dashboard library's query editor, through the app's proxy. */
export function QueryEditorSection({
  orgSlug,
  sourceId,
  planId,
  canWrite,
  lang,
  dict,
  onSourceChange,
  onPlanChange,
}: Readonly<{
  orgSlug: string;
  sourceId?: string;
  planId?: string | null;
  canWrite: boolean;
  lang: string;
  /** `pages.integrationConnections.queryEditor`. */
  dict: I18nRecord;
  onSourceChange: (sourceId: string) => void;
  onPlanChange: (planId: string | null) => void;
}>) {
  const client = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "/app";
    return createQueryAuthoringClient({
      route: `${base}/api/query-sources?org=${encodeURIComponent(orgSlug)}`,
      credentials: "same-origin",
    });
  }, [orgSlug]);
  const labels = useMemo(
    () => dict as unknown as Partial<QueryWorkbenchLabels>,
    [dict]
  );

  return (
    <QueryWorkbench
      key={orgSlug}
      client={client}
      sourceId={sourceId}
      onSourceChange={onSourceChange}
      planId={planId}
      onPlanChange={onPlanChange}
      canWrite={canWrite}
      labels={labels}
      locale={lang === "en" ? "en-US" : "es-CL"}
    />
  );
}
