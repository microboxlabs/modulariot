import { validateTargetUrl } from "@/app/api/utils/url-validator";
import type { AlfrescoDataSourceConfig } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { decrypt } from "@/lib/crypto";
import { logger } from "@/lib/logger";

export type TokenRequestFormat = "form" | "json";

export interface OAuthTokenResult {
  accessToken: string;
  /** The format that succeeded — persist this to skip the fallback next time. */
  detectedFormat: TokenRequestFormat;
  /** When the token expires (Unix ms). */
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// In-memory token cache (per data source)
// ---------------------------------------------------------------------------

const TOKEN_EXPIRY_BUFFER_MS = 60_000; // refresh 60s before expiry
const DEFAULT_EXPIRES_IN_S = 3600; // 1 hour fallback per RFC 6749 §4.2.2

interface CachedToken {
  accessToken: string;
  detectedFormat: TokenRequestFormat;
  expiresAt: number; // Unix ms
  configFingerprint: string;
}

const tokenCache = new Map<string, CachedToken>();
const inflightRequests = new Map<string, { fingerprint: string; promise: Promise<CachedToken> }>();

function computeConfigFingerprint(
  tokenUrl: string,
  clientId: string,
  secretSuffix?: string,
  scope?: string,
  audience?: string
): string {
  return `${tokenUrl}|${clientId}|${secretSuffix ?? ""}|${scope ?? ""}|${audience ?? ""}`;
}

/**
 * Remove cached token for a data source. Call this when config changes.
 */
export function invalidateTokenCache(dataSourceId: string): void {
  tokenCache.delete(dataSourceId);
  inflightRequests.delete(dataSourceId);
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

function extractOAuthError(body: string): string {
  try {
    const json = JSON.parse(body);
    return json.error_description || json.error || json.message || body.substring(0, 200);
  } catch {
    return body.substring(0, 200);
  }
}

async function extractTokenWithExpiry(
  res: Response
): Promise<{ accessToken: string; expiresAt: number }> {
  const json = await res.json();
  if (typeof json.access_token !== "string" || !json.access_token) {
    throw new Error("OAuth response missing or invalid access_token");
  }

  let expiresAt: number;
  if (typeof json.expires_in === "number" && json.expires_in > 0) {
    expiresAt = Date.now() + json.expires_in * 1000;
  } else if (typeof json.expires_at === "number" && json.expires_at > 0) {
    expiresAt = json.expires_at * 1000;
  } else {
    expiresAt = Date.now() + DEFAULT_EXPIRES_IN_S * 1000;
  }

  return { accessToken: json.access_token, expiresAt };
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
      throw new Error(`OAuth token exchange failed: HTTP ${res.status} — ${extractOAuthError(text)}`);
    }
    const extracted = await extractTokenWithExpiry(res);
    return {
      ...extracted,
      detectedFormat: preferredFormat,
    };
  }

  // Auto-detect: try form-urlencoded first, fall back to JSON on content-type rejection.
  const formRes = await fetch(buildRequest(tokenUrl, params, "form"));

  if (formRes.ok) {
    const extracted = await extractTokenWithExpiry(formRes);
    return {
      ...extracted,
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
      const extracted = await extractTokenWithExpiry(jsonRes);
      return {
        ...extracted,
        detectedFormat: "json",
      };
    }

    const jsonErrorBody = await jsonRes.text().catch(() => jsonRes.statusText);
    logger.error(
      { status: jsonRes.status, body: jsonErrorBody, tokenUrl, format: "json" },
      "OAuth token exchange failed (JSON fallback)"
    );
    throw new Error(`OAuth token exchange failed: HTTP ${jsonRes.status} — ${extractOAuthError(jsonErrorBody)}`);
  }

