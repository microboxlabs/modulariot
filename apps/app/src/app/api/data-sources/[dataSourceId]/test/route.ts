import { NextRequest, NextResponse } from "next/server";
import { resolveOrgForRequest } from "@/app/api/utils/org-resolver";
import * as store from "@/lib/data-source-store";
import { decrypt } from "@/lib/crypto";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ dataSourceId: string }> };

export async function POST(request: NextRequest, ctx: RouteContext) {
  const orgResult = await resolveOrgForRequest(request);
  if (!orgResult.resolved) return orgResult.response;

  const { dataSourceId } = await ctx.params;
  const { orgId } = orgResult.data;
  const ds = await store.getById(dataSourceId);

  if (!ds || ds.organizationId !== orgId) {
    return NextResponse.json(
      { error: "Data source not found" },
      { status: 404 }
    );
  }

  const { url, encryptedToken } = ds.connectionConfig;
  let success = false;
  let errorMessage: string | undefined;

  try {
    const token = decrypt(encryptedToken);
    const specUrl = `${url}/api/v1/pgrest/`;

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
  await store.findAndUpdate(dataSourceId, orgId, {
    lastTestedAt: now,
    lastTestResult: success,
  });

  return NextResponse.json({
    success,
    testedAt: now,
    ...(errorMessage ? { error: errorMessage } : {}),
  });
}
