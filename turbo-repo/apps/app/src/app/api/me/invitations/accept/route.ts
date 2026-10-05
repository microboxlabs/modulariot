import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { evictAllScopeCaches } from "@/app/api/utils/tenant-scope";

/** Accepts the invitation an invite link carries: body `{ token }`. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const token = (body as { token?: unknown } | null)?.token;
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  const response = await forwardToQuarkus("/api/v1/me/invitations/accept", {
    method: "POST",
    body: { token },
  });
  // The new membership changes the caller's organizations.
  if (response.ok) evictAllScopeCaches();
  return response;
}
