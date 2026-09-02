import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const FILE_PATH = path.join(
  process.cwd(),
  "src/features/storytelling/testing/dashboard_torre_real.data.json"
);

/**
 * Serves the dashboard's dataset separately from its HTML shell (see
 * dashboard-preview/route.ts). It used to be a ~6MB inline JS object literal
 * baked into the HTML — since that's a same-origin iframe, parsing that
 * single statement blocked the WHOLE tab's main thread, not just the
 * iframe's. Fetching it as JSON lets the HTML shell parse in milliseconds
 * and load this asynchronously afterward; JSON.parse is also considerably
 * faster than V8 parsing/compiling the equivalent JS literal.
 */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await readFile(FILE_PATH, "utf-8");
  return new NextResponse(json, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
