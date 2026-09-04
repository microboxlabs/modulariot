import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const FILE_PATH = path.join(
  process.cwd(),
  "src/features/storytelling/testing/release-notes-demo.md"
);

export async function GET() {
  // Same gate the storytelling pages use (see [id]/page.tsx) — otherwise an
  // authenticated user could hit this route directly and pull the demo
  // content even with the feature flag off.
  if (process.env.ENABLE_STORYTELLING !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const markdown = await readFile(FILE_PATH, "utf-8");
  return new NextResponse(markdown, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
