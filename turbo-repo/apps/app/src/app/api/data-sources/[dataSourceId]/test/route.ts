import { NextRequest, NextResponse } from "next/server";
import { resolveSiteForRequest } from "@/app/api/utils/org-resolver";
import {
  getDataSource,
  updateDataSource,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import type { AlfrescoDataSourceConfig } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { resolveBearerToken } from "@/app/api/data-sources/resolve-credentials";
import type { BearerResult } from "@/app/api/data-sources/resolve-credentials";
import { testPostgrestConnection } from "@/app/api/data-sources/test-connection";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ dataSourceId: string }> };

function buildDebugConfig(config: AlfrescoDataSourceConfig | null) {
  if (config?.authMethod === "OAUTH") {
    return { ...config, encryptedClientSecret: "[REDACTED]" };
  }
  if (config?.authMethod === "TOKEN") {
    return { ...config, encryptedToken: "[REDACTED]" };
  }
  return config;
}

function buildBearerLogFields(dataSourceId: string, result: BearerResult) {
  if (result.ok) {
    return { dataSourceId, ok: true, authMethod: result.authMethod };
  }
  return { dataSourceId, ok: false, error: result.error };
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

    logger.info({ dataSourceId, config: buildDebugConfig(ds.config) }, "Test: resolved data source config");

    const bearerResult = await resolveBearerToken(ds.config, dataSourceId);
    logger.info(buildBearerLogFields(dataSourceId, bearerResult), "Test: bearer token result");

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

    const { success, errorMessage } = await testPostgrestConnection(
      ds.url, bearerResult.token, bearerResult.authMethod, dataSourceId
    );

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
