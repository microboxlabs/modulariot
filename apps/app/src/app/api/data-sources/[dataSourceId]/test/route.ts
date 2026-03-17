import { NextRequest, NextResponse } from "next/server";
import { resolveSiteForRequest } from "@/app/api/utils/org-resolver";
import { validateTargetUrl } from "@/app/api/utils/url-validator";
import {
  getDataSource,
  updateDataSource,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import type { AlfrescoDataSourceConfig } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { decrypt } from "@/lib/crypto";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ dataSourceId: string }> };

/**
 * Exchange OAuth2 client credentials for an access token.
 */
async function exchangeOAuthToken(
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

type BearerResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

async function resolveBearerToken(config: AlfrescoDataSourceConfig | null): Promise<BearerResult> {
  if (config?.authMethod === "OAUTH") {
    if (!config.encryptedClientSecret || !config.tokenUrl || !config.clientId) {
      return { ok: false, error: "OAuth configuration is incomplete" };
    }
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
  }

  if (config?.authMethod === "TOKEN") {
    if (!config.encryptedToken) {
      return { ok: false, error: "Token is not configured" };
    }
    return { ok: true, token: decrypt(config.encryptedToken) };
  }

  return { ok: false, error: "No authentication configured" };
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const result = await resolveSiteForRequest(request);
  if (!result.resolved) return result.response;

  const { dataSourceId } = await ctx.params;
  const { siteId, session } = result.data;

  try {
    const ds = await getDataSource(session, dataSourceId);

    if (!ds?.nodeRef) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 }
      );
    }

    const bearerResult = await resolveBearerToken(ds.config);
    if (!bearerResult.ok) {
      return NextResponse.json(
        { success: false, error: bearerResult.error },
        { status: 400 }
      );
    }

    let success = false;
    let errorMessage: string | undefined;

    try {
      const specUrl = `${ds.url}/api/v1/pgrest/`;

      const urlCheck = await validateTargetUrl(specUrl);
      if (!urlCheck.valid) {
        return NextResponse.json(
          { success: false, error: urlCheck.reason },
          { status: 400 }
        );
      }

      const res = await fetch(specUrl, {
        headers: {
          Accept: "application/openapi+json",
          Authorization: `Bearer ${bearerResult.token}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        await res.json();
        success = true;
      } else {
        errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      }
    } catch (err) {
      errorMessage =
        err instanceof Error ? err.message : "Connection test failed";
      logger.error({ err, dataSourceId }, "Data source connection test failed");
    }

    const now = new Date().toISOString();
    await updateDataSource(session, {
      nodeRef: dataSourceId,
      site: siteId,
      lastTestedAt: now,
      lastTestResult: success,
    });

    return NextResponse.json({
      success,
      testedAt: now,
      ...(errorMessage ? { error: errorMessage } : {}),
    });
  } catch (err) {
    logger.error({ err, dataSourceId }, "Data source test route error");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
