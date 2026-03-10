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
    authMethod: ds.authMethod || "TOKEN",
    connectionConfig: {
      url: ds.url,
      ...(ds.authMethod === "OAUTH"
        ? {
            clientId: ds.clientId,
            maskedClientSecret: ds.clientSecretSuffix?.length === 4
              ? `****${ds.clientSecretSuffix}`
              : "****",
            tokenUrl: ds.tokenUrl,
            scope: ds.scope,
          }
        : {
            maskedToken: ds.tokenSuffix?.length === 4
              ? `****${ds.tokenSuffix}`
              : "****",
          }),
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

    const response = buildMaskedResponse(ds);

    // For GET single, decrypt to produce a fresh mask
    const config = response.connectionConfig as Record<string, unknown>;
    if (ds.authMethod === "OAUTH" && ds.encryptedClientSecret) {
      config.maskedClientSecret = maskToken(decrypt(ds.encryptedClientSecret));
    } else if (ds.encryptedToken) {
      config.maskedToken = maskToken(decrypt(ds.encryptedToken));
    }

    return NextResponse.json(response);
  } catch (err) {
    logger.error({ err, dataSourceId }, "Failed to get data source");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function applyOptionalFields(
  updateBody: Record<string, unknown>,
  data: Record<string, unknown>
) {
  const fields = ["name", "type", "url", "isActive", "authMethod", "clientId", "tokenUrl"];
  for (const field of fields) {
    if (data[field] !== undefined) updateBody[field] = data[field];
  }
  if (data.description !== undefined) updateBody.description = data.description ?? "";
  if (data.scope !== undefined) updateBody.scope = data.scope ?? "";
}

async function resolveTokenSecret(
  session: Parameters<typeof getDataSource>[0],
  dataSourceId: string,
  token: string,
  updateBody: Record<string, unknown>
) {
  const existing = await getDataSource(session, dataSourceId);
  const isUnchanged =
    existing?.tokenSuffix && token === `****${existing.tokenSuffix}`;
  if (!isUnchanged) {
    updateBody.encryptedToken = encrypt(token);
    updateBody.tokenSuffix = token.length > 4 ? token.slice(-4) : "";
  }
}

async function resolveClientSecret(
  session: Parameters<typeof getDataSource>[0],
  dataSourceId: string,
  clientSecret: string,
  updateBody: Record<string, unknown>
) {
  const existing = await getDataSource(session, dataSourceId);
  const isUnchanged =
    existing?.clientSecretSuffix &&
    clientSecret === `****${existing.clientSecretSuffix}`;
  if (!isUnchanged) {
    updateBody.encryptedClientSecret = encrypt(clientSecret);
    updateBody.clientSecretSuffix =
      clientSecret.length > 4 ? clientSecret.slice(-4) : "";
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

    const updateBody: Record<string, unknown> = {
      nodeRef: dataSourceId,
      site: siteId,
    };

    applyOptionalFields(updateBody, parsed.data as unknown as Record<string, unknown>);

    if (parsed.data.token) {
      await resolveTokenSecret(session, dataSourceId, parsed.data.token, updateBody);
    }

    if (parsed.data.clientSecret) {
      await resolveClientSecret(session, dataSourceId, parsed.data.clientSecret, updateBody);
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
