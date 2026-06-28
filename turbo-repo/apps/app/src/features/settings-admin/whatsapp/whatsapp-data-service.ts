"use client";

import { ApiError } from "../data/settings-admin-data-service";
import {
  WHATSAPP_PROVIDER,
  type ConnectionTestResult,
  type CredentialProfileResponse,
  type IntegrationConnection,
  type WhatsAppFormData,
} from "./whatsapp.types";

/**
 * Thin client-side wrappers around the Next.js admin proxy routes for the
 * org's WhatsApp integration connection. Throw {@link ApiError} on non-2xx.
 */

const integrationsBase = (orgSlug: string) =>
  `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/integrations`;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError({ status: res.status, url });
  }
  return (await res.json()) as T;
}

async function mutateJson<T>(
  method: string,
  url: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message: string | undefined;
    try {
      const parsed = (await res.json()) as {
        message?: string;
        error?: string | { message?: string };
      };
      message =
        parsed.message ??
        (typeof parsed.error === "string"
          ? parsed.error
          : parsed.error?.message);
    } catch {
      // non-JSON error body — fall back to the default ApiError message
    }
    throw new ApiError({ status: res.status, url, message });
  }
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  return mutateJson<T>("POST", url, body);
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  return mutateJson<T>("PATCH", url, body);
}

/** The org's single WhatsApp connection, or null if not configured yet. */
export async function fetchWhatsAppConnection(
  orgSlug: string,
): Promise<IntegrationConnection | null> {
  const connections = await getJson<IntegrationConnection[]>(
    `${integrationsBase(orgSlug)}/connections`,
  );
  return (
    connections.find((c) => c.providerType === WHATSAPP_PROVIDER) ?? null
  );
}

/**
 * Create the WhatsApp connection: store the access token as a bearer credential
 * profile, then create the connection referencing it. The phone-number-id /
 * waba-id / graph-version are non-secret and go in the connection metadata.
 */
export async function createWhatsAppConnection(
  orgSlug: string,
  form: WhatsAppFormData,
): Promise<IntegrationConnection> {
  const credential = await postJson<CredentialProfileResponse>(
    `${integrationsBase(orgSlug)}/credential-profiles`,
    {
      displayName: `WhatsApp token · ${form.phoneNumberId}`,
      authType: "BEARER_TOKEN",
      publicConfig: {},
      secretConfig: { token: form.token },
    },
  );

  return postJson<IntegrationConnection>(
    `${integrationsBase(orgSlug)}/connections`,
    {
      name: form.name,
      providerType: WHATSAPP_PROVIDER,
      baseUrl: form.baseUrl,
      credentialProfileId: credential.id,
      metadata: {
        phone_number_id: form.phoneNumberId,
        waba_id: form.wabaId,
        graph_version: form.graphVersion,
      },
    },
  );
}

/**
 * Update the connection: name / base URL / metadata (phone-number-id, waba-id,
 * graph-version). The token is sent only when the operator enters a new one — a blank
 * token leaves the stored credential unchanged (rotation is handled by the backend).
 */
export async function updateWhatsAppConnection(
  orgSlug: string,
  connectionId: string,
  form: WhatsAppFormData,
): Promise<IntegrationConnection> {
  const body: Record<string, unknown> = {
    name: form.name,
    baseUrl: form.baseUrl,
    metadata: {
      phone_number_id: form.phoneNumberId,
      waba_id: form.wabaId,
      graph_version: form.graphVersion,
    },
  };
  const token = form.token?.trim();
  if (token) {
    body.token = token;
  }
  return patchJson<IntegrationConnection>(
    `${integrationsBase(orgSlug)}/connections/${encodeURIComponent(connectionId)}`,
    body,
  );
}

/** Run the live connectivity probe against Meta. */
export async function testWhatsAppConnection(
  orgSlug: string,
  connectionId: string,
): Promise<ConnectionTestResult> {
  return postJson<ConnectionTestResult>(
    `${integrationsBase(orgSlug)}/connections/${encodeURIComponent(connectionId)}/test`,
    {},
  );
}
