import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const FILE_PATH = path.join(
  process.cwd(),
  "src/features/storytelling/testing/audit-report-demo.pdf"
);

export async function GET() {
  // Testing-only fixture — gated the same way the /storytelling pages are
  // (see ENABLE_STORYTELLING in runtime-config.types.ts). No auth middleware
  // sits in front of /api, so this fail-closed check has to live here.
  if (process.env.ENABLE_STORYTELLING !== "true") {
    return new NextResponse(null, { status: 404 });
  }

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const file = await readFile(FILE_PATH);
  return new NextResponse(file, {
    headers: { "Content-Type": "application/pdf" },
  });
}
