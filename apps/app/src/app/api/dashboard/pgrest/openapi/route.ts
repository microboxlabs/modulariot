import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

interface OpenApiParameter {
  name: string;
  in: string;
  format?: string;
  type?: string;
}

interface OpenApiOperation {
  parameters?: OpenApiParameter[];
}

interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
}

interface OpenApiSpec {
  paths?: Record<string, OpenApiPathItem>;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fn = new URL(req.url).searchParams.get("fn");
  if (!fn || !/^[a-zA-Z_]\w*$/.test(fn)) {
    return NextResponse.json(
      { error: "Invalid or missing function name." },
      { status: 400 }
    );
  }

  const baseUrl = process.env.OPENAPI_URL;
  const token = process.env.OPENAPI_TOKEN;

  if (!baseUrl || !token) {
    return NextResponse.json(
      { error: "PGREST is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const specUrl = `${baseUrl}/api/v1/pgrest/`;
    const res = await fetch(specUrl, {
      headers: {
        Accept: "application/openapi+json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch OpenAPI spec." },
        { status: 502 }
      );
    }

    const spec: OpenApiSpec = await res.json();
    const pathKey = `/rpc/${fn}`;
    const pathItem = spec.paths?.[pathKey];

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
