import { auth } from "@/auth";
import { getUserSites } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

interface SiteResolution {
  siteId: string;
  session: Session;
}

type SiteResult =
  | { resolved: true; data: SiteResolution }
  | { resolved: false; response: NextResponse };

/**
 * Resolves the Alfresco site for the current user.
 * Requires siteId as a query parameter and verifies the user
 * is a member of that site via Alfresco's people API.
 */
export async function resolveSiteForRequest(
  request: Request
): Promise<SiteResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      resolved: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const url = new URL(request.url);
  const siteId = url.searchParams.get("siteId");

  if (!siteId) {
    return {
      resolved: false,
      response: NextResponse.json(
        { error: "siteId query parameter is required" },
        { status: 400 }
      ),
    };
  }

  // Verify user is a member of the requested site
  const sites = await getUserSites(session);
  const isMember = sites.some((s) => s.shortName === siteId);

  if (!isMember) {
    return {
      resolved: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    resolved: true,
    data: { siteId, session },
  };
}
