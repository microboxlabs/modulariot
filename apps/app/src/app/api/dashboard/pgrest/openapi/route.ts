import { NextRequest, NextResponse } from "next/server";
import { fetchPgrestSpec, type OpenApiPathItem } from "../shared";

export async function GET(req: NextRequest) {
  const fn = new URL(req.url).searchParams.get("fn");
  if (!fn || !/^[a-zA-Z_]\w*$/.test(fn)) {
    return NextResponse.json(
      { error: "Invalid or missing function name." },
      { status: 400 }
    );
  }

  try {
    const result = await fetchPgrestSpec();
    if (result instanceof NextResponse) return result;

    const pathKey = `/rpc/${fn}`;
    const pathItem: OpenApiPathItem | undefined = result.paths?.[pathKey];

    if (!pathItem) {
      return NextResponse.json(
        { error: `Function "${fn}" not found in OpenAPI spec.` },
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
