import { NextResponse } from "next/server";
import { fetchPgrestSpec } from "../shared";

export async function GET() {
  try {
    const result = await fetchPgrestSpec();
    if (result instanceof NextResponse) return result;

    const functions: string[] = [];
    for (const path of Object.keys(result.paths ?? {})) {
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
