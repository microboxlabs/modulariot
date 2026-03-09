import { NextRequest, NextResponse } from "next/server";
import { resolveSiteForRequest } from "@/app/api/utils/org-resolver";
import {
  getDataSource,
  updateDataSource,
  deleteDataSource,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import type { AlfrescoDataSource } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { encrypt, decrypt, maskToken } from "@/lib/crypto";
import { UpdateDataSourceSchema } from "@/features/data-sources/types";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ dataSourceId: string }> };

function buildMaskedResponse(ds: AlfrescoDataSource) {
  return {
    id: ds.nodeRef,
    name: ds.name,
    type: ds.type,
    description: ds.description,
    siteId: ds.site,
    connectionConfig: {
      url: ds.url,
      maskedToken: ds.tokenSuffix?.length === 4
        ? `****${ds.tokenSuffix}`
        : "****",
    },
    isActive: ds.isActive,
    lastTestedAt: ds.lastTestedAt,
    lastTestResult: ds.lastTestResult,
  };
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  const result = await resolveSiteForRequest(request);
  if (!result.resolved) return result.response;

  const { dataSourceId } = await ctx.params;
  const { session } = result.data;

  try {
    const ds = await getDataSource(session, dataSourceId);

    if (!ds?.nodeRef) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...buildMaskedResponse(ds),
      connectionConfig: {
        url: ds.url,
        maskedToken: ds.encryptedToken
          ? maskToken(decrypt(ds.encryptedToken))
          : "****",
      },
    });
  } catch (err) {
    logger.error({ err, dataSourceId }, "Failed to get data source");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const result = await resolveSiteForRequest(request);
  if (!result.resolved) return result.response;

  const { dataSourceId } = await ctx.params;
  const { siteId, session } = result.data;

  try {
    const body = await request.json();
    const parsed = UpdateDataSourceSchema.safeParse(body);

    if (parsed.error) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { url, token, description, name, type, isActive } = parsed.data;

    const updateBody: Record<string, unknown> = {
      nodeRef: dataSourceId,
      site: siteId,
    };

    if (name !== undefined) updateBody.name = name;
    if (type !== undefined) updateBody.type = type;
    if (description !== undefined) updateBody.description = description ?? "";
    if (url !== undefined) updateBody.url = url;
    if (isActive !== undefined) updateBody.isActive = isActive;

    if (token) {
      // Fetch existing to check if token is just the mask
      const existing = await getDataSource(session, dataSourceId);
      if (existing?.tokenSuffix && token === `****${existing.tokenSuffix}`) {
        // Token unchanged — keep existing encrypted value
      } else {
        updateBody.encryptedToken = encrypt(token);
        updateBody.tokenSuffix = token.length > 4 ? token.slice(-4) : "";
      }
    }

    const updated = await updateDataSource(session, updateBody);

    if (!updated?.nodeRef) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(buildMaskedResponse(updated));
  } catch (err) {
    logger.error({ err }, "Failed to update data source");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const result = await resolveSiteForRequest(request);
  if (!result.resolved) return result.response;

  const { dataSourceId } = await ctx.params;
  const { session } = result.data;

  try {
    const removed = await deleteDataSource(session, dataSourceId);
    if (!removed?.success) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, dataSourceId }, "Failed to delete data source");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
