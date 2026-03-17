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
  if (!json.access_token) {
    throw new Error("OAuth response missing access_token");
  }
  return json.access_token as string;
}

export type BearerResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

export async function resolveBearerToken(config: AlfrescoDataSourceConfig | null): Promise<BearerResult> {
  if (config?.authMethod === "OAUTH") {
    if (!config.encryptedClientSecret || !config.tokenUrl || !config.clientId) {
      return { ok: false, error: "OAuth configuration is incomplete" };
    }
    try {
      const tokenUrlCheck = await validateTargetUrl(config.tokenUrl);
      if (!tokenUrlCheck.valid) {
        return { ok: false, error: `Invalid token URL: ${tokenUrlCheck.reason}` };
      }
      const clientSecret = decrypt(config.encryptedClientSecret);
      const token = await exchangeOAuthToken(
        config.tokenUrl,
        config.clientId,
        clientSecret,
        config.scope
      );
      return { ok: true, token };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "OAuth token resolution failed",
      };
    }
  }

  if (config?.authMethod === "TOKEN") {
    if (!config.encryptedToken) {
      return { ok: false, error: "Token is not configured" };
    }
    try {
      return { ok: true, token: decrypt(config.encryptedToken) };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Token decryption failed",
      };
    }
  }

  return { ok: false, error: "No authentication configured" };
}
