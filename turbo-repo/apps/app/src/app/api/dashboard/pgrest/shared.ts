import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import {
  getDataSource,
  type AlfrescoDataSource,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { resolveBearerToken, buildAuthHeader } from "@/app/api/data-sources/resolve-credentials";
import type { AuthMethod } from "@/app/api/data-sources/resolve-credentials";
import { validateTargetUrl } from "@/app/api/utils/url-validator";
import { logger } from "@/lib/logger";

// The full PostgRest base URL should come from config (env var, data source, etc.)
// rather than being assembled by convention. Each environment owns its own topology.
function normalizePgrestUrl(url: string): string {
  let trimmed = url;
  while (trimmed.endsWith("/")) trimmed = trimmed.slice(0, -1);
  return trimmed;
}

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
): Promise<{ baseUrl: string; token: string; authMethod: AuthMethod } | NextResponse> {
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
    logger.warn({ dataSourceId }, "Data source is not active");
    return NextResponse.json(
      { error: "Data source is not active" },
      { status: 400 }
    );
  }

  if (ds.lastTestResult !== true) {
    logger.warn({ dataSourceId, lastTestResult: ds.lastTestResult }, "Data source has not passed connection test");
    return NextResponse.json(
      { error: "Data source has not passed connection test" },
      { status: 400 }
    );
  }

  const urlCheck = await validateTargetUrl(ds.url);
  if (!urlCheck.valid) {
    logger.warn({ dataSourceId, reason: urlCheck.reason }, "Invalid data source URL");
    return NextResponse.json(
      { error: `Invalid data source URL: ${urlCheck.reason}` },
      { status: 400 }
    );
  }

  try {
    const bearerResult = await resolveBearerToken(ds.config, dataSourceId);
    if (!bearerResult.ok) {
      logger.warn({ dataSourceId, error: bearerResult.error }, "Bearer token resolution failed");
      return NextResponse.json(
        { error: bearerResult.error },
        { status: 400 }
      );
    }
    logger.debug({ dataSourceId, authMethod: bearerResult.authMethod }, "Data source credentials resolved");
    return { baseUrl: ds.url, token: bearerResult.token, authMethod: bearerResult.authMethod };
  } catch (err) {
    logger.error({ dataSourceId, err }, "Failed to resolve data source credentials");
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
): Promise<{ baseUrl: string; token: string; authMethod: AuthMethod } | NextResponse> {
  if (dataSourceId) {
    return resolveDataSourceCredentials(session, dataSourceId);
  }

  const envUrl = process.env.OPENAPI_URL;
  const token = process.env.OPENAPI_TOKEN;

  if (!envUrl || !token) {
    return NextResponse.json(
      { error: "PGREST is not configured on the server." },
      { status: 500 }
    );
  }

  const baseUrl = normalizePgrestUrl(envUrl);
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return NextResponse.json(
      { error: "OPENAPI_URL is not a valid URL. It must be the full PostgREST base URL (e.g. https://host.com/api/v1/pgrest)." },
      { status: 500 }
    );
  }

  if (!parsed.pathname || parsed.pathname === "/") {
    return NextResponse.json(
      { error: "OPENAPI_URL must include the full PostgREST base path, not just the host (e.g. https://host.com/api/v1/pgrest)." },
      { status: 500 }
    );
  }

  return { baseUrl, token, authMethod: "TOKEN" };
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

  const specUrl = `${creds.baseUrl}/`;
  const res = await fetch(specUrl, {
    headers: {
      Accept: "application/openapi+json",
      Authorization: buildAuthHeader(creds.token, creds.authMethod),
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
