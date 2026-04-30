import { NextRequest, NextResponse } from "next/server";
import {
  fetchPgrestSpec,
  introspectPath,
  parseDataSourceParam,
} from "../shared";

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

    const introspected = introspectPath(result, fn);
    if (!introspected) {
      return NextResponse.json(
        { error: `Path "${fn}" not found in OpenAPI spec.` },
        { status: 404 }
      );
    }

    return NextResponse.json(introspected);
  } catch (error) {
    console.error("OpenAPI introspection error:", error);
    return NextResponse.json(
      { error: "Failed to fetch OpenAPI spec." },
      { status: 502 }
    );
  }
}
