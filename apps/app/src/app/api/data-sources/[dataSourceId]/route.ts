import { NextRequest, NextResponse } from "next/server";
import { resolveOrgForRequest } from "@/app/api/utils/org-resolver";
import * as store from "@/lib/data-source-store";
import { encrypt, decrypt, maskToken } from "@/lib/crypto";
import { UpdateDataSourceSchema } from "@/features/data-sources/types";
import { logger } from "@/lib/logger";
import type { DataSourceRecord } from "@/lib/data-source-store";

type RouteContext = { params: Promise<{ dataSourceId: string }> };

function buildMaskedResponse(ds: DataSourceRecord) {
  return {
    ...ds,
    connectionConfig: {
      url: ds.connectionConfig.url,
      maskedToken: ds.connectionConfig.tokenSuffix
        ? `****${ds.connectionConfig.tokenSuffix}`
        : "****",
    },
  };
}

async function buildConnectionConfig(
  dataSourceId: string,
  orgId: string,
  url?: string,
  token?: string
) {
  const existing = await store.getById(dataSourceId);
  if (existing?.organizationId !== orgId) {
    return undefined;
  }
  const connectionConfig = { ...existing.connectionConfig };
  if (url) connectionConfig.url = url;
  if (!token || token === `****${existing.connectionConfig.tokenSuffix}`) {
    return connectionConfig;
  }
  connectionConfig.encryptedToken = encrypt(token);
  connectionConfig.tokenSuffix = token.slice(-4);
  return connectionConfig;
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  const orgResult = await resolveOrgForRequest(request);
  if (!orgResult.resolved) return orgResult.response;

  const { dataSourceId } = await ctx.params;
  const { orgId } = orgResult.data;

  try {
    const ds = await store.getById(dataSourceId);

    if (ds?.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...ds,
      connectionConfig: {
        url: ds.connectionConfig.url,
        maskedToken: maskToken(decrypt(ds.connectionConfig.encryptedToken)),
      },
    });
  } catch (err) {
    logger.error({ err, dataSourceId, orgId }, "Failed to get data source");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const orgResult = await resolveOrgForRequest(request);
  if (!orgResult.resolved) return orgResult.response;

  const { dataSourceId } = await ctx.params;
  const { orgId } = orgResult.data;

  try {
    const body = await request.json();
    const parsed = UpdateDataSourceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { url, token, description, ...rest } = parsed.data;

    const updateData: Parameters<typeof store.findAndUpdate>[2] = {
      ...rest,
      ...(description !== undefined
        ? { description: description ?? undefined }
        : {}),
    };

    if (url || token) {
      const connectionConfig = await buildConnectionConfig(dataSourceId, orgId, url, token);
      if (!connectionConfig) {
        return NextResponse.json(
          { error: "Data source not found" },
          { status: 404 }
        );
      }
      updateData.connectionConfig = connectionConfig;
    }

    const updated = await store.findAndUpdate(dataSourceId, orgId, updateData);

    if (!updated) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(buildMaskedResponse(updated));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update data source";
    logger.error({ err }, "Failed to update data source");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const orgResult = await resolveOrgForRequest(request);
  if (!orgResult.resolved) return orgResult.response;

  const { dataSourceId } = await ctx.params;
  const { orgId } = orgResult.data;

  try {
    const removed = await store.findAndRemove(dataSourceId, orgId);
    if (!removed) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, dataSourceId, orgId }, "Failed to delete data source");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
