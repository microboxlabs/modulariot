import { NextRequest, NextResponse } from "next/server";
import { resolveSiteForRequest } from "@/app/api/utils/org-resolver";
import { validateTargetUrl } from "@/app/api/utils/url-validator";
import {
  getDataSource,
  updateDataSource,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { resolveBearerToken, buildAuthHeader } from "@/app/api/data-sources/resolve-credentials";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ dataSourceId: string }> };

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

    logger.info({ dataSourceId, config: { ...ds.config, encryptedClientSecret: ds.config?.authMethod === "OAUTH" ? "[REDACTED]" : undefined, encryptedToken: ds.config?.authMethod === "TOKEN" ? "[REDACTED]" : undefined } }, "Test: resolved data source config");

    const bearerResult = await resolveBearerToken(ds.config, dataSourceId);
    logger.info({ dataSourceId, ok: bearerResult.ok, error: !bearerResult.ok ? bearerResult.error : undefined, authMethod: bearerResult.ok ? bearerResult.authMethod : undefined }, "Test: bearer token result");

    if (!bearerResult.ok) {
      const now = new Date().toISOString();
      await updateDataSource(session, {
        nodeRef: dataSourceId,
        site: siteId,
        lastTestedAt: now,
        lastTestResult: false,
      });
      return NextResponse.json({
        success: false,
        testedAt: now,
        error: bearerResult.error,
      });
    }

    let success = false;
    let errorMessage: string | undefined;

    try {
      const specUrl = `${ds.url}/`;

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
          Authorization: buildAuthHeader(bearerResult.token, bearerResult.authMethod),
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
    const updatePayload: Record<string, unknown> = {
      nodeRef: dataSourceId,
      site: siteId,
      lastTestedAt: now,
      lastTestResult: success,
    };

    // Persist the detected token request format so future calls skip the fallback
    if (success && bearerResult.detectedFormat) {
      updatePayload.config = {
        ...ds.config,
        tokenRequestFormat: bearerResult.detectedFormat,
      };
    }

    await updateDataSource(session, updatePayload);

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
