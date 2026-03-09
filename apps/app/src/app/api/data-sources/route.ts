import { NextRequest, NextResponse } from "next/server";
import { resolveSiteForRequest } from "@/app/api/utils/org-resolver";
import {
  listDataSources,
  createDataSource,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { encrypt, maskToken } from "@/lib/crypto";
import { CreateDataSourceSchema } from "@/features/data-sources/types";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const result = await resolveSiteForRequest(request);
  if (!result.resolved) return result.response;

  const { siteId, session } = result.data;

  try {
    const { dataSources } = await listDataSources(session, siteId);

    const masked = dataSources.map((ds) => ({
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
    }));

    return NextResponse.json(masked);
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

    const { name, type, description, url, token } = parsed.data;

    const created = await createDataSource(session, {
      site: siteId,
      name,
      type,
      description,
      url,
      encryptedToken: encrypt(token),
      tokenSuffix: token.length > 4 ? token.slice(-4) : "",
      isActive: true,
    });

    return NextResponse.json(
      {
        id: created.nodeRef,
        name: created.name || name,
        type: created.type || type,
        description: created.description ?? description,
        siteId,
        connectionConfig: {
          url: created.url || url,
          maskedToken: maskToken(token),
        },
        isActive: created.isActive ?? true,
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error({ err }, "Failed to create data source");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
