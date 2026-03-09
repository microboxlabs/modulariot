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
 * Requires orgId as a query parameter and verifies it matches the
 * authenticated user's identity. Data sources are currently user-scoped
 * (orgId = user email/id), so we enforce that the caller can only access
 * their own scope.
 *
 * TODO: Replace with real org membership lookup once org infrastructure exists.
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

  // Verify the caller owns this orgId. Currently orgId is the user's email
  // or Auth0 sub — reject requests for other users' scopes.
  const allowedIds = [session.user.email, session.user.id].filter(Boolean);
  if (!allowedIds.includes(orgId)) {
    return {
      resolved: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    resolved: true,
    data: { userId: session.user.id, orgId },
  };
}
