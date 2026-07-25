"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { fetchCredentials } from "@/features/credentials/credentials-data-service";
import type { CredentialListItem } from "@/features/credentials/credential.types";
import {
  createConnection,
  createTemplate,
  deleteConnection,
  deleteTemplate,
  fetchConnections,
  fetchTemplates,
  testConnection,
  updateConnection,
  updateTemplate,
} from "./integration-config-data-service";
import type {
  ConnectionTestResult,
  CreateConnectionRequest,
  CreateTemplateRequest,
  IntegrationConnection,
  IntegrationTemplate,
  UpdateConnectionRequest,
  UpdateTemplateRequest,
} from "./integration-config.types";

const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 5_000 } as const;

/**
 * Templates, connections and credentials for the integrations admin page, plus the
 * mutations that keep them in step. Mutations revalidate rather than patching locally, so
 * server-owned fields (a connection's status, its last test result) come back from the
 * source that decided them.
 */
export function useIntegrationConfig(orgSlug: string | null) {
  const templates = useSWR<IntegrationTemplate[], Error>(
    orgSlug ? ["int-templates", orgSlug] : null,
    () => fetchTemplates(orgSlug as string),
    SWR_OPTS
  );
  const connections = useSWR<IntegrationConnection[], Error>(
    orgSlug ? ["int-connections", orgSlug] : null,
    () => fetchConnections(orgSlug as string),
    SWR_OPTS
  );
  const credentials = useSWR<readonly CredentialListItem[], Error>(
    orgSlug ? ["int-credentials", orgSlug] : null,
    () => fetchCredentials(orgSlug as string),
    SWR_OPTS
  );

  const [saving, setSaving] = useState(false);

  const withSaving = useCallback(async <T>(work: () => Promise<T>): Promise<T> => {
    setSaving(true);
    try {
      return await work();
    } finally {
      setSaving(false);
    }
  }, []);

  const saveTemplate = useCallback(
    (body: CreateTemplateRequest, id?: string) =>
      withSaving(async () => {
        const saved = id
          ? await updateTemplate(orgSlug as string, id, body as UpdateTemplateRequest)
          : await createTemplate(orgSlug as string, body);
        await templates.mutate();
        return saved;
      }),
    [orgSlug, templates, withSaving]
  );

  const removeTemplate = useCallback(
    (id: string) =>
      withSaving(async () => {
        await deleteTemplate(orgSlug as string, id);
        await templates.mutate();
      }),
    [orgSlug, templates, withSaving]
  );

  const saveConnection = useCallback(
    (create: CreateConnectionRequest | null, id?: string, patch?: UpdateConnectionRequest) =>
      withSaving(async () => {
        const saved = id
          ? await updateConnection(orgSlug as string, id, patch ?? {})
          : await createConnection(orgSlug as string, create as CreateConnectionRequest);
        await connections.mutate();
        return saved;
      }),
    [orgSlug, connections, withSaving]
  );

  const removeConnection = useCallback(
    (id: string) =>
      withSaving(async () => {
        await deleteConnection(orgSlug as string, id);
        await connections.mutate();
      }),
    [orgSlug, connections, withSaving]
  );

  const testInstance = useCallback(
    async (id: string): Promise<ConnectionTestResult> => {
      const result = await testConnection(orgSlug as string, id);
      await connections.mutate();
      return result;
    },
    [orgSlug, connections]
  );

  return {
    templates: templates.data ?? [],
    connections: connections.data ?? [],
    credentials: credentials.data ?? [],
    isLoading: templates.isLoading || connections.isLoading,
    error: templates.error ?? connections.error,
    saving,
    saveTemplate,
    removeTemplate,
    saveConnection,
    removeConnection,
    testInstance,
    refresh: () => {
      void templates.mutate();
      void connections.mutate();
    },
  };
}
