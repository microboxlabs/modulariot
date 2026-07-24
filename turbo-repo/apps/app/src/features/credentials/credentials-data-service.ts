"use client";

import { ApiError } from "@/features/settings-admin/data/settings-admin-data-service";
import type {
  AzureEntraFormData,
  CredentialListItem,
  CredentialTestResult,
  CredentialTypeId,
  CredentialUsage,
} from "./credential.types";

/**
 * Client-side wrappers around the Next.js admin proxy routes for credentials, which
 * forward to miot-integrations. Throw {@link ApiError} on non-2xx so SWR surfaces it.
 *
 * The secret half only ever travels outbound: no response carries it, and the edit form
 * submits an empty secret to mean "keep the stored one".
 */

/** `CredentialProfileResponse` as miot-integrations serializes it. */
interface CredentialProfileResponse {
  readonly id: string;
  readonly displayName: string;
  readonly credentialType: CredentialTypeId;
  readonly environment: string;
  readonly publicConfig: Record<string, unknown>;
  readonly summary: string | null;
  readonly secretPreview: string | null;
  readonly secretVersion: number;
  readonly lastTestedAt: string | null;
  readonly lastTestResult: boolean | null;
  readonly usedBy: readonly CredentialUsage[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
}

interface CredentialTestResponse {
  readonly success: boolean;
  readonly message: string | null;
  readonly expiresInSeconds: number | null;
}

const base = (orgSlug: string) =>
  `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/integrations/credential-profiles`;

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
  const res = await fetch(url);
  if (!res.ok) throw await readError(res, url);
  return (await res.json()) as T;
}

async function sendJson<T>(
  method: string,
  url: string,
  body?: unknown
): Promise<T> {
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

/**
 * The API's shape into the one the screen renders. Field for field, except that the
 * backend calls a credential's name its display name, and null means absent here.
 */
function toListItem(response: CredentialProfileResponse): CredentialListItem {
  return {
    id: response.id,
    name: response.displayName,
    typeId: response.credentialType,
    environment: response.environment,
    summary: response.summary ?? response.secretPreview ?? "",
    ...(response.lastTestedAt ? { lastTestedAt: response.lastTestedAt } : {}),
    ...(response.lastTestResult === null
      ? {}
      : { lastTestResult: response.lastTestResult }),
    usedBy: response.usedBy ?? [],
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    updatedBy: response.updatedBy ?? response.createdBy ?? "",
    config: toStringConfig(response.publicConfig),
  };
}

/** publicConfig is free-form JSON upstream; the forms only ever put strings in it. */
function toStringConfig(config: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(config ?? {})
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)])
  );
}

function toPublicConfig(form: AzureEntraFormData): Record<string, string> {
  return {
    tenantId: form.tenantId,
    clientId: form.clientId,
    scope: form.scope,
    tokenRequestFormat: form.tokenRequestFormat,
    // Only sent when set: a blank override would otherwise replace the derived endpoint.
    ...(form.tokenUrlOverride?.trim()
      ? { tokenUrlOverride: form.tokenUrlOverride.trim() }
      : {}),
  };
}

function toTestResult(response: CredentialTestResponse): CredentialTestResult {
  return {
    success: response.success,
    message: response.message ?? "",
    ...(response.expiresInSeconds
      ? { expiresInSeconds: response.expiresInSeconds }
      : {}),
  };
}

export function fetchCredentials(
  orgSlug: string
): Promise<readonly CredentialListItem[]> {
  return getJson<CredentialProfileResponse[]>(base(orgSlug)).then((rows) =>
    rows.map(toListItem)
  );
}

export function createCredential(
  orgSlug: string,
  typeId: CredentialTypeId,
  form: AzureEntraFormData
): Promise<CredentialListItem> {
  return sendJson<CredentialProfileResponse>("POST", base(orgSlug), {
    displayName: form.name,
    credentialType: typeId,
    environment: form.environment,
    publicConfig: toPublicConfig(form),
    secretConfig: { clientSecret: form.clientSecret },
  }).then(toListItem);
}

/**
 * A blank secret leaves the stored one alone — the form cannot show it, so it has
 * nothing to resubmit.
 */
export function updateCredential(
  orgSlug: string,
  id: string,
  form: AzureEntraFormData
): Promise<CredentialListItem> {
  const secret = form.clientSecret?.trim();
  return sendJson<CredentialProfileResponse>(
    "PATCH",
    `${base(orgSlug)}/${encodeURIComponent(id)}`,
    {
      displayName: form.name,
      environment: form.environment,
      publicConfig: toPublicConfig(form),
      ...(secret ? { secretConfig: { clientSecret: secret } } : {}),
    }
  ).then(toListItem);
}

/**
 * @param force delete even though consumers reference it. Set once the operator has
 *              been shown those consumers and confirmed anyway; without it the API
 *              answers 409 and names them, which is what should happen when the list
 *              the operator saw was already stale.
 */
export function deleteCredential(
  orgSlug: string,
  id: string,
  force: boolean
): Promise<void> {
  return sendJson<void>(
    "DELETE",
    `${base(orgSlug)}/${encodeURIComponent(id)}${force ? "?force=true" : ""}`
  );
}

/** Exercises a stored credential; the outcome is recorded on it upstream. */
export function testCredential(
  orgSlug: string,
  id: string
): Promise<CredentialTestResult> {
  return sendJson<CredentialTestResponse>(
    "POST",
    `${base(orgSlug)}/${encodeURIComponent(id)}/test`
  ).then(toTestResult);
}

/** Exercises a credential that has not been saved yet. Nothing is persisted. */
export function testCredentialConfig(
  orgSlug: string,
  typeId: CredentialTypeId,
  form: AzureEntraFormData
): Promise<CredentialTestResult> {
  return sendJson<CredentialTestResponse>("POST", `${base(orgSlug)}/test`, {
    credentialType: typeId,
    publicConfig: toPublicConfig(form),
    secretConfig: { clientSecret: form.clientSecret },
  }).then(toTestResult);
}
