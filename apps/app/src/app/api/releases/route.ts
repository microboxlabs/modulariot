"use server";

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const releasesDir = path.join(process.cwd(), "src", "releases");
    const files = fs.readdirSync(releasesDir);
    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error reading releases directory:", error);
    return NextResponse.json({ files: [] }, { status: 500 });
  }
}
