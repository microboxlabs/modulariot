"use server";

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getReleaseNotesAudience } from "@/features/layout/lib/release-notes-audience";

export async function GET() {
  try {
    const audience = getReleaseNotesAudience();
    const releasesDir = path.join(
      process.cwd(),
      "src",
      "releases",
      audience === "platform" ? "platform" : ""
    );
    const files = fs.existsSync(releasesDir)
      ? fs
          .readdirSync(releasesDir)
          .filter((file) => /^v?\d+\.\d+\.\d+\.mdx$/.test(file))
      : [];
    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error reading releases directory:", error);
    return NextResponse.json({ files: [] }, { status: 500 });
  }
}
