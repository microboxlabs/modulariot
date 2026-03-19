import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import {
  getDataSource,
  type AlfrescoDataSource,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { resolveBearerToken } from "@/app/api/data-sources/resolve-credentials";
import { validateTargetUrl } from "@/app/api/utils/url-validator";

interface OpenApiParameter {
  name: string;
  in: string;
  format?: string;
  type?: string;
}

interface OpenApiOperation {
  parameters?: OpenApiParameter[];
}

export interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
}

export interface OpenApiSpec {
  paths?: Record<string, OpenApiPathItem>;
}

/**
 * Extract `dataSourceId` from a request's query params.
 */
export function parseDataSourceParam(req: NextRequest): string | null {
  return new URL(req.url).searchParams.get("dataSourceId");
}

/**
 * Resolve credentials for a specific data source stored in Alfresco.
 * Returns `{ baseUrl, token }` on success or a NextResponse error to forward.
 */
export async function resolveDataSourceCredentials(
  session: Session,
  dataSourceId: string
): Promise<{ baseUrl: string; token: string } | NextResponse> {
  let ds: AlfrescoDataSource;
  try {
    ds = await getDataSource(session, dataSourceId);
  } catch {
    return NextResponse.json(
      { error: "Data source not found" },
      { status: 404 }
    );
  }

  if (!ds?.nodeRef) {
    return NextResponse.json(
      { error: "Data source not found" },
      { status: 404 }
    );
  }

  if (!ds.isActive) {
    return NextResponse.json(
      { error: "Data source is not active" },
      { status: 400 }
    );
  }

  if (ds.lastTestResult !== true) {
    return NextResponse.json(
      { error: "Data source has not passed connection test" },
      { status: 400 }
    );
  }

  const urlCheck = await validateTargetUrl(ds.url);
  if (!urlCheck.valid) {
    return NextResponse.json(
      { error: `Invalid data source URL: ${urlCheck.reason}` },
      { status: 400 }
    );
  }

  try {
    const bearerResult = await resolveBearerToken(ds.config);
    if (!bearerResult.ok) {
      return NextResponse.json(
        { error: bearerResult.error },
        { status: 400 }
      );
    }
    return { baseUrl: ds.url, token: bearerResult.token };
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve data source credentials" },
      { status: 502 }
    );
  }
}

/**
 * Resolve PGREST credentials — from a data source when `dataSourceId` is
 * provided, otherwise from env vars.
 *
 * Returns `{ baseUrl, token }` on success or a NextResponse error to forward.
 */
export async function resolvePgrestCredentials(
  session: Session,
  dataSourceId?: string | null
): Promise<{ baseUrl: string; token: string } | NextResponse> {
  if (dataSourceId) {
    return resolveDataSourceCredentials(session, dataSourceId);
  }

  const baseUrl = process.env.OPENAPI_URL;
  const token = process.env.OPENAPI_TOKEN;

  if (!baseUrl || !token) {
    return NextResponse.json(
      { error: "PGREST is not configured on the server." },
      { status: 500 }
    );
  }

  return { baseUrl, token };
}

/**
 * Authenticate, resolve PGREST credentials, and fetch the OpenAPI spec.
 *
 * When `dataSourceId` is provided, credentials are resolved from the
 * Alfresco data source. Otherwise, falls back to env vars.
 *
 * Returns the parsed spec on success, or a NextResponse error to forward.
 */
export async function fetchPgrestSpec(
  dataSourceId?: string | null
): Promise<OpenApiSpec | NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const creds = await resolvePgrestCredentials(session, dataSourceId);
  if (creds instanceof NextResponse) return creds;

  const specUrl = `${creds.baseUrl}/api/v1/pgrest/`;
  const res = await fetch(specUrl, {
    headers: {
      Accept: "application/openapi+json",
      Authorization: `Bearer ${creds.token}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch OpenAPI spec." },
      { status: 502 }
    );
  }

  return (await res.json()) as OpenApiSpec;
}
