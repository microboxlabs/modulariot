/**
 * An access token for a Google service account, without the Google SDK.
 *
 * The account signs a JWT with its private key and exchanges it at the
 * token endpoint. `node:crypto` signs; nothing else is needed.
 */

import { createSign } from "node:crypto";

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWT_LIFETIME_SECONDS = 3600;

export interface ServiceAccountGrant {
  clientEmail: string;
  /** PEM. Escaped `\n` sequences, as a JSON key file carries them, are accepted. */
  privateKey: string;
  /** Space-separated OAuth scopes. */
  scope: string;
  tokenUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface AccessToken {
  token: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

export class ServiceAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceAccountError";
  }
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/** The signed assertion the token endpoint takes. */
export function signAssertion(
  grant: ServiceAccountGrant,
  nowSeconds: number,
): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: grant.clientEmail,
      scope: grant.scope,
      aud: grant.tokenUrl ?? GOOGLE_TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + JWT_LIFETIME_SECONDS,
    }),
  );
  const input = `${header}.${claims}`;
  let signature: string;
  try {
    signature = createSign("RSA-SHA256")
      .update(input)
      .sign(grant.privateKey.replace(/\\n/g, "\n"), "base64url");
  } catch {
    // The error would quote the key material it could not parse.
    throw new ServiceAccountError("The private key is not a usable RSA key");
  }
  return `${input}.${signature}`;
}

export async function serviceAccountAccessToken(
  grant: ServiceAccountGrant,
): Promise<AccessToken> {
  const now = grant.now ?? Date.now;
  const tokenUrl = grant.tokenUrl ?? GOOGLE_TOKEN_URL;
  const assertion = signAssertion(grant, Math.floor(now() / 1000));
  const call = grant.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await call(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(grant.timeoutMs ?? 8000),
    });
  } catch {
    throw new ServiceAccountError("The token endpoint could not be reached");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ServiceAccountError(
      `The token endpoint answered ${response.status} without JSON`,
    );
  }
  const record =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  if (!response.ok) {
    // `error` is a fixed code such as invalid_grant. `error_description`
    // is free text and is left out.
    const code = typeof record.error === "string" ? record.error : "no code";
    throw new ServiceAccountError(
      `The token endpoint refused the service account (${response.status}, ${code})`,
    );
  }
  const token = record.access_token;
  if (typeof token !== "string" || token.length === 0) {
    throw new ServiceAccountError(
      "The token endpoint answered no access_token",
    );
  }
  const expiresIn =
    typeof record.expires_in === "number" ? record.expires_in : 3600;
  return { token, expiresAt: now() + expiresIn * 1000 };
}