  // form-urlencoded failed for a reason unrelated to content type
  logger.error(
    { status: formRes.status, body: formErrorBody, tokenUrl, format: "form" },
    "OAuth token exchange failed"
  );
  throw new Error(`OAuth token exchange failed: HTTP ${formRes.status} — ${extractOAuthError(formErrorBody)}`);
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

interface TokenFetchParams {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  audience?: string;
  preferredFormat?: TokenRequestFormat;
}

/**
 * Get a cached token or fetch a new one. Concurrent callers for the same
 * data source share a single in-flight request (deduplication).
 */
async function getOrRefreshToken(
  dataSourceId: string,
  params: TokenFetchParams,
  fingerprint: string
): Promise<CachedToken> {
  const cached = tokenCache.get(dataSourceId);
  if (
    cached?.configFingerprint === fingerprint &&
    cached.expiresAt - Date.now() > TOKEN_EXPIRY_BUFFER_MS
  ) {
    return cached;
  }

  // Deduplicate: reuse an in-flight request only if fingerprint matches.
  const inflight = inflightRequests.get(dataSourceId);
  if (inflight?.fingerprint === fingerprint) return inflight.promise;

  const promise = exchangeOAuthToken(
    params.tokenUrl, params.clientId, params.clientSecret,
    params.scope, params.audience, params.preferredFormat
  ).then((result) => {
    const entry: CachedToken = {
      accessToken: result.accessToken,
      detectedFormat: result.detectedFormat,
      expiresAt: result.expiresAt,
      configFingerprint: fingerprint,
    };
    tokenCache.set(dataSourceId, entry);
    inflightRequests.delete(dataSourceId);
    return entry;
  }).catch((err) => {
    inflightRequests.delete(dataSourceId);
    throw err;
  });

  inflightRequests.set(dataSourceId, { fingerprint, promise });
  return promise;
}

interface ResolveOAuthParams {
  tokenUrl: string;
  clientId: string;
  encryptedClientSecret: string;
  scope?: string;
  audience?: string;
  tokenRequestFormat?: TokenRequestFormat;
  dataSourceId?: string;
  clientSecretSuffix?: string;
}

async function resolveOAuthToken(params: ResolveOAuthParams): Promise<BearerResult> {
  const { tokenUrl, clientId, encryptedClientSecret, scope, audience,
    tokenRequestFormat, dataSourceId, clientSecretSuffix } = params;

  const tokenUrlCheck = await validateTargetUrl(tokenUrl);
  if (!tokenUrlCheck.valid) {
    return { ok: false, error: `Invalid token URL: ${tokenUrlCheck.reason}` };
  }
  const clientSecret = decrypt(encryptedClientSecret);

  // When a dataSourceId is available, use the cache.
  if (dataSourceId) {
    const fingerprint = computeConfigFingerprint(
      tokenUrl, clientId, clientSecretSuffix, scope, audience
    );
    const cached = await getOrRefreshToken(
      dataSourceId,
      { tokenUrl, clientId, clientSecret, scope, audience, preferredFormat: tokenRequestFormat },
      fingerprint
    );
    return {
      ok: true,
      token: cached.accessToken,
      authMethod: "OAUTH",
      detectedFormat: cached.detectedFormat,
    };
  }

  // Fallback: no cache when dataSourceId is not provided.
  const { accessToken, detectedFormat } = await exchangeOAuthToken(
    tokenUrl, clientId, clientSecret, scope, audience, tokenRequestFormat
  );
  return { ok: true, token: accessToken, authMethod: "OAUTH", detectedFormat };
}

/**
 * Build the Authorization header value for a resolved token.
 * Both TOKEN and OAUTH use "Bearer <token>" — PostgREST always expects
 * the standard Authorization: Bearer header regardless of token origin.
 */
export function buildAuthHeader(token: string, _authMethod: AuthMethod): string {
  return `Bearer ${token}`;
}

export async function resolveBearerToken(
  config: AlfrescoDataSourceConfig | null,
  dataSourceId?: string
): Promise<BearerResult> {
  if (config?.authMethod === "OAUTH") {
    if (!config.encryptedClientSecret || !config.tokenUrl || !config.clientId) {
      return { ok: false, error: "OAuth configuration is incomplete" };
    }
    try {
      return await resolveOAuthToken({
        tokenUrl: config.tokenUrl, clientId: config.clientId,
        encryptedClientSecret: config.encryptedClientSecret,
        scope: config.scope, audience: config.audience,
        tokenRequestFormat: config.tokenRequestFormat,
        dataSourceId, clientSecretSuffix: config.clientSecretSuffix,
      });
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
