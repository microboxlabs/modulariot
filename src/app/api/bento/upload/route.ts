import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the data from the request

  try {
    // Create the message and send the post
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
