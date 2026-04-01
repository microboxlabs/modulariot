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
import { buildMaskedResponse } from "../utils";

type RouteContext = { params: Promise<{ dataSourceId: string }> };

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
    const connConfig = response.connectionConfig as Record<string, unknown>;
    if (ds.config?.authMethod === "OAUTH" && ds.config.encryptedClientSecret) {
      connConfig.maskedClientSecret = maskToken(decrypt(ds.config.encryptedClientSecret));
    } else if (ds.config?.authMethod === "TOKEN" && ds.config.encryptedToken) {
      connConfig.maskedToken = maskToken(decrypt(ds.config.encryptedToken));
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
  const fields = ["name", "type", "url", "isActive"];
  for (const field of fields) {
    if (data[field] !== undefined) updateBody[field] = data[field];
  }
  if (data.description !== undefined) updateBody.description = data.description ?? "";
}

function resolveTokenSecret(
  existingConfig: AlfrescoDataSource["config"],
  token: string,
  configObj: Record<string, unknown>
) {
  const existingSuffix = existingConfig?.authMethod === "TOKEN" ? existingConfig.tokenSuffix : undefined;
  const isUnchanged = existingSuffix && token === `****${existingSuffix}`;
  if (!isUnchanged) {
    configObj.encryptedToken = encrypt(token);
    configObj.tokenSuffix = token.length > 4 ? token.slice(-4) : "";
  }
}

function resolveClientSecret(
  existingConfig: AlfrescoDataSource["config"],
  clientSecret: string,
  configObj: Record<string, unknown>
) {
  const existingSuffix = existingConfig?.authMethod === "OAUTH" ? existingConfig.clientSecretSuffix : undefined;
  const isUnchanged = existingSuffix && clientSecret === `****${existingSuffix}`;
  if (!isUnchanged) {
    configObj.encryptedClientSecret = encrypt(clientSecret);
    configObj.clientSecretSuffix =
      clientSecret.length > 4 ? clientSecret.slice(-4) : "";
  }
}

async function buildConfigFromParsedData(
  data: { authMethod?: string; token?: string; clientId?: string; clientSecret?: string; tokenUrl?: string; scope?: string | null; audience?: string | null },
  session: Parameters<typeof getDataSource>[0],
  dataSourceId: string
): Promise<Record<string, unknown> | null> {
  const { authMethod, token, clientId, clientSecret, tokenUrl, scope, audience } = data;
  const hasAuthChanges = authMethod !== undefined || token || clientId !== undefined
    || clientSecret || tokenUrl !== undefined || scope !== undefined || audience !== undefined;

  if (!hasAuthChanges) return null;

  const existing = await getDataSource(session, dataSourceId);
  const existingConfig = existing?.config;

  const configObj: Record<string, unknown> = {};
  if (authMethod !== undefined) configObj.authMethod = authMethod;
  if (clientId !== undefined) configObj.clientId = clientId;
  if (tokenUrl !== undefined) configObj.tokenUrl = tokenUrl;
  if (scope !== undefined) configObj.scope = scope ?? "";
  if (audience !== undefined) configObj.audience = audience ?? "";

  // Determine effective auth method (incoming or existing)
  const effectiveAuthMethod = authMethod ?? existingConfig?.authMethod;

  if (token) {
    resolveTokenSecret(existingConfig, token, configObj);
  }
  if (clientSecret) {
    resolveClientSecret(existingConfig, clientSecret, configObj);
  }

  // When switching auth methods, clear stale credentials from the opposite method
  if (authMethod !== undefined && authMethod !== existingConfig?.authMethod) {
    if (effectiveAuthMethod === "TOKEN") {
      configObj.encryptedClientSecret = "";
      configObj.clientSecretSuffix = "";
      configObj.clientId = "";
      configObj.tokenUrl = "";
      configObj.scope = "";
      configObj.audience = "";
    } else if (effectiveAuthMethod === "OAUTH") {
      configObj.encryptedToken = "";
      configObj.tokenSuffix = "";
    }
  }

  return configObj;
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

    const configObj = await buildConfigFromParsedData(parsed.data, session, dataSourceId);
    if (configObj) {
      updateBody.config = configObj;
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
