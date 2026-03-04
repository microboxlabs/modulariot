import { auth } from "@/auth";
import { NextResponse } from "next/server";

interface OpenApiPathItem {
  get?: unknown;
  post?: unknown;
}

interface OpenApiSpec {
  paths?: Record<string, OpenApiPathItem>;
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const functions: string[] = [];

    for (const path of Object.keys(spec.paths ?? {})) {
      if (path.startsWith("/rpc/")) {
        functions.push(path.slice("/rpc/".length));
      }
    }

    functions.sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ functions });
  } catch (error) {
    console.error("PGREST functions list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch OpenAPI spec." },
      { status: 502 }
    );
  }
}
