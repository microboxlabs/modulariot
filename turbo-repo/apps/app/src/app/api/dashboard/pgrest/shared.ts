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

/** Read an integer env var with a numeric fallback. Trims whitespace and
 *  guards against malformed values (NaN). Negative/zero values pass through
 *  — callers should clamp if they need a positive floor. */
export function parseIntEnv(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export interface OpenApiSchema {
  type?: string;
  format?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  $ref?: string;
}

export interface OpenApiParameter {
  name: string;
  in: string;
  format?: string;
  type?: string;
  required?: boolean;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  schema?: OpenApiSchema;
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
  definitions?: Record<string, OpenApiSchema>;
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

export interface IntrospectedParameter {
  name: string;
  type: string;
  format: string;
  required: boolean;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

export function fromParameter(p: OpenApiParameter): IntrospectedParameter {
  return {
    name: p.name,
    type: p.type ?? "string",
    format: p.format ?? p.type ?? "text",
    required: p.required === true,
    enum: Array.isArray(p.enum) ? p.enum.map(String) : undefined,
    minimum: typeof p.minimum === "number" ? p.minimum : undefined,
    maximum: typeof p.maximum === "number" ? p.maximum : undefined,
    pattern: typeof p.pattern === "string" ? p.pattern : undefined,
  };
}

export function fromProperty(
  name: string,
  prop: OpenApiSchema,
  required: boolean,
): IntrospectedParameter {
  return {
    name,
    type: prop.type ?? "string",
    format: prop.format ?? prop.type ?? "text",
    required,
    enum: Array.isArray(prop.enum) ? prop.enum.map(String) : undefined,
    minimum: typeof prop.minimum === "number" ? prop.minimum : undefined,
    maximum: typeof prop.maximum === "number" ? prop.maximum : undefined,
    pattern: typeof prop.pattern === "string" ? prop.pattern : undefined,
  };
}

// Resolve an inline schema or a local `#/definitions/<name>` reference.
export function resolveSchema(
  schema: OpenApiSchema | undefined,
  spec: OpenApiSpec,
): OpenApiSchema | undefined {
  if (!schema) return undefined;
  if (!schema.$ref) return schema;
  const prefix = "#/definitions/";
  if (!schema.$ref.startsWith(prefix)) return undefined;
  const key = decodeURIComponent(schema.$ref.slice(prefix.length));
  return spec.definitions?.[key];
}

// PostgREST exposes RPC arguments (and table insert columns) as an `in: "body"`
// parameter whose schema is a reference into `definitions`. Walk that schema
// and emit one introspected parameter per property so the client can filter
// out-of-schema columns before POSTing.
export function extractBodyProperties(
  operation: { parameters?: OpenApiParameter[] } | undefined,
  spec: OpenApiSpec,
): IntrospectedParameter[] {
  const bodyParam = operation?.parameters?.find((p) => p.in === "body");
  const schema = resolveSchema(bodyParam?.schema, spec);
  if (!schema?.properties) return [];
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties).map(([name, prop]) =>
    fromProperty(name, prop, required.has(name)),
  );
}

/**
 * Introspect the parameter list for a given RPC/table path. Prefers query
 * params (which cover tables' column-filter sets); falls back to the POST
 * body schema so RPCs — whose args appear only under `in: body` — still
 * yield a usable column list.
 *
 * Returns null if the path is not present in the spec.
 */
export function introspectPath(
  spec: OpenApiSpec,
  fn: string,
): { methods: string[]; parameters: IntrospectedParameter[] } | null {
  const pathItem = spec.paths?.[`/${fn}`];
  if (!pathItem) return null;

  const methods: string[] = [];
  if (pathItem.get) methods.push("GET");
  if (pathItem.post) methods.push("POST");

  const operation = pathItem.get ?? pathItem.post;
  const queryParams = (operation?.parameters ?? [])
    .filter((p) => p.in === "query")
    .map(fromParameter);

  const parameters =
    queryParams.length > 0
      ? queryParams
      : extractBodyProperties(pathItem.post, spec);

  return { methods, parameters };
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
