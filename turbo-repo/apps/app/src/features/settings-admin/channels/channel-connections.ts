"use client";

import { ApiError } from "../data/json-client";
import type {
  ChannelCreate,
  ChannelUpdate,
  ConnectionTestResult,
  CredentialProfileResponse,
  IntegrationConnection,
} from "./channel.types";

/**
 * Client wrappers around the Next.js admin proxy for an organization's channel
 * connections (one per provider, e.g. WHATSAPP or RESEND). Throw {@link ApiError}
 * on non-2xx.
 */

/** The coordinator modulith's integrations; a channel may live on another (see `use-org-channel`). */
const integrationsBase = (orgSlug: string) =>
  `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/integrations`;

export type IntegrationsBase = (orgSlug: string) => string;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError({ status: res.status, url });
  }
  return (await res.json()) as T;
}

async function sendJson<T>(
  method: string,
  url: string,
  body: unknown
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

/** The organization's connection of this provider, or null if none. */
export async function fetchChannelConnection(
  orgSlug: string,
  provider: string,
  base: IntegrationsBase = integrationsBase
): Promise<IntegrationConnection | null> {
  const connections = await getJson<IntegrationConnection[]>(
    `${base(orgSlug)}/connections`
  );
  return connections.find((c) => c.providerType === provider) ?? null;
}

/** Stores the token as a bearer credential profile, then creates the connection on it. */
export async function createChannelConnection(
  orgSlug: string,
  provider: string,
  input: ChannelCreate,
  base: IntegrationsBase = integrationsBase
): Promise<IntegrationConnection> {
  if (input.credentialProfileId) {
    return postConnection(
      base(orgSlug),
      provider,
      input,
      input.credentialProfileId
    );
  }
  const credential = await sendJson<CredentialProfileResponse>(
    "POST",
    `${base(orgSlug)}/credential-profiles`,
    {
      displayName: input.credentialName,
      authType: "BEARER_TOKEN",
      publicConfig: input.credentialPublicConfig ?? {},
      secretConfig: { ...input.secrets, token: input.token },
    }
  );
  try {
    return await postConnection(base(orgSlug), provider, input, credential.id);
  } catch (cause) {
    // Don't leave a credential behind for a connection that was not created.
    await fetch(
      `${base(orgSlug)}/credential-profiles/${encodeURIComponent(credential.id)}`,
      { method: "DELETE" }
    ).catch(() => undefined);
    throw cause;
  }
}

function postConnection(
  url: string,
  provider: string,
  input: ChannelCreate,
  credentialProfileId: string
): Promise<IntegrationConnection> {
  return sendJson<IntegrationConnection>("POST", `${url}/connections`, {
    name: input.name,
    providerType: provider,
    baseUrl: input.baseUrl,
    credentialProfileId,
    metadata: input.metadata,
  });
}

/** Updates name, base URL and metadata; a non-blank token or secret replaces the stored one. */
export async function updateChannelConnection(
  orgSlug: string,
  connectionId: string,
  input: ChannelUpdate,
  base: IntegrationsBase = integrationsBase
): Promise<IntegrationConnection> {
  const body: Record<string, unknown> = {
    name: input.name,
    baseUrl: input.baseUrl,
    metadata: input.metadata,
  };
  const token = input.token?.trim();
  if (token) {
    body.token = token;
  }
  if (input.secrets && Object.keys(input.secrets).length > 0) {
    body.secrets = input.secrets;
  }
  if (input.credentialProfileId) {
    body.credentialProfileId = input.credentialProfileId;
  }
  return sendJson<IntegrationConnection>(
    "PATCH",
    `${base(orgSlug)}/connections/${encodeURIComponent(connectionId)}`,
    body
  );
}

/** Runs the provider's connection test. */
export async function testChannelConnection(
  orgSlug: string,
  connectionId: string
): Promise<ConnectionTestResult> {
  return sendJson<ConnectionTestResult>(
    "POST",
    `${integrationsBase(orgSlug)}/connections/${encodeURIComponent(connectionId)}/test`,
    {}
  );
}
