"use client";

import { ApiError } from "@/features/settings-admin/data/settings-admin-data-service";
import type {
  ConnectionTestResult,
  CreateConnectionRequest,
  CreateTemplateRequest,
  IntegrationConnection,
  IntegrationTemplate,
  UpdateConnectionRequest,
  UpdateTemplateRequest,
} from "./integration-config.types";

/**
 * Client-side wrappers around the Next.js admin proxy routes for integration templates and
 * connections, which forward to miot-integrations. Throw {@link ApiError} on non-2xx so SWR
 * surfaces it — including the 409 the API returns when a template still has instances.
 *
 * Served under basePath "/app"; fetch() is not auto-prefixed, so the base includes it
 * explicitly (as every sibling data service does).
 */

const base = (orgSlug: string) =>
  `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/integrations`;

async function readError(res: Response, url: string): Promise<ApiError> {
  let message: string | undefined;
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    message = body.error ?? body.message;
  } catch {
    // non-JSON error body — fall back to the status message
  }
  return new ApiError({ status: res.status, url, message });
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw await readError(res, url);
  return (await res.json()) as T;
}

async function sendJson<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!res.ok) throw await readError(res, url);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                   */
/* -------------------------------------------------------------------------- */

export function fetchTemplates(orgSlug: string): Promise<IntegrationTemplate[]> {
  return getJson<IntegrationTemplate[]>(`${base(orgSlug)}/templates`);
}

export function createTemplate(
  orgSlug: string,
  body: CreateTemplateRequest
): Promise<IntegrationTemplate> {
  return sendJson<IntegrationTemplate>("POST", `${base(orgSlug)}/templates`, body);
}

export function updateTemplate(
  orgSlug: string,
  id: string,
  body: UpdateTemplateRequest
): Promise<IntegrationTemplate> {
  return sendJson<IntegrationTemplate>(
    "PATCH",
    `${base(orgSlug)}/templates/${encodeURIComponent(id)}`,
    body
  );
}

export function deleteTemplate(orgSlug: string, id: string): Promise<void> {
  return sendJson<void>("DELETE", `${base(orgSlug)}/templates/${encodeURIComponent(id)}`);
}

/* -------------------------------------------------------------------------- */
/* Connections (instances)                                                     */
/* -------------------------------------------------------------------------- */

export function fetchConnections(orgSlug: string): Promise<IntegrationConnection[]> {
  return getJson<IntegrationConnection[]>(`${base(orgSlug)}/connections`);
}

export function createConnection(
  orgSlug: string,
  body: CreateConnectionRequest
): Promise<IntegrationConnection> {
  return sendJson<IntegrationConnection>("POST", `${base(orgSlug)}/connections`, body);
}

export function updateConnection(
  orgSlug: string,
  id: string,
  body: UpdateConnectionRequest
): Promise<IntegrationConnection> {
  return sendJson<IntegrationConnection>(
    "PATCH",
    `${base(orgSlug)}/connections/${encodeURIComponent(id)}`,
    body
  );
}

export function testConnection(
  orgSlug: string,
  id: string
): Promise<ConnectionTestResult> {
  return sendJson<ConnectionTestResult>(
    "POST",
    `${base(orgSlug)}/connections/${encodeURIComponent(id)}/test`,
    {}
  );
}

export function deleteConnection(orgSlug: string, id: string): Promise<void> {
  return sendJson<void>(
    "DELETE",
    `${base(orgSlug)}/connections/${encodeURIComponent(id)}`
  );
}
