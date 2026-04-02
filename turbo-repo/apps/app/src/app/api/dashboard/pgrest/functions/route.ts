import { NextRequest, NextResponse } from "next/server";
import { fetchPgrestSpec, parseDataSourceParam } from "../shared";

export async function GET(req: NextRequest) {
  try {
    const result = await fetchPgrestSpec(parseDataSourceParam(req));
    if (result instanceof NextResponse) return result;

    const paths: string[] = [];
    for (const path of Object.keys(result.paths ?? {})) {
      if (path.startsWith("/") && path.length > 1) {
        paths.push(path.slice(1));
      }
    }

    paths.sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ paths });
  } catch (error) {
    console.error("PGREST functions list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch OpenAPI spec." },
      { status: 502 }
    );
  }
}
