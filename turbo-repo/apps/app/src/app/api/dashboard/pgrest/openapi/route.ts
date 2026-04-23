import { NextRequest, NextResponse } from "next/server";
import {
  fetchPgrestSpec,
  parseDataSourceParam,
  type OpenApiPathItem,
  type OpenApiParameter,
  type OpenApiSchema,
  type OpenApiSpec,
} from "../shared";

interface IntrospectedParameter {
  name: string;
  type: string;
  format: string;
  required: boolean;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

function fromParameter(p: OpenApiParameter): IntrospectedParameter {
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

function fromProperty(
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
function resolveSchema(
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
function extractBodyProperties(
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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fn = url.searchParams.get("fn");
  if (!fn) {
    return NextResponse.json(
      { error: "Missing path parameter." },
      { status: 400 }
    );
  }

  try {
    const result = await fetchPgrestSpec(parseDataSourceParam(req));
    if (result instanceof NextResponse) return result;

    const pathKey = `/${fn}`;
    const pathItem: OpenApiPathItem | undefined = result.paths?.[pathKey];

    if (!pathItem) {
      return NextResponse.json(
        { error: `Path "${fn}" not found in OpenAPI spec.` },
        { status: 404 }
      );
    }

    const methods: string[] = [];
    if (pathItem.get) methods.push("GET");
    if (pathItem.post) methods.push("POST");

    const operation = pathItem.get ?? pathItem.post;
    const queryParams = (operation?.parameters ?? [])
      .filter((p) => p.in === "query")
      .map(fromParameter);

    // Prefer query params (covers tables' column-filter set); fall back to the
    // POST body schema so RPCs — which expose their args only under `in: body`
    // — still produce a usable column list for schema-aware clients.
    const parameters =
      queryParams.length > 0
        ? queryParams
        : extractBodyProperties(pathItem.post, result);

    return NextResponse.json({ methods, parameters });
  } catch (error) {
    console.error("OpenAPI introspection error:", error);
    return NextResponse.json(
      { error: "Failed to fetch OpenAPI spec." },
      { status: 502 }
    );
  }
}
