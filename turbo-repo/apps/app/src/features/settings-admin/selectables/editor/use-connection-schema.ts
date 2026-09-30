"use client";

import useSWR from "swr";
import {
  fetchConnections,
  fetchTemplates,
} from "@/features/integration-config/integration-config-data-service";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";

const SWR_OPTS = { revalidateOnFocus: false } as const;

/**
 * The response schema of the template a connection list's connection was
 * made from, which is what its mapping suggests fields from. `schema` is null
 * for a connection without a template, or a template that declares none.
 * `ref` is `connectionId:operationId`.
 */
export function useConnectionSchema(ref: string): {
  schema: Record<string, unknown> | null;
  loading: boolean;
} {
  const orgSlug = useOrgScopes().activeOrg?.slug ?? null;
  const connectionId = ref.split(":")[0];
  const connections = useSWR(
    orgSlug && connectionId ? ["int-connections", orgSlug] : null,
    () => fetchConnections(orgSlug as string),
    SWR_OPTS
  );
  const templates = useSWR(
    orgSlug && connectionId ? ["int-templates", orgSlug] : null,
    () => fetchTemplates(orgSlug as string),
    SWR_OPTS
  );
  const templateId = connections.data?.find(
    (c) => c.id === connectionId
  )?.templateId;
  const schema = templates.data?.find(
    (t) => t.id === templateId
  )?.responseSchema;
  return {
    schema: schema && Object.keys(schema).length > 0 ? schema : null,
    loading: connections.isLoading || templates.isLoading,
  };
}
