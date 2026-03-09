import { NextRequest, NextResponse } from "next/server";
import { resolveSiteForRequest } from "@/app/api/utils/org-resolver";
import { validateTargetUrl } from "@/app/api/utils/url-validator";
import {
  getDataSource,
  updateDataSource,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { decrypt } from "@/lib/crypto";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ dataSourceId: string }> };

export async function POST(request: NextRequest, ctx: RouteContext) {
  const result = await resolveSiteForRequest(request);
  if (!result.resolved) return result.response;

  const { dataSourceId } = await ctx.params;
  const { siteId, session } = result.data;

  const ds = await getDataSource(session, dataSourceId);

  if (!ds?.nodeRef) {
    return NextResponse.json(
      { error: "Data source not found" },
      { status: 404 }
    );
  }

  const { url, encryptedToken } = ds;
  let success = false;
  let errorMessage: string | undefined;

  try {
    const token = decrypt(encryptedToken);
    const specUrl = `${url}/api/v1/pgrest/`;

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
        Authorization: `Bearer ${token}`,
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
}
