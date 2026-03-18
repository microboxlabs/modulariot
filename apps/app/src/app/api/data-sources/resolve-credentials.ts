import { validateTargetUrl } from "@/app/api/utils/url-validator";
import type { AlfrescoDataSourceConfig } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { decrypt } from "@/lib/crypto";

/**
 * Exchange OAuth2 client credentials for an access token.
 */
export async function exchangeOAuthToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  scope?: string
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (scope) params.set("scope", scope);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`OAuth token exchange failed: HTTP ${res.status} — ${text}`);
  }

  const json = await res.json();
  if (typeof json.access_token !== "string" || !json.access_token) {
    throw new Error("OAuth response missing or invalid access_token");
  }
  return json.access_token;
}

export type BearerResult =
  | { ok: true; token: string }
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
  scope?: string
): Promise<BearerResult> {
  const tokenUrlCheck = await validateTargetUrl(tokenUrl);
  if (!tokenUrlCheck.valid) {
    return { ok: false, error: `Invalid token URL: ${tokenUrlCheck.reason}` };
  }
  const clientSecret = decrypt(encryptedClientSecret);
  const token = await exchangeOAuthToken(tokenUrl, clientId, clientSecret, scope);
  return { ok: true, token };
}

export async function resolveBearerToken(config: AlfrescoDataSourceConfig | null): Promise<BearerResult> {
  if (config?.authMethod === "OAUTH") {
    if (!config.encryptedClientSecret || !config.tokenUrl || !config.clientId) {
      return { ok: false, error: "OAuth configuration is incomplete" };
    }
    try {
      return await resolveOAuthToken(
        config.tokenUrl, config.clientId, config.encryptedClientSecret, config.scope
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
      return { ok: true, token: decrypt(config.encryptedToken) };
    } catch (err) {
      return errorResult(err, "Token decryption failed");
    }
  }

  return { ok: false, error: "No authentication configured" };
}
