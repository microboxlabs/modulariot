import { NextRequest, NextResponse } from "next/server";
import { fetchPgrestSpec, parseDataSourceParam, type OpenApiPathItem } from "../shared";

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
    const parameters = (operation?.parameters ?? [])
      .filter((p) => p.in === "query")
      .map((p) => ({
        name: p.name,
        type: p.type ?? "string",
        format: p.format ?? p.type ?? "text",
      }));

    return NextResponse.json({ methods, parameters });
  } catch (error) {
    console.error("OpenAPI introspection error:", error);
    return NextResponse.json(
      { error: "Failed to fetch OpenAPI spec." },
      { status: 502 }
    );
  }
}
