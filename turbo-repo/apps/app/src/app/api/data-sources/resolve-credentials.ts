import { validateTargetUrl } from "@/app/api/utils/url-validator";
import type { AlfrescoDataSourceConfig } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { decrypt } from "@/lib/crypto";
import { logger } from "@/lib/logger";

export type TokenRequestFormat = "form" | "json";

export interface OAuthTokenResult {
  accessToken: string;
  /** The format that succeeded — persist this to skip the fallback next time. */
  detectedFormat: TokenRequestFormat;
}

interface OAuthTokenParams {
  grant_type: string;
  client_id: string;
  client_secret: string;
  scope?: string;
  audience?: string;
}

function buildOAuthParams(
  clientId: string,
  clientSecret: string,
  scope?: string,
  audience?: string
): OAuthTokenParams {
  const params: OAuthTokenParams = {
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  };
  if (scope) params.scope = scope;
  if (audience) params.audience = audience;
  return params;
}

function buildRequest(
  tokenUrl: string,
  params: OAuthTokenParams,
  format: TokenRequestFormat
): Request {
  if (format === "json") {
    return new Request(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    });
  }
  const entries = Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined);
  const urlParams = new URLSearchParams(entries);
  return new Request(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: urlParams.toString(),
    signal: AbortSignal.timeout(10000),
  });
}

/**
 * Returns true when the upstream error indicates the content-type was rejected,
 * meaning a retry with the other format is worthwhile.
 */
function isContentTypeRejection(status: number, body: string): boolean {
  if (status === 415) return true;
  if (status !== 400) return false;
  const lower = body.toLowerCase();
  return (
    lower.includes("unsupported media type") ||
    lower.includes("content-type") ||
    lower.includes("invalid content type") ||
    lower.includes("unexpected token") ||
    lower.includes("parse error") ||
    lower.includes("invalid json") ||
    lower.includes("could not parse")
  );
}

async function extractAccessToken(res: Response): Promise<string> {
  const json = await res.json();
  if (typeof json.access_token !== "string" || !json.access_token) {
    throw new Error("OAuth response missing or invalid access_token");
  }
  return json.access_token;
}

/**
 * Exchange OAuth2 client credentials for an access token.
 *
 * When `preferredFormat` is provided, it is used directly (no fallback).
 * When omitted, tries form-urlencoded first (RFC 6749 default), then falls back
 * to JSON if the provider rejects the content type.
 */
export async function exchangeOAuthToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  scope?: string,
  audience?: string,
  preferredFormat?: TokenRequestFormat
): Promise<OAuthTokenResult> {
  const params = buildOAuthParams(clientId, clientSecret, scope, audience);

  // If we already know the format, use it directly — no fallback.
  if (preferredFormat) {
    const res = await fetch(buildRequest(tokenUrl, params, preferredFormat));
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      logger.error(
        { status: res.status, body: text, tokenUrl, format: preferredFormat },
        "OAuth token exchange failed"
      );
      throw new Error("OAuth token exchange failed");
    }
    return {
      accessToken: await extractAccessToken(res),
      detectedFormat: preferredFormat,
    };
  }

  // Auto-detect: try form-urlencoded first, fall back to JSON on content-type rejection.
  const formRes = await fetch(buildRequest(tokenUrl, params, "form"));

  if (formRes.ok) {
    return {
      accessToken: await extractAccessToken(formRes),
      detectedFormat: "form",
    };
  }

  const formErrorBody = await formRes.text().catch(() => formRes.statusText);

  if (isContentTypeRejection(formRes.status, formErrorBody)) {
    logger.info(
      { status: formRes.status, tokenUrl },
      "Token endpoint rejected form-urlencoded, retrying with JSON"
    );

    const jsonRes = await fetch(buildRequest(tokenUrl, params, "json"));
    if (jsonRes.ok) {
      return {
        accessToken: await extractAccessToken(jsonRes),
        detectedFormat: "json",
      };
    }

    const jsonErrorBody = await jsonRes.text().catch(() => jsonRes.statusText);
    logger.error(
      { status: jsonRes.status, body: jsonErrorBody, tokenUrl, format: "json" },
      "OAuth token exchange failed (JSON fallback)"
    );
    throw new Error("OAuth token exchange failed");
  }

  // form-urlencoded failed for a reason unrelated to content type
  logger.error(
    { status: formRes.status, body: formErrorBody, tokenUrl, format: "form" },
    "OAuth token exchange failed"
  );
  throw new Error("OAuth token exchange failed");
}

export type AuthMethod = "TOKEN" | "OAUTH";

export type BearerResult =
  | { ok: true; token: string; authMethod: AuthMethod; detectedFormat?: TokenRequestFormat }
  | { ok: false; error: string };

function errorResult(err: unknown, fallback: string): BearerResult {
  return {
    ok: false,
    error: err instanceof Error ? err.message : fallback,
  };
}

async function resolveOAuthToken(
  tokenUrl: string,
  clientId: string,
  encryptedClientSecret: string,
  scope?: string,
  audience?: string,
  tokenRequestFormat?: TokenRequestFormat
): Promise<BearerResult> {
  const tokenUrlCheck = await validateTargetUrl(tokenUrl);
  if (!tokenUrlCheck.valid) {
    return { ok: false, error: `Invalid token URL: ${tokenUrlCheck.reason}` };
  }
  const clientSecret = decrypt(encryptedClientSecret);
  const { accessToken, detectedFormat } = await exchangeOAuthToken(
    tokenUrl, clientId, clientSecret, scope, audience, tokenRequestFormat
  );
  return { ok: true, token: accessToken, authMethod: "OAUTH", detectedFormat };
}

/**
 * Build the Authorization header value for a resolved token.
 * TOKEN auth uses "Bearer <token>"; OAUTH sends the raw JWT directly
 * because PostgREST instances behind OAuth typically expect the raw token.
 */
export function buildAuthHeader(token: string, authMethod: AuthMethod): string {
  return authMethod === "TOKEN" ? `Bearer ${token}` : token;
}

export async function resolveBearerToken(config: AlfrescoDataSourceConfig | null): Promise<BearerResult> {
  if (config?.authMethod === "OAUTH") {
    if (!config.encryptedClientSecret || !config.tokenUrl || !config.clientId) {
      return { ok: false, error: "OAuth configuration is incomplete" };
    }
    try {
      return await resolveOAuthToken(
        config.tokenUrl, config.clientId, config.encryptedClientSecret,
        config.scope, config.audience, config.tokenRequestFormat
      );
    } catch (err) {
      return errorResult(err, "OAuth token resolution failed");
    }
  }

  if (config?.authMethod === "TOKEN") {
    if (!config.encryptedToken) {
      return { ok: false, error: "Token is not configured" };
    }
    try {
      return { ok: true, token: decrypt(config.encryptedToken), authMethod: "TOKEN" };
    } catch (err) {
      return errorResult(err, "Token decryption failed");
    }
  }

  return { ok: false, error: "No authentication configured" };
}
