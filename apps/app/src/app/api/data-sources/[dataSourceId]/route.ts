import { NextRequest, NextResponse } from "next/server";
import { resolveOrgForRequest } from "@/app/api/utils/org-resolver";
import * as store from "@/lib/data-source-store";
import { encrypt, decrypt, maskToken } from "@/lib/crypto";
import { UpdateDataSourceSchema } from "@/features/data-sources/types";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ dataSourceId: string }> };

export async function GET(request: NextRequest, ctx: RouteContext) {
  const orgResult = await resolveOrgForRequest(request);
  if (!orgResult.resolved) return orgResult.response;

  const { dataSourceId } = await ctx.params;
  const ds = await store.getById(dataSourceId);

  if (!ds || ds.organizationId !== orgResult.data.orgId) {
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
      // We need the existing record to merge connection config
      const existing = await store.getById(dataSourceId);
      if (!existing || existing.organizationId !== orgId) {
        return NextResponse.json(
          { error: "Data source not found" },
          { status: 404 }
        );
      }
      const connectionConfig = { ...existing.connectionConfig };
      if (url) connectionConfig.url = url;
      if (token && !token.startsWith("****")) {
        connectionConfig.encryptedToken = encrypt(token);
        connectionConfig.tokenSuffix = token.slice(-4);
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

    return NextResponse.json({
      ...updated,
      connectionConfig: {
        url: updated.connectionConfig.url,
        maskedToken: updated.connectionConfig.tokenSuffix
          ? `****${updated.connectionConfig.tokenSuffix}`
          : "****",
      },
    });
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

  const removed = await store.findAndRemove(dataSourceId, orgId);
  if (!removed) {
    return NextResponse.json(
      { error: "Data source not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
