import { NextRequest, NextResponse } from "next/server";
import { resolveSiteForRequest } from "@/app/api/utils/org-resolver";
import {
  listDataSources,
  createDataSource,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import type { AlfrescoDataSource } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { encrypt, maskToken } from "@/lib/crypto";
import { CreateDataSourceSchema } from "@/features/data-sources/types";
import { logger } from "@/lib/logger";

function buildMaskedResponse(ds: AlfrescoDataSource) {
  const authMethod = ds.config?.authMethod || "TOKEN";
  let authFields: Record<string, unknown>;

  if (ds.config?.authMethod === "OAUTH") {
    authFields = {
      clientId: ds.config.clientId,
      maskedClientSecret: ds.config.clientSecretSuffix?.length === 4
        ? `****${ds.config.clientSecretSuffix}`
        : "****",
      tokenUrl: ds.config.tokenUrl,
      scope: ds.config.scope,
    };
  } else {
    const tokenSuffix = ds.config?.authMethod === "TOKEN" ? ds.config.tokenSuffix : undefined;
    authFields = {
      maskedToken: tokenSuffix?.length === 4
        ? `****${tokenSuffix}`
        : "****",
    };
  }

  return {
    id: ds.nodeRef,
    name: ds.name,
    type: ds.type,
    description: ds.description,
    siteId: ds.site,
    authMethod,
    connectionConfig: {
      url: ds.url,
      ...authFields,
    },
    isActive: ds.isActive,
    lastTestedAt: ds.lastTestedAt,
    lastTestResult: ds.lastTestResult,
  };
}

export async function GET(request: NextRequest) {
  const result = await resolveSiteForRequest(request);
  if (!result.resolved) return result.response;

  const { siteId, session } = result.data;

  try {
    const { dataSources } = await listDataSources(session, siteId);
    return NextResponse.json(dataSources.map(buildMaskedResponse));
  } catch (err) {
    logger.error({ err }, "Failed to list data sources");
    return NextResponse.json(
      { error: "Failed to list data sources" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const result = await resolveSiteForRequest(request);
  if (!result.resolved) return result.response;

  const { siteId, session } = result.data;

  try {
    const body = await request.json();
    const parsed = CreateDataSourceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, type, description, url, authMethod } = parsed.data;

    let config: Record<string, unknown>;

    if (authMethod === "TOKEN") {
      const { token } = parsed.data;
      config = {
        authMethod: "TOKEN",
        encryptedToken: encrypt(token),
        tokenSuffix: token.length > 4 ? token.slice(-4) : "",
      };
    } else {
      const { clientId, clientSecret, tokenUrl, scope } = parsed.data;
      config = {
        authMethod: "OAUTH",
        clientId,
        encryptedClientSecret: encrypt(clientSecret),
        clientSecretSuffix: clientSecret.length > 4 ? clientSecret.slice(-4) : "",
        tokenUrl,
        scope,
      };
    }

    const alfrescoBody: Record<string, unknown> = {
      site: siteId,
      name,
      type,
      description,
      url,
      config,
      isActive: true,
    };

    const created = await createDataSource(session, alfrescoBody);

    // Build response with masked secrets
    const response: Record<string, unknown> = {
      id: created.nodeRef,
      name: created.name || name,
      type: created.type || type,
      description: created.description ?? description,
      siteId,
      authMethod,
      isActive: created.isActive ?? true,
    };

    if (authMethod === "TOKEN") {
      const { token } = parsed.data;
      response.connectionConfig = {
        url: created.url || url,
        maskedToken: maskToken(token),
      };
    } else {
      const { clientId, clientSecret, tokenUrl, scope } = parsed.data;
      response.connectionConfig = {
        url: created.url || url,
        clientId,
        maskedClientSecret: maskToken(clientSecret),
        tokenUrl,
        scope,
      };
    }

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    logger.error({ err }, "Failed to create data source");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
