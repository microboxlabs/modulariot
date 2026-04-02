import { NextRequest, NextResponse } from "next/server";
import { fetchPgrestSpec, parseDataSourceParam } from "../shared";

export async function GET(req: NextRequest) {
  try {
    const result = await fetchPgrestSpec(parseDataSourceParam(req));
    if (result instanceof NextResponse) return result;

    const functions: string[] = [];
    const tables: string[] = [];
    for (const path of Object.keys(result.paths ?? {})) {
      if (path.startsWith("/rpc/")) {
        functions.push(path.slice("/rpc/".length));
      } else if (path.startsWith("/") && path.length > 1 && !path.includes("/", 1)) {
        tables.push(path.slice(1));
      }
    }

    functions.sort((a, b) => a.localeCompare(b));
    tables.sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ functions, tables });
  } catch (error) {
    console.error("PGREST functions list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch OpenAPI spec." },
      { status: 502 }
    );
  }
}
