import { auth } from "@/auth";
import { NextResponse } from "next/server";

import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";

/** One evaluator's case (`id`), read from the modulith as the active organization. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  return forwardControlTowerMap(`symptoms/${encodeURIComponent(id)}`);
}
