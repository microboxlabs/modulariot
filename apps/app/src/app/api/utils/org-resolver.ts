import { auth } from "@/auth";
import { NextResponse } from "next/server";

interface OrgResolution {
  userId: string;
  orgId: string;
}

type OrgResult =
  | { resolved: true; data: OrgResolution }
  | { resolved: false; response: NextResponse };

/**
 * Resolves organization for the current user.
 * Requires orgId as a query parameter since we don't have DB membership lookups.
 * Authentication is verified via NextAuth session.
 */
export async function resolveOrgForRequest(
  request: Request
): Promise<OrgResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      resolved: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const url = new URL(request.url);
  const orgId = url.searchParams.get("orgId");

  if (!orgId) {
    return {
      resolved: false,
      response: NextResponse.json(
        { error: "orgId query parameter is required" },
        { status: 400 }
      ),
    };
  }

  return {
    resolved: true,
    data: { userId: session.user.id, orgId },
  };
}
