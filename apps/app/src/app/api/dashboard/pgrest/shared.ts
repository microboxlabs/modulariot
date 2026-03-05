import { auth } from "@/auth";
import { NextResponse } from "next/server";

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
 * Authenticate, read PGREST env vars, and fetch the OpenAPI spec.
 * Returns the parsed spec on success, or a NextResponse error to forward.
 */
export async function fetchPgrestSpec(): Promise<OpenApiSpec | NextResponse> {
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

  return (await res.json()) as OpenApiSpec;
}
