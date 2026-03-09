import { NextRequest, NextResponse } from "next/server";
import { resolveOrgForRequest } from "@/app/api/utils/org-resolver";
import * as store from "@/lib/data-source-store";
import { ConflictError } from "@/lib/data-source-store";
import { encrypt, maskToken } from "@/lib/crypto";
import { CreateDataSourceSchema } from "@/features/data-sources/types";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const orgResult = await resolveOrgForRequest(request);
  if (!orgResult.resolved) return orgResult.response;

  const { orgId } = orgResult.data;

  try {
    const dataSources = await store.listByOrg(orgId);

    const masked = dataSources.map((ds) => ({
      ...ds,
      connectionConfig: {
        url: ds.connectionConfig.url,
        maskedToken: ds.connectionConfig.tokenSuffix?.length === 4
          ? `****${ds.connectionConfig.tokenSuffix}`
          : "****",
      },
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
  const orgResult = await resolveOrgForRequest(request);
  if (!orgResult.resolved) return orgResult.response;

  const { orgId } = orgResult.data;

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

    const record = await store.create({
      name,
      type,
      description,
      organizationId: orgId,
      connectionConfig: {
        url,
        encryptedToken: encrypt(token),
        tokenSuffix: token.length > 4 ? token.slice(-4) : "",
      },
      isActive: true,
    });

    return NextResponse.json(
      {
        ...record,
        connectionConfig: {
          url: record.connectionConfig.url,
          maskedToken: maskToken(token),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    logger.error({ err }, "Failed to create data source");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
